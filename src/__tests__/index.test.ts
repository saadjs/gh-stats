import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLanguageStats } from "../index.js";

// Mock the github module
vi.mock("../github.js", () => ({
  listAllRepos: vi.fn(),
  fetchRepoLanguages: vi.fn(),
}));

import { listAllRepos, fetchRepoLanguages } from "../github.js";

describe("getLanguageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    vi.useRealTimers();
  });
});
