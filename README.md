# gh-stats

Generate GitHub language stats as JSON or a simple SVG bar chart.

## Requirements

- Node.js 18+ (for built-in `fetch`)
- A GitHub token with access to private repositories if needed

## Setup

```bash
pnpm install
pnpm run build
```

## Usage

## Install CLI command

Build first, then link globally or install from the local path.

```bash
pnpm run build
pnpm link --global
```

Or:

```bash
pnpm run build
pnpm add -g .
```

### JSON (default)

```bash
GITHUB_TOKEN=your_token gh-stats
```

### SVG

```bash
GITHUB_TOKEN=your_token gh-stats --svg --out stats.svg
```

### Cache JSON once, render SVG offline

Generate the JSON once, then re-render SVGs with different themes without hitting the GitHub API.

```bash
GITHUB_TOKEN=your_token gh-stats --json --out data.json
```

```bash
gh-stats --svg --theme phosphor --in data.json --out stats.svg
gh-stats --svg --theme infrared --in data.json --out stats.svg
gh-stats --svg --theme pie --in data.json --out stats.svg
```

## Keeping stats updated (profile README)

Use a scheduled GitHub Actions workflow to regenerate `stats.svg` and commit it back to the
profile README repo (`<username>/<username>`).

<details>

<summary>Example workflow setup</summary>

Create `.github/workflows/update-stats.yml` in the profile repo:

```yaml
name: Update GH Stats

on:
  schedule:
    - cron: "0 6 * * *" # daily at 06:00 UTC
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install
      - run: pnpm run build
      - run: GITHUB_TOKEN=${{ secrets.GH_TOKEN || secrets.GITHUB_TOKEN }} gh-stats --svg --out stats.svg

      - run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add stats.svg
            git commit -m "chore: update language stats"
            git push
          fi
```

</details>

Notes:

- For public-only stats, `GITHUB_TOKEN` is enough.
- For private repos, add a PAT as `GH_TOKEN` in repo secrets (with `repo` scope).
- Embed the SVG in your profile `README.md` with `![GitHub language stats](./stats.svg)`.

### Options

- `--format <json|svg>` choose output format
- `--json` output JSON
- `--svg` output SVG
- `--in <path>` read precomputed stats JSON (skips GitHub API)
- `--include-forks` include forked repositories (default: excluded)
- `--exclude-archived` exclude archived repositories (default: included)
- `--include-markdown` include Markdown/MDX in language stats (default: excluded)
- `--top <n>` limit to top N languages (default: 10)
- `--all` include all languages (overrides `--top`)
- `--out <path>` write output to a file

## Token scopes

For private repos, use a token with `repo` scope. For public-only, `public_repo` is enough.

## Testing

```bash
pnpm test
```

## Notes

GitHub’s API reports language byte totals per repository, not per-user LOC. Per-user attribution requires cloning and analyzing repositories locally.
