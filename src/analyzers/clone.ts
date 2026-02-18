import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { LanguageBytes, RepoSummary } from "../types.js";

const execFileAsync = promisify(execFile);

export type LinguistEngine = "local" | "docker";

export interface CloneAnalyzeOptions {
  repos: RepoSummary[];
  token: string;
  pastWeek: boolean;
  cloneConcurrency: number;
  tmpDir?: string;
  sinceIso?: string;
  authorPatterns?: string[];
  linguistEngine?: LinguistEngine;
  cacheDir?: string;
  disableCache?: boolean;
  ensureDependencies?: () => Promise<void>;
  analyzeRepoFullFn?: (repo: RepoSummary, token: string, tmpRoot: string) => Promise<LanguageBytes>;
  analyzeRepoPastWeekFn?: (
    repo: RepoSummary,
    token: string,
    tmpRoot: string,
    sinceIso: string,
    authorPatterns?: string[]
  ) => Promise<LanguageBytes>;
}

interface CloneAnalyzeResult {
  totals: LanguageBytes;
  skippedRepositories: Array<{ fullName: string; reason: string }>;
}

function debugLog(message: string): void {
  if (process.env.GH_STATS_DEBUG === "1") {
    console.error(`[gh-stats] ${message}`);
  }
}

function getDockerImage(): string {
  return process.env.GH_STATS_LINGUIST_IMAGE ?? "github/linguist";
}

function redactToken(value: string): string {
  return value.replace(/(x-access-token:)([^@]+)/g, "$1***");
}

