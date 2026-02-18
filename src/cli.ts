/// <reference types="node" />
import fs from "fs";
import path from "path";
import { getLanguageStats } from "./index.js";
import { renderJson, renderSvg, type ThemeName } from "./renderers/index.js";
import type { LanguageStatsResult } from "./types.js";

interface CliOptions {
  token?: string;
  input?: string;
  format: "json" | "svg";
  includeForks: boolean;
  includeArchived: boolean;
  includeMarkdown: boolean;
  pastWeek?: boolean;
  top?: number;
  all?: boolean;
  out?: string;
  theme?: ThemeName;
  source: "api" | "clone";
  cloneConcurrency: number;
  tmpDir?: string;
  linguistEngine: "local" | "docker";
  author?: string;
  allAuthors: boolean;
  includeMarkupLangs: boolean;
  includeRepoComposition: boolean;
  cacheDir?: string;
  noCache: boolean;
}

function printHelp(): void {
  const help = `
Usage: gh-stats [options]

Options:
  --token <token>         GitHub access token (or use GITHUB_TOKEN)
  --in <path>             Read precomputed stats JSON (skips GitHub API)
  --format <json|svg>     Output format (default: json)
  --json                  Output JSON format
  --svg                   Output SVG format
  --theme <name>          SVG theme: default, phosphor, infrared, outline, pie (default: default)
  --source <api|clone>    Analysis source (default: api)
  --clone-concurrency <n> Max concurrent clones in clone mode (default: 3)
  --tmp-dir <path>        Temp directory for clone mode (default: OS temp dir)
  --linguist-engine <val> Linguist engine: local, docker (default: local)
  --author <username>     Author username to filter past-week commit churn
  --all-authors           Include all authors in past-week clone analysis
  --include-forks         Include forked repositories
  --exclude-archived      Exclude archived repositories
  --include-markdown      Include Markdown/MDX in language stats
  --include-markup-langs  Include markup/config languages (JSON/YAML/HTML/XML/etc.)
  --include-repo-composition Include full repo composition alongside weekly churn (clone + past-week)
  --cache-dir <path>      Cache directory for cloned repositories
  --no-cache              Disable clone cache
  --past-week             Past 7-day activity (filters to repos pushed in last 7 days)
  --top <number>          Limit to top N languages (default: 10)
  --all                   Include all languages (overrides --top)
  --out <path>            Write output to a file
  --help                  Show this help message

Themes:
  default     Clean, modern light theme
  phosphor    Retro CRT terminal with green phosphor glow
  infrared    Thermal heat map visualization
  outline     Minimalist stroke-only design
  pie         Warm donut chart with top 5 + other grouping

Examples:
  npx @saadjs/gh-stats --svg --out stats.svg
  gh-stats --svg --out stats.svg
  gh-stats --svg --theme phosphor --out stats.svg
  gh-stats --svg --theme infrared --out stats.svg
  gh-stats --svg --theme pie --out stats.svg
  gh-stats --format json --top 8
  gh-stats --past-week --svg --out stats.svg
  gh-stats --json --out data.json
  gh-stats --svg --theme phosphor --in data.json --out stats.svg
`;

  console.log(help.trim());
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    format: "json",
    includeForks: false,
    includeArchived: true,
    includeMarkdown: false,
    top: 10,
    source: "api",
    cloneConcurrency: 3,
    linguistEngine: "local",
    allAuthors: false,
    includeMarkupLangs: false,
    includeRepoComposition: false,
    noCache: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--token":
        options.token = argv[i + 1];
        i += 1;
        break;
      case "--in":
        options.input = argv[i + 1];
        i += 1;
        break;
      case "--format":
        options.format = (argv[i + 1] as CliOptions["format"]) ?? "json";
        i += 1;
        break;
      case "--json":
        options.format = "json";
        break;
      case "--svg":
        options.format = "svg";
        break;
      case "--include-forks":
        options.includeForks = true;
        break;
      case "--exclude-archived":
        options.includeArchived = false;
        break;
      case "--include-markdown":
        options.includeMarkdown = true;
        break;
      case "--past-week":
        options.pastWeek = true;
        break;
      case "--top":
        options.top = Number(argv[i + 1]);
        options.all = false;
        i += 1;
        break;
      case "--all":
        options.all = true;
        options.top = undefined;
        break;
      case "--out":
        options.out = argv[i + 1];
        i += 1;
        break;
      case "--theme":
        options.theme = argv[i + 1] as ThemeName;
        i += 1;
        break;
      case "--source":
        options.source = (argv[i + 1] as CliOptions["source"]) ?? "api";
        i += 1;
        break;
      case "--clone-concurrency":
        options.cloneConcurrency = Number(argv[i + 1]);
        i += 1;
        break;
      case "--tmp-dir":
        options.tmpDir = argv[i + 1];
        i += 1;
        break;
      case "--linguist-engine":
        options.linguistEngine = (argv[i + 1] as CliOptions["linguistEngine"]) ?? "local";
        i += 1;
        break;
      case "--author":
        options.author = argv[i + 1];
        i += 1;
        break;
      case "--all-authors":
        options.allAuthors = true;
        break;
      case "--include-markup-langs":
        options.includeMarkupLangs = true;
        break;
      case "--exclude-markup-langs":
        options.includeMarkupLangs = false;
        break;
      case "--include-repo-composition":
        options.includeRepoComposition = true;
        break;
      case "--cache-dir":
        options.cacheDir = argv[i + 1];
        i += 1;
        break;
      case "--no-cache":
        options.noCache = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function validateOptions(options: CliOptions): void {
  if (options.source !== "api" && options.source !== "clone") {
    console.error(`Unknown --source value: ${options.source}`);
    printHelp();
    process.exit(1);
  }

  if (options.linguistEngine !== "local" && options.linguistEngine !== "docker") {
    console.error(`Unknown --linguist-engine value: ${options.linguistEngine}`);
    printHelp();
    process.exit(1);
  }

  if (!Number.isInteger(options.cloneConcurrency) || options.cloneConcurrency <= 0) {
    console.error("--clone-concurrency must be a positive integer.");
    printHelp();
    process.exit(1);
  }
}

function isLanguageStatsResult(value: unknown): value is LanguageStatsResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.totalBytes === "number" &&
    Array.isArray(record.languages) &&
    typeof record.generatedAt === "string" &&
    typeof record.repositoryCount === "number" &&
    typeof record.includedForks === "boolean" &&
    typeof record.includedArchived === "boolean" &&
    typeof record.includedMarkdown === "boolean"
  );
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);
  validateOptions(options);
  let stats: LanguageStatsResult;

  if (options.input) {
    const inPath = path.resolve(process.cwd(), options.input);
    try {
      const raw = fs.readFileSync(inPath, "utf8");
      const parsed = JSON.parse(raw);

      if (!isLanguageStatsResult(parsed)) {
        console.error(`Invalid stats JSON in ${inPath}`);
        process.exit(1);
      }

      stats = parsed;
    } catch (error) {
      console.error(`Failed to read stats JSON from ${inPath}`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

    if (!token) {
      console.error("Missing GitHub token. Use --token or set GITHUB_TOKEN.");
      process.exit(1);
    }

    stats = await getLanguageStats({
      token,
      includeForks: options.includeForks,
      includeArchived: options.includeArchived,
      includeMarkdown: options.includeMarkdown,
      pastWeek: options.pastWeek,
      top: options.top,
      all: options.all,
      source: options.source,
      cloneConcurrency: options.cloneConcurrency,
      tmpDir: options.tmpDir,
      linguistEngine: options.linguistEngine,
      author: options.author,
      allAuthors: options.allAuthors,
      includeMarkupLangs: options.includeMarkupLangs,
      includeRepoComposition: options.includeRepoComposition,
      cacheDir: options.cacheDir,
      noCache: options.noCache,
    });
  }

  const output =
    options.format === "svg" ? renderSvg(stats, { theme: options.theme }) : renderJson(stats);

  if (options.out) {
    const outPath = path.resolve(process.cwd(), options.out);
    fs.writeFileSync(outPath, output, "utf8");
    console.log(`Wrote ${options.format.toUpperCase()} to ${outPath}`);
  } else {
    process.stdout.write(output + "\n");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
