import type { FetchOptions, LanguageBytes, RepoSummary } from "./types.js";

const API_BASE = "https://api.github.com";

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "gh-stats",
  "X-GitHub-Api-Version": "2022-11-28",
};

interface PageResult<T> {
  items: T[];
  nextUrl?: string;
}

function getAuthHeaders(token: string): Record<string, string> {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

function parseNextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match && match[2] === "next") {
      return match[1];
    }
  }
  return undefined;
}

async function fetchPage<T>(url: string, token: string): Promise<PageResult<T>> {
  const { data: items, headers } = await fetchJson<T[]>(url, token);
  const nextUrl = parseNextLink(headers.get("link"));
  return { items, nextUrl };
}

async function fetchJson<T>(url: string, token: string): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(url, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

export async function listAllRepos(options: FetchOptions): Promise<RepoSummary[]> {
  const params = new URLSearchParams({
    per_page: "100",
    visibility: "all",
    affiliation: "owner,collaborator,organization_member",
  });
  let url = `${API_BASE}/user/repos?${params.toString()}`;
  const repos: RepoSummary[] = [];

  while (url) {
    const { items, nextUrl } = await fetchPage<RepoSummary>(url, options.token);
    repos.push(...items);
    url = nextUrl ?? "";
  }

  return repos.filter((repo) => {
    if (!options.includeForks && repo.fork) return false;
    if (!options.includeArchived && repo.archived) return false;
    return true;
  });
}

export async function fetchRepoLanguages(
  languagesUrl: string,
  token: string
): Promise<LanguageBytes> {
  const { data } = await fetchJson<LanguageBytes>(languagesUrl, token);
  return data;
}