function getCloneUrl(fullName: string, token: string): string {
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${fullName}.git`;
}

function cachePathForRepo(cacheRoot: string, fullName: string): string {
  return path.join(cacheRoot, fullName.replaceAll("/", "__"));
}

function normalizeAuthorPatterns(authorPatterns: string[] | undefined): string[] {
  if (!authorPatterns) return [];
  return authorPatterns.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function asyncPool<T, R>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => iteratorFn(item, index));
    ret.push(p);

    if (poolLimit <= items.length) {
      const e = p.then(() => undefined);
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
        const indexToRemove = executing.findIndex((exec) => exec === e);
        if (indexToRemove >= 0) executing.splice(indexToRemove, 1);
      }
    }
  }

  return Promise.all(ret);
}

function mergeLanguageBytes(target: LanguageBytes, source: LanguageBytes): void {
  for (const [language, bytes] of Object.entries(source)) {
    target[language] = (target[language] ?? 0) + bytes;
  }
}

export async function ensureCloneDependencies(engine: LinguistEngine = "local"): Promise<void> {
  try {
    await runCommand("git", ["--version"]);
  } catch {
    throw new Error("Clone mode requires git on PATH.");
  }

  if (engine === "docker") {
    try {
      await runCommand("docker", ["--version"]);
    } catch {
      throw new Error("Clone mode requires docker on PATH when using docker linguist.");
    }
    return;
  }

  try {
    await runCommand("github-linguist", ["--version"]);
  } catch {
    throw new Error("Clone mode requires github-linguist on PATH.");
  }
}

async function runLinguistJson(
  repoDir: string,
  filePath?: string,
  engine: LinguistEngine = "local"
): Promise<string> {
  if (engine === "docker") {
    const dockerImage = getDockerImage();
    const mountSpec = `${repoDir}:/repo`;
    const args = [
      "run",
      "--rm",
      "-v",
      mountSpec,
      "-w",
      "/repo",
      dockerImage,
      "github-linguist",
      "--json",
    ];
    if (filePath) {
      const containerPath = path.posix.join("/repo", filePath.replaceAll("\\", "/"));
      args.push(containerPath);
    }
    return runCommand("docker", args);
  }

  const args = ["--json"];
  if (filePath) args.push(filePath);
  return runCommand("github-linguist", args, { cwd: repoDir });
}

export function parseLinguistJsonToLanguageBytes(jsonText: string): LanguageBytes {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const result: LanguageBytes = {};

  for (const [language, rawValue] of Object.entries(parsed)) {
    if (typeof rawValue === "number") {
      result[language] = rawValue;
      continue;
    }
    if (rawValue && typeof rawValue === "object") {
      const record = rawValue as Record<string, unknown>;
      if (typeof record.size === "number") {
        result[language] = record.size;
        continue;
      }
      if (typeof record.bytes === "number") {
        result[language] = record.bytes;
      }
    }
  }

  return result;
}

export function normalizeGitPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed.includes("=>")) return trimmed;

  const braceMatch = trimmed.match(/\{([^{}]+)\}/);
  if (braceMatch) {
    const [left, right] = braceMatch[1].split("=>").map((value) => value.trim());
    if (right) {
      return trimmed.replace(braceMatch[0], right || left || "").replaceAll("//", "/");
    }
  }

  const split = trimmed.split("=>");
  const right = split[split.length - 1]?.trim();
  return right || trimmed;
}

export function parseNumstatOutput(output: string): Record<string, number> {
  const totalsByPath: Record<string, number> = {};
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    if (!line || !line.includes("\t")) continue;
    const [addedRaw, deletedRaw, filePathRaw] = line.split("\t");
    if (!filePathRaw) continue;
    const added = Number(addedRaw);
    const deleted = Number(deletedRaw);
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue;
    const normalizedPath = normalizeGitPath(filePathRaw);
    totalsByPath[normalizedPath] = (totalsByPath[normalizedPath] ?? 0) + added + deleted;
  }

  return totalsByPath;
}

export function parseNumstatOutputForAuthors(
  output: string,
  authorPatterns: string[] | undefined
): Record<string, number> {
  const patterns = normalizeAuthorPatterns(authorPatterns);
  const totalsByPath: Record<string, number> = {};
  const lines = output.split(/\r?\n/);
  let currentAuthor = "";
  let includeCurrentCommit = patterns.length === 0;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("@@@")) {
      const [, nameRaw = "", emailRaw = ""] = line.slice(3).split("\t");
      const name = nameRaw.toLowerCase();
      const email = emailRaw.toLowerCase();
      currentAuthor = `${name} ${email}`.trim();
      includeCurrentCommit =
        patterns.length === 0 || patterns.some((pattern) => currentAuthor.includes(pattern));
      continue;
    }

    if (!includeCurrentCommit) continue;
    if (!line.includes("\t")) continue;
    const [addedRaw, deletedRaw, filePathRaw] = line.split("\t");
    if (!filePathRaw) continue;
    const added = Number(addedRaw);
    const deleted = Number(deletedRaw);
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue;
    const normalizedPath = normalizeGitPath(filePathRaw);
    totalsByPath[normalizedPath] = (totalsByPath[normalizedPath] ?? 0) + added + deleted;
  }

  return totalsByPath;
}

function detectLanguageFromExtension(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const extMap: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C",
    ".hpp": "C++",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".md": "Markdown",
    ".mdx": "MDX",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".sh": "Shell",
  };
  return extMap[ext] ?? null;
}

async function resolveLanguageForFile(
  repoDir: string,
  filePath: string,
  engine: LinguistEngine = "local"
): Promise<string | null> {
  const relativePath = filePath.replaceAll("\\", "/");

  try {
    const jsonOutput = await runLinguistJson(repoDir, relativePath, engine);
    const parsed = parseLinguistJsonToLanguageBytes(jsonOutput);
    const entries = Object.entries(parsed).sort((a, b) => b[1] - a[1]);
    if (entries[0]?.[0]) return entries[0][0];
  } catch {
    // fall through
  }

  return detectLanguageFromExtension(relativePath);
}

async function loadRepoLanguageCache(repoDir: string): Promise<Record<string, string>> {
  const cacheFile = path.join(repoDir, ".gh-stats-language-cache.json");
  try {
    const raw = await fs.readFile(cacheFile, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveRepoLanguageCache(
  repoDir: string,
  cache: Record<string, string>
): Promise<void> {
  const cacheFile = path.join(repoDir, ".gh-stats-language-cache.json");
  await fs.writeFile(cacheFile, JSON.stringify(cache), "utf8");
}

async function cloneFresh(repo: RepoSummary, token: string, repoDir: string): Promise<void> {
  const cloneUrl = getCloneUrl(repo.full_name, token);
  await fs.rm(repoDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(repoDir), { recursive: true });
  await runCommand("git", ["clone", "--depth=1", cloneUrl, repoDir]);
}

async function updateCachedRepo(repo: RepoSummary, token: string, repoDir: string): Promise<void> {
  const cloneUrl = getCloneUrl(repo.full_name, token);
  try {
    const hasGit = await pathExists(path.join(repoDir, ".git"));
    if (!hasGit) {
      await cloneFresh(repo, token, repoDir);
      return;
    }

    await runCommand("git", ["-C", repoDir, "remote", "set-url", "origin", cloneUrl]);
    await runCommand("git", ["-C", repoDir, "fetch", "--prune", "origin"]);
    await runCommand("git", ["-C", repoDir, "reset", "--hard", "HEAD"]);
    await runCommand("git", ["-C", repoDir, "clean", "-fd"]);
    await runCommand("git", ["-C", repoDir, "checkout", "-f", "HEAD"]);
    await runCommand("git", ["-C", repoDir, "pull", "--ff-only"]);
  } catch {
    // Cache might be corrupted, refresh it.
    await cloneFresh(repo, token, repoDir);
  }
}

async function prepareRepoDirectory(
  repo: RepoSummary,
  token: string,
  tmpRoot: string,
  cacheRoot: string | undefined
): Promise<{ repoDir: string; cleanup: () => Promise<void> }> {
  if (cacheRoot) {
    const repoDir = cachePathForRepo(cacheRoot, repo.full_name);
    await updateCachedRepo(repo, token, repoDir);
    return { repoDir, cleanup: async () => {} };
  }

  const repoDir = await fs.mkdtemp(path.join(tmpRoot, "gh-stats-clone-"));
  try {
    await cloneFresh(repo, token, repoDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clone ${repo.full_name}: ${redactToken(message)}`);
  }
  return {
    repoDir,
    cleanup: async () => fs.rm(repoDir, { recursive: true, force: true }),
  };
}

