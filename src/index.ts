import type {
  FetchOptions,
  LanguageBytes,
  LanguageStatsResult,
  LanguageStat,
  RepoSummary,
} from "./types.js";
import { fetchRepoLanguages, listAllRepos } from "./github.js";

interface AggregateOptions extends FetchOptions {
  top?: number;
  all?: boolean;
  pastWeek?: boolean;
}

const MARKDOWN_LANGUAGES = new Set(["Markdown", "MDX"]);

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
  let repos = await listAllRepos(options);
  let windowMeta: LanguageStatsResult["window"];

  if (options.pastWeek) {
    const days = 7;
    const nowMs = Date.now();
    const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000;

    repos = repos.filter((repo) => {
      const pushedAt = repo.pushed_at;
      if (!pushedAt) return false;
      const pushedMs = Date.parse(pushedAt);
      if (Number.isNaN(pushedMs)) return false;
      return pushedMs >= cutoffMs;
    });

    windowMeta = {
      days,
      since: new Date(cutoffMs).toISOString(),
      until: new Date(nowMs).toISOString(),
      activityField: "pushed_at",
    };
  }

  const totals = await fetchAllLanguages(repos, options.token);
  if (!options.includeMarkdown) {
    for (const language of MARKDOWN_LANGUAGES) {
      delete totals[language];
    }
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
    window: windowMeta,
  };
}
