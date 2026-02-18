import type {
  FetchOptions,
  LanguageBytes,
  LanguageStatsResult,
  LanguageStat,
  RepoSummary,
} from "./types.js";
import {
  fetchAuthenticatedIdentity,
  fetchRepoLanguages,
  listAllRepos,
  repoHasRecentAuthorCommit,
} from "./github.js";
import { analyzeWithClone, type LinguistEngine } from "./analyzers/clone.js";

interface AggregateOptions extends FetchOptions {
  top?: number;
  all?: boolean;
  pastWeek?: boolean;
  source?: "api" | "clone";
  cloneConcurrency?: number;
  tmpDir?: string;
  linguistEngine?: LinguistEngine;
  author?: string;
  allAuthors?: boolean;
  includeMarkupLangs?: boolean;
  includeRepoComposition?: boolean;
  cacheDir?: string;
  noCache?: boolean;
}

const MARKDOWN_LANGUAGES = new Set(["Markdown", "MDX"]);
const MARKUP_LANGUAGES = new Set([
  "HTML",
  "XML",
  "YAML",
  "JSON",
  "TOML",
  "INI",
  "reStructuredText",
]);

function mergeLanguageBytes(target: LanguageBytes, source: LanguageBytes): void {
  for (const [language, bytes] of Object.entries(source)) {
    target[language] = (target[language] ?? 0) + bytes;
  }
}

function toSortedStats(languageBytes: LanguageBytes, top?: number): LanguageStat[] {
  const totalBytes = Object.values(languageBytes).reduce((sum, value) => sum + value, 0);

  const stats = Object.entries(languageBytes)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percent: totalBytes === 0 ? 0 : (bytes / totalBytes) * 100,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return typeof top === "number" ? stats.slice(0, top) : stats;
}