async function ensureHistoryForSince(repoDir: string, sinceIso: string): Promise<void> {
  const cutoffMs = Date.parse(sinceIso);
  if (Number.isNaN(cutoffMs)) return;

  const deepenSteps = [100, 300, 700, 1500];
  for (const deepenBy of deepenSteps) {
    const oldest = (
      await runCommand("git", [
        "-C",
        repoDir,
        "log",
        "--all",
        "--reverse",
        "--format=%cI",
        "-n",
        "1",
      ])
    ).trim();
    const oldestMs = Date.parse(oldest);
    if (!Number.isNaN(oldestMs) && oldestMs <= cutoffMs) return;

    debugLog(`deepening clone ${repoDir} by ${deepenBy}`);
    try {
      await runCommand("git", ["-C", repoDir, "fetch", "--deepen", String(deepenBy), "origin"]);
    } catch {
      return;
    }
  }
}

export async function analyzeRepoFull(
  repo: RepoSummary,
  token: string,
  tmpRoot: string,
  engine: LinguistEngine = "local",
  cacheRoot?: string
): Promise<LanguageBytes> {
  const { repoDir, cleanup } = await prepareRepoDirectory(repo, token, tmpRoot, cacheRoot);
  try {
    const output = await runLinguistJson(repoDir, undefined, engine);
    return parseLinguistJsonToLanguageBytes(output);
  } finally {
    await cleanup();
  }
}

