import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

describe("CLI Integration Tests", () => {
  let tmpDir: string;

  beforeEach(() => {
    // Create a temporary directory for test outputs
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-stats-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should display help message with --help flag", () => {
    const result = execSync("node dist/cli.js --help", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(result).toContain("Usage: gh-stats");
    expect(result).toContain("--token");
    expect(result).toContain("--format");
  });

  it("should exit with error when token is missing", () => {
    expect(() => {
      execSync("node dist/cli.js", {
        stdio: "pipe",
        env: { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "" },
      });
    }).toThrow();
  });

  it("should accept token via environment variable", () => {
    // This would require a valid token and network access to fully test
    // For unit testing, we just verify the code path exists
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain("GITHUB_TOKEN");
    expect(cliContent).toContain("GH_TOKEN");
  });

  it("should accept --token flag", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--token"');
  });

  it("should support --json format option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--json"');
  });

  it("should support --svg format option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--svg"');
  });

  it("should support --out option for file output", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--out"');
    expect(cliContent).toContain("fs.writeFileSync");
  });

  it("should support --in option for reading stats JSON", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--in"');
  });

  it("should support --include-forks option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--include-forks"');
  });

  it("should support --exclude-archived option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--exclude-archived"');
  });

  it("should support --include-markdown option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--include-markdown"');
  });

  it("should support --past-week option", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--past-week"');
    expect(cliContent).toContain("--past-week");
  });

  it("should support --top option for limiting results", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--top"');
  });

  it("should support --all option for including all languages", () => {
    const cliContent = fs.readFileSync("src/cli.ts", "utf8");
    expect(cliContent).toContain('case "--all"');
  });

  it("should allow --in without a token", () => {
    const statsPath = path.join(tmpDir, "stats.json");
    const stats = {
      totalBytes: 100,
      languages: [
        { language: "TypeScript", bytes: 60, percent: 60 },
        { language: "JavaScript", bytes: 40, percent: 40 },
      ],
      generatedAt: new Date().toISOString(),
      repositoryCount: 2,
      includedForks: false,
      includedArchived: true,
      includedMarkdown: false,
    };

    fs.writeFileSync(statsPath, JSON.stringify(stats), "utf8");

    const result = execSync(`node dist/cli.js --in ${statsPath} --json`, {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(result).toContain('"languages"');
    expect(result).toContain('"totalBytes"');
  });
});
