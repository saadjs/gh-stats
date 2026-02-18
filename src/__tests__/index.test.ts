import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLanguageStats } from "../index.js";

// Mock the github module
vi.mock("../github.js", () => ({
  listAllRepos: vi.fn(),
  fetchRepoLanguages: vi.fn(),
  fetchAuthenticatedIdentity: vi.fn(),
  repoHasRecentAuthorCommit: vi.fn(),
}));

// Mock clone analyzer
vi.mock("../analyzers/clone.js", () => ({
  analyzeWithClone: vi.fn(),
}));

import {
  fetchAuthenticatedIdentity,
  listAllRepos,
  fetchRepoLanguages,
  repoHasRecentAuthorCommit,
} from "../github.js";
import { analyzeWithClone } from "../analyzers/clone.js";

describe("getLanguageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repoHasRecentAuthorCommit).mockResolvedValue(true);
    vi.mocked(fetchAuthenticatedIdentity).mockResolvedValue({
      login: "saadjs",
      emails: ["saadjs@example.com"],
      id: 123,
      name: "Saad",
    });
  });

  it("should calculate language stats from repositories", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
      {
        name: "repo2",
        full_name: "user/repo2",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo2/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 50000,
      JavaScript: 30000,
    });
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 40000,
      Python: 25000,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    expect(result).toBeDefined();
    expect(result.totalBytes).toBe(145000);
    expect(result.repositoryCount).toBe(2);
    expect(result.languages).toHaveLength(3);
    expect(result.languages[0].language).toBe("TypeScript");
    expect(result.languages[0].bytes).toBe(90000);
    expect(result.includedForks).toBe(false);
    expect(result.includedArchived).toBe(true);
    expect(result.analysisSource).toBe("api");
    expect(result.analysisMethod).toBe("repo_bytes");
  });

  it("should handle empty repositories", async () => {
    vi.mocked(listAllRepos).mockResolvedValueOnce([]);

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    expect(result.totalBytes).toBe(0);
    expect(result.languages).toHaveLength(0);
    expect(result.repositoryCount).toBe(0);
  });

  it("should respect the top parameter", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 50000,
      JavaScript: 30000,
      Python: 20000,
      Rust: 15000,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      top: 2,
    });

    expect(result.languages).toHaveLength(2);
    expect(result.languages[0].language).toBe("TypeScript");
    expect(result.languages[1].language).toBe("JavaScript");
  });

  it("should calculate correct percentages", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 100,
      JavaScript: 100,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    expect(result.languages[0].percent).toBe(50);
    expect(result.languages[1].percent).toBe(50);
  });

  it("should generate valid ISO timestamp", async () => {
    vi.mocked(listAllRepos).mockResolvedValueOnce([]);

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    const timestamp = new Date(result.generatedAt);
    expect(timestamp.getTime()).not.toBeNaN();
  });

  it("should exclude Markdown and MDX by default", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 100,
      Markdown: 200,
      MDX: 50,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    expect(result.languages).toHaveLength(1);
    expect(result.languages[0].language).toBe("TypeScript");
    expect(result.totalBytes).toBe(100);
  });

  it("should include Markdown and MDX when enabled", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 100,
      Markdown: 200,
      MDX: 50,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: true,
    });

    expect(result.languages).toHaveLength(3);
    expect(result.totalBytes).toBe(350);
  });

  it("should filter repos to past week when enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));

    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
      {
        name: "old",
        full_name: "user/old",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/old/languages",
        pushed_at: "2026-02-01T00:00:00Z",
      },
      {
        name: "nullpush",
        full_name: "user/nullpush",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/nullpush/languages",
        pushed_at: null,
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 123,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
    });

    expect(fetchRepoLanguages).toHaveBeenCalledTimes(1);
    expect(result.repositoryCount).toBe(1);
    expect(result.languages).toHaveLength(1);
    expect(result.languages[0].language).toBe("TypeScript");
    expect(result.window?.days).toBe(7);
    expect(result.window?.activityField).toBe("pushed_at");
    expect(result.analysisSource).toBe("api");
    expect(result.analysisMethod).toBe("repo_bytes");

    vi.useRealTimers();
  });

  it("should use clone analyzer for past-week churn", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchAuthenticatedIdentity).mockResolvedValueOnce({
      login: "saadjs",
      emails: ["saadjs@example.com"],
      id: 123,
      name: "Saad",
    });
    vi.mocked(repoHasRecentAuthorCommit).mockResolvedValueOnce(true);
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 42, Markdown: 100 },
      skippedRepositories: [],
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
    });

    expect(result.analysisSource).toBe("clone");
    expect(result.analysisMethod).toBe("changed_lines");
    expect(result.authorFilter).toBe("saadjs");
    expect(result.window?.activityField).toBe("changed_lines");
    expect(result.languages[0].language).toBe("TypeScript");
    expect(result.totalBytes).toBe(42);
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].authorPatterns).toContain("saadjs");
  });

  it("should filter clone mode repos to past-week by pushed_at before cloning", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));

    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
      {
        name: "old",
        full_name: "user/old",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/old/languages",
        pushed_at: "2026-02-01T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchAuthenticatedIdentity).mockResolvedValueOnce({
      login: "saadjs",
      emails: ["saadjs@example.com"],
      id: 123,
      name: "Saad",
    });
    vi.mocked(repoHasRecentAuthorCommit).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 10 },
      skippedRepositories: [],
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
    });

    expect(analyzeWithClone).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].repos).toHaveLength(1);
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].repos[0].full_name).toBe("user/recent");
    expect(result.repositoryCount).toBe(1);

    vi.useRealTimers();
  });

  it("should allow clone past-week with all authors when requested", async () => {
    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 10 },
      skippedRepositories: [],
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
      allAuthors: true,
    });

    expect(fetchAuthenticatedIdentity).not.toHaveBeenCalled();
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].authorPatterns).toBeUndefined();
    expect(result.authorFilter).toBeUndefined();
  });

  it("should prefilter clone repos using login and email author patterns", async () => {
    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchAuthenticatedIdentity).mockResolvedValueOnce({
      login: "saadjs",
      emails: ["saadjs@example.com"],
      id: 123,
      name: "Saad",
    });
    vi.mocked(repoHasRecentAuthorCommit).mockReset();
    vi.mocked(repoHasRecentAuthorCommit).mockImplementation(
      async (_fullName, _token, _sinceIso, author) => {
        return author === "saadjs@example.com";
      }
    );
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 10 },
      skippedRepositories: [],
    });

    await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
    });

    expect(vi.mocked(repoHasRecentAuthorCommit).mock.calls.map((call) => call[3])).toContain(
      "saadjs"
    );
    expect(vi.mocked(repoHasRecentAuthorCommit).mock.calls.map((call) => call[3])).toContain(
      "saadjs@example.com"
    );
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].repos).toHaveLength(1);
  });

  it("should keep prefilter and churn author patterns aligned", async () => {
    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchAuthenticatedIdentity).mockResolvedValueOnce({
      login: "saadjs",
      emails: ["saadjs@example.com"],
      id: 123,
      name: "Saad Bash",
    });
    vi.mocked(repoHasRecentAuthorCommit).mockResolvedValue(true);
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 10 },
      skippedRepositories: [],
    });

    await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
    });

    expect(vi.mocked(repoHasRecentAuthorCommit).mock.calls.map((call) => call[3])).toEqual([
      "saadjs",
    ]);
    expect(vi.mocked(analyzeWithClone).mock.calls[0]?.[0].authorPatterns).toEqual([
      "saadjs",
      "saadjs@example.com",
    ]);
  });

  it("should exclude JSON and YAML by default unless includeMarkupLangs is enabled", async () => {
    const mockRepos = [
      {
        name: "repo1",
        full_name: "user/repo1",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/repo1/languages",
        pushed_at: "2026-02-10T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 100,
      JSON: 200,
      YAML: 300,
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
    });

    expect(result.languages).toHaveLength(1);
    expect(result.languages[0].language).toBe("TypeScript");

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(fetchRepoLanguages).mockResolvedValueOnce({
      TypeScript: 100,
      JSON: 200,
      YAML: 300,
    });

    const withMarkup = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      includeMarkupLangs: true,
    });

    expect(withMarkup.languages.map((l) => l.language)).toContain("JSON");
    expect(withMarkup.languages.map((l) => l.language)).toContain("YAML");
  });

  it("should attach repoComposition when includeRepoComposition is enabled in clone past-week mode", async () => {
    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(analyzeWithClone)
      .mockResolvedValueOnce({
        totals: { TypeScript: 10 },
        skippedRepositories: [],
      })
      .mockResolvedValueOnce({
        totals: { TypeScript: 100, Go: 50 },
        skippedRepositories: [],
      });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      pastWeek: true,
      source: "clone",
      includeRepoComposition: true,
    });

    expect(result.weeklyChurn?.totalBytes).toBe(10);
    expect(result.repoComposition?.totalBytes).toBe(150);
    expect(result.repoComposition?.languages[0].language).toBe("TypeScript");
  });

  it("should apply markdown and markup filters to weeklyChurn in clone past-week mode", async () => {
    const mockRepos = [
      {
        name: "recent",
        full_name: "user/recent",
        fork: false,
        archived: false,
        private: false,
        languages_url: "https://api.github.com/repos/user/recent/languages",
        pushed_at: "2026-02-14T00:00:00Z",
      },
    ];

    vi.mocked(listAllRepos).mockResolvedValueOnce(mockRepos);
    vi.mocked(analyzeWithClone).mockResolvedValueOnce({
      totals: { TypeScript: 10, Markdown: 5, JSON: 7, YAML: 2 },
      skippedRepositories: [],
    });

    const result = await getLanguageStats({
      token: "test-token",
      includeForks: false,
      includeArchived: true,
      includeMarkdown: false,
      includeMarkupLangs: false,
      pastWeek: true,
      source: "clone",
    });

    expect(result.weeklyChurn?.totalBytes).toBe(10);
    expect(result.weeklyChurn?.languages.map((entry) => entry.language)).toEqual(["TypeScript"]);
  });
});