export async function analyzeRepoPastWeek(
  repo: RepoSummary,
  token: string,
  tmpRoot: string,
  sinceIso: string,
  engine: LinguistEngine = "local",
  authorPatterns?: string[],
  cacheRoot?: string
): Promise<LanguageBytes> {
  const { repoDir, cleanup } = await prepareRepoDirectory(repo, token, tmpRoot, cacheRoot);
  try {
    await ensureHistoryForSince(repoDir, sinceIso);
    const persistedLanguageMap = await loadRepoLanguageCache(repoDir);
    const logArgs = [
      "-C",
      repoDir,
      "log",
      "--all",
      `--since=${sinceIso}`,
      "--numstat",
      "--format=@@@%H%x09%an%x09%ae",
    ];
    const numstatOutput = await runCommand("git", logArgs);
    const pathChurn = parseNumstatOutputForAuthors(numstatOutput, authorPatterns);
    debugLog(`churn map for ${repo.full_name}: ${Object.keys(pathChurn).length} files`);
    const languageCache = new Map<string, string | null>();
    for (const [filePath, language] of Object.entries(persistedLanguageMap)) {
      languageCache.set(filePath, language);
    }
    const totals: LanguageBytes = {};

    for (const [filePath, churn] of Object.entries(pathChurn)) {
      if (churn <= 0) continue;
      if (!languageCache.has(filePath)) {
        const language = await resolveLanguageForFile(repoDir, filePath, engine);
        languageCache.set(filePath, language);
      }
      const language = languageCache.get(filePath);
      if (!language) continue;
      totals[language] = (totals[language] ?? 0) + churn;
    }

    const nextPersistedMap: Record<string, string> = {};
    for (const [filePath, language] of languageCache.entries()) {
      if (language) nextPersistedMap[filePath] = language;
    }
    await saveRepoLanguageCache(repoDir, nextPersistedMap);

    debugLog(`final language churn for ${repo.full_name}: ${JSON.stringify(totals)}`);
    return totals;
  } finally {
    await cleanup();
  }
}

export async function analyzeWithClone(options: CloneAnalyzeOptions): Promise<CloneAnalyzeResult> {
  const linguistEngine = options.linguistEngine ?? "local";
  const ensureDeps = options.ensureDependencies ?? (() => ensureCloneDependencies(linguistEngine));
  await ensureDeps();

  const cacheRoot = options.disableCache
    ? undefined
    : (options.cacheDir ?? path.join(os.tmpdir(), "gh-stats-repo-cache"));
  if (cacheRoot) {
    await fs.mkdir(cacheRoot, { recursive: true });
  }

  const analyzeRepoFullFn =
    options.analyzeRepoFullFn ??
    ((repo, token, tmpRoot) => analyzeRepoFull(repo, token, tmpRoot, linguistEngine, cacheRoot));
  const analyzeRepoPastWeekFn =
    options.analyzeRepoPastWeekFn ??
    ((repo, token, tmpRoot, sinceIso, authorPatterns) =>
      analyzeRepoPastWeek(
        repo,
        token,
        tmpRoot,
        sinceIso,
        linguistEngine,
        authorPatterns,
        cacheRoot
      ));

  const totals: LanguageBytes = {};
  const skippedRepositories: Array<{ fullName: string; reason: string }> = [];
  const tmpRoot = options.tmpDir ?? os.tmpdir();
  await fs.mkdir(tmpRoot, { recursive: true });
  const effectiveSince =
    options.sinceIso ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  await asyncPool(Math.max(1, options.cloneConcurrency), options.repos, async (repo) => {
    try {
      const repoTotals = options.pastWeek
        ? await analyzeRepoPastWeekFn(
            repo,
            options.token,
            tmpRoot,
            effectiveSince,
            options.authorPatterns
          )
        : await analyzeRepoFullFn(repo, options.token, tmpRoot);
      mergeLanguageBytes(totals, repoTotals);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skippedRepositories.push({
        fullName: repo.full_name,
        reason: redactToken(reason),
      });
      debugLog(`skipped ${repo.full_name}: ${reason}`);
    }
  });

  return { totals, skippedRepositories };
}
