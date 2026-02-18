import { describe, expect, it, vi } from "vitest";
import * as cloneAnalyzer from "../analyzers/clone.js";

const baseRepo = {
  fork: false,
  archived: false,
  private: false,
  languages_url: "https://api.github.com/repos/org/repo/languages",
  pushed_at: null,
};

describe("clone analyzer helpers", () => {
  it("parses linguist JSON into language bytes", () => {
    const json = JSON.stringify({
      TypeScript: 120,
      JavaScript: { size: 50 },
      Python: { bytes: 30 },
      Unknown: "skip",
    });

    const result = cloneAnalyzer.parseLinguistJsonToLanguageBytes(json);
    expect(result).toEqual({ TypeScript: 120, JavaScript: 50, Python: 30 });
  });

  it("normalizes git rename paths", () => {
    expect(cloneAnalyzer.normalizeGitPath("src/{old => new}/index.ts")).toBe("src/new/index.ts");
    expect(cloneAnalyzer.normalizeGitPath("docs/README.md")).toBe("docs/README.md");
  });

  it("parses git numstat output into churn totals", () => {
    const output = [
      "10\t2\tsrc/{old => new}/index.ts",
      "5\t0\tdocs/README.md",
      "1\t1\tsrc/{old => new}/index.ts",
      "",
    ].join("\n");

    const result = cloneAnalyzer.parseNumstatOutput(output);
    expect(result).toEqual({
      "src/new/index.ts": 14,
      "docs/README.md": 5,
    });
  });

  it("filters churn by author patterns when parsing log output", () => {
    const output = [
      "@@@abc\tSaad Bash\tsaad@example.com",
      "10\t2\tsrc/app.ts",
      "@@@def\tOther User\tother@example.com",
      "5\t1\tsrc/other.ts",
      "",
    ].join("\n");

    const filtered = cloneAnalyzer.parseNumstatOutputForAuthors(output, ["saad@example.com"]);
    expect(filtered["src/app.ts"]).toBe(12);
    expect(filtered["src/other.ts"]).toBeUndefined();
  });
});

describe("analyzeWithClone", () => {
  it("continues when a repository analysis fails", async () => {
    const analyzeRepoPastWeekFn = async (repo: typeof baseRepo & { full_name: string }) => {
      if (repo.full_name === "org/b") {
        throw new Error("boom");
      }
      return { TypeScript: 10 };
    };

    const result = await cloneAnalyzer.analyzeWithClone({
      repos: [
        { ...baseRepo, name: "a", full_name: "org/a" },
        { ...baseRepo, name: "b", full_name: "org/b" },
      ],
      token: "token",
      pastWeek: true,
      cloneConcurrency: 2,
      sinceIso: "2026-02-10T00:00:00Z",
      ensureDependencies: async () => {},
      analyzeRepoPastWeekFn: analyzeRepoPastWeekFn as typeof cloneAnalyzer.analyzeRepoPastWeek,
    });

    expect(result.totals).toEqual({ TypeScript: 10 });
    expect(result.skippedRepositories).toHaveLength(1);
    expect(result.skippedRepositories[0].fullName).toBe("org/b");
    expect(result.skippedRepositories[0].reason).toContain("boom");
  });

  it("forwards author filter to past-week analyzer", async () => {
    const pastWeekSpy = vi.fn().mockResolvedValue({ TypeScript: 5 });

    await cloneAnalyzer.analyzeWithClone({
      repos: [{ ...baseRepo, name: "a", full_name: "org/a" }],
      token: "token",
      pastWeek: true,
      cloneConcurrency: 1,
      sinceIso: "2026-02-10T00:00:00Z",
      authorPatterns: ["saadjs", "saadjs@example.com"],
      ensureDependencies: async () => {},
      analyzeRepoPastWeekFn: pastWeekSpy,
    });

    expect(pastWeekSpy).toHaveBeenCalledTimes(1);
    expect(pastWeekSpy.mock.calls[0]?.[4]).toContain("saadjs");
  });
});
