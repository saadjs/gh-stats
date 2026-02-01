#!/usr/bin/env node
/// <reference types="node" />
import fs from "fs";
import path from "path";
import { getLanguageStats } from "./index.js";
import { renderJson, renderSvg, type ThemeName } from "./renderers/index.js";

interface CliOptions {
  token?: string;
  format: "json" | "svg";
  includeForks: boolean;
  includeArchived: boolean;
  includeMarkdown: boolean;
  top?: number;
  all?: boolean;
  out?: string;
  theme?: ThemeName;
}

function printHelp(): void {
  const help = `
Usage: gh-stats [options]

Options:
  --token <token>         GitHub access token (or use GITHUB_TOKEN)
  --format <json|svg>     Output format (default: json)
  --json                  Output JSON format
  --svg                   Output SVG format
  --theme <name>          SVG theme: default, phosphor, infrared (default: default)
  --include-forks         Include forked repositories
  --exclude-archived      Exclude archived repositories
  --include-markdown      Include Markdown/MDX in language stats
  --top <number>          Limit to top N languages (default: 10)
  --all                   Include all languages (overrides --top)
  --out <path>            Write output to a file
  --help                  Show this help message

Themes:
  default     Clean, modern light theme
  phosphor    Retro CRT terminal with green phosphor glow
  infrared    Thermal heat map visualization
  outline     Minimalist stroke-only design

Examples:
  gh-stats --svg --out stats.svg
  gh-stats --svg --theme phosphor --out stats.svg
  gh-stats --svg --theme infrared --out stats.svg
  gh-stats --format json --top 8
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

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  if (!token) {
    console.error("Missing GitHub token. Use --token or set GITHUB_TOKEN.");
    process.exit(1);
  }

  const stats = await getLanguageStats({
    token,
    includeForks: options.includeForks,
    includeArchived: options.includeArchived,
    includeMarkdown: options.includeMarkdown,
    top: options.top,
    all: options.all,
  });

  const output = options.format === "svg" ? renderSvg(stats, { theme: options.theme }) : renderJson(stats);

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