function applyLanguageFilters(
  languageBytes: LanguageBytes,
  includeMarkdown?: boolean,
  includeMarkupLangs?: boolean
): void {
  if (!includeMarkdown) {
    for (const language of MARKDOWN_LANGUAGES) {
      delete languageBytes[language];
    }
  }
  if (!includeMarkupLangs) {
    for (const language of MARKUP_LANGUAGES) {
      delete languageBytes[language];
    }
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

async function fetchAllLanguages(repos: RepoSummary[], token: string): Promise<LanguageBytes> {
  const totals: LanguageBytes = {};
  const concurrency = 5;

  const results = await asyncPool(concurrency, repos, async (repo) => {
    const languages = await fetchRepoLanguages(repo.languages_url, token);
    return languages;
  });

  for (const languages of results) {
    mergeLanguageBytes(totals, languages);
  }

  return totals;
}

export async function getLanguageStats(options: AggregateOptions): Promise<LanguageStatsResult> {
  const source = options.source ?? "api";
  const cloneConcurrency = options.cloneConcurrency ?? 3;
  const linguistEngine = options.linguistEngine ?? "local";
  const allRepos = await listAllRepos(options);
  const nowMs = Date.now();
  const days = options.pastWeek ? 7 : undefined;
  const sinceMs = options.pastWeek ? nowMs - 7 * 24 * 60 * 60 * 1000 : undefined;
  const sinceIso = sinceMs ? new Date(sinceMs).toISOString() : undefined;
  const untilIso = options.pastWeek ? new Date(nowMs).toISOString() : undefined;

  let windowMeta: LanguageStatsResult["window"];
  let repos = allRepos;

  if (options.pastWeek) {
    repos = allRepos.filter((repo) => {
      const pushedAt = repo.pushed_at;
      if (!pushedAt) return false;
      const pushedMs = Date.parse(pushedAt);
      if (Number.isNaN(pushedMs)) return false;
      return pushedMs >= (sinceMs ?? 0);
    });
  }

  if (options.pastWeek) {
    windowMeta = {
      days: days ?? 7,
      since: sinceIso ?? new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString(),
      until: untilIso ?? new Date(nowMs).toISOString(),
      activityField: source === "clone" ? "changed_lines" : "pushed_at",
    };
  }

  let totals: LanguageBytes = {};
  let skippedRepositories: LanguageStatsResult["skippedRepositories"];
  let authorFilter: string | undefined;
  let authorPatterns: string[] | undefined;
  let prefilterAuthorPatterns: string[] | undefined;
  let repoComposition: LanguageStatsResult["repoComposition"];
  let weeklyChurn: LanguageStatsResult["weeklyChurn"];

  if (source === "clone") {
    if (options.pastWeek && !options.allAuthors) {
      if (options.author) {
        authorFilter = options.author;
        authorPatterns = [options.author];
        prefilterAuthorPatterns = [options.author];
      } else {
        try {
          const identity = await fetchAuthenticatedIdentity(options.token);
          authorFilter = identity.login;
          authorPatterns = [...new Set([identity.login, ...identity.emails])];
          prefilterAuthorPatterns = authorPatterns;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Failed to resolve authenticated GitHub username for author filtering. ${message}. Use --author <username> or --all-authors to bypass.`
          );
        }
      }

      if (sinceIso && prefilterAuthorPatterns && prefilterAuthorPatterns.length > 0) {
        const repoChecks = await asyncPool(8, repos, async (repo) => {
          let hasCommit = false;
          for (const author of prefilterAuthorPatterns) {
            hasCommit = await repoHasRecentAuthorCommit(
              repo.full_name,
              options.token,
              sinceIso,
              author
            );
            if (hasCommit) break;
          }
          return { repo, hasCommit };
        });
        repos = repoChecks.filter((item) => item.hasCommit).map((item) => item.repo);
      }
    }

    const cloneResult = await analyzeWithClone({
      repos,
      token: options.token,
      pastWeek: Boolean(options.pastWeek),
      cloneConcurrency,
      tmpDir: options.tmpDir,
      sinceIso: sinceIso,
      linguistEngine,
      authorPatterns,
      cacheDir: options.cacheDir,
      disableCache: options.noCache,
    });
    totals = cloneResult.totals;
    skippedRepositories = cloneResult.skippedRepositories;

    if (options.pastWeek && options.includeRepoComposition) {
      const compositionResult = await analyzeWithClone({
        repos,
        token: options.token,
        pastWeek: false,
        cloneConcurrency,
        tmpDir: options.tmpDir,
        linguistEngine,
        cacheDir: options.cacheDir,
        disableCache: options.noCache,
      });
      const compositionTotals = compositionResult.totals;
      applyLanguageFilters(compositionTotals, options.includeMarkdown, options.includeMarkupLangs);
      repoComposition = {
        totalBytes: Object.values(compositionTotals).reduce((sum, value) => sum + value, 0),
        languages: toSortedStats(compositionTotals, undefined),
      };
    }
  } else {
    totals = await fetchAllLanguages(repos, options.token);
  }

  applyLanguageFilters(totals, options.includeMarkdown, options.includeMarkupLangs);

  if (source === "clone" && options.pastWeek) {
    const weeklyTotalBytes = Object.values(totals).reduce((sum, value) => sum + value, 0);
    weeklyChurn = {
      totalBytes: weeklyTotalBytes,
      languages: toSortedStats(totals, undefined),
    };
  }
  const top = options.all ? undefined : (options.top ?? 10);
  const languages = toSortedStats(totals, top);
  const totalBytes = Object.values(totals).reduce((sum, value) => sum + value, 0);

  return {
    totalBytes,
    languages,
    generatedAt: new Date().toISOString(),
    repositoryCount: repos.length,
    includedForks: options.includeForks,
    includedArchived: options.includeArchived,
    includedMarkdown: options.includeMarkdown,
    excludedMarkupLanguages: !options.includeMarkupLangs,
    authorFilter,
    authorPatterns,
    analysisSource: source,
    analysisMethod: options.pastWeek && source === "clone" ? "changed_lines" : "repo_bytes",
    engine: source === "clone" ? "github-linguist" : undefined,
    repoComposition,
    weeklyChurn,
    skippedRepositories,
    window: windowMeta,
  };
}
