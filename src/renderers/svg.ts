import type { LanguageStatsResult } from "../types.js";
import type { SvgOptions } from "./types.js";
import { themes } from "./themes.js";
import { renderPhosphorLayout } from "./layouts/phosphor.js";
import { renderInfraredLayout } from "./layouts/infrared.js";
import { renderOutlineLayout } from "./layouts/outline.js";
import { renderPieLayout } from "./layouts/pie.js";
import { formatActivityFieldLabel } from "./utils.js";

export function renderSvg(stats: LanguageStatsResult, options: SvgOptions = {}): string {
  const width = options.width ?? 600;
  const themeName = options.theme ?? "default";
  const theme = themes[themeName] ?? themes.default;

  // Use specialized layouts for each theme
  if (themeName === "phosphor") {
    return renderPhosphorLayout(stats, theme, width);
  }
  if (themeName === "infrared") {
    return renderInfraredLayout(stats, theme, width);
  }
  if (themeName === "outline") {
    return renderOutlineLayout(stats, theme, width);
  }
  if (themeName === "pie") {
    return renderPieLayout(stats, theme, width);
  }

  // Default theme: clean bar chart layout
  const barHeight = options.barHeight ?? 18;
  const gap = options.gap ?? 10;
  const labelWidth = options.labelWidth ?? 140;

  const {
    palette,
    background,
    backgroundSecondary,
    headerColor,
    labelColor,
    footerColor,
    borderColor,
    barTrackColor,
    fontFamily,
    borderRadius,
  } = theme;

  const rows = stats.languages;
  const paddingX = 16;
  const rightPadding = 16;
  const headerHeight = 28;
  const chartTop = paddingX + headerHeight + 8;
  const footerHeight = 26;
  const chartWidth = width - labelWidth - paddingX - rightPadding;
  const height = chartTop + rows.length * (barHeight + gap) + footerHeight;
  const maxPercent = Math.max(...rows.map((row) => row.percent), 0);

  const header = "GitHub Language Stats";
  const generatedDate = stats.generatedAt.slice(0, 10);
  const subheader = stats.window
    ? `Past ${stats.window.days} days • ${formatActivityFieldLabel(
        stats.window.activityField
      )} • Generated ${generatedDate}`
    : `Generated ${generatedDate}`;
  const repoSummary = `${stats.repositoryCount} repos`;
  const footerParts = [
    stats.includedForks ? "Forks included" : "Forks excluded",
    stats.includedArchived ? "Archived included" : "Archived excluded",
    stats.includedMarkdown ? "Markdown included" : "Markdown excluded",
  ];
  const footer = footerParts.join(" • ");

  const bars = rows
    .map((row, index) => {
      const y = chartTop + index * (barHeight + gap);
      const barWidth = maxPercent === 0 ? 0 : (row.percent / maxPercent) * chartWidth;
      const label = `${row.language} (${row.percent.toFixed(1)}%)`;

      return `
  <text x="${paddingX}" y="${y + barHeight - 4}" font-size="12" fill="${labelColor}">${label}</text>
  <rect x="${paddingX + labelWidth}" y="${y}" width="${chartWidth}" height="${barHeight}" rx="6" fill="${barTrackColor}" />
  <rect x="${paddingX + labelWidth}" y="${y}" width="${barWidth.toFixed(2)}" height="${barHeight}" rx="6" fill="url(#bar-${index})" />
`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats">
  <style>
    text { font-family: ${fontFamily}; }
    .subtitle { letter-spacing: 0.2px; }
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}" />
      <stop offset="100%" stop-color="${backgroundSecondary}" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#111827" flood-opacity="0.08" />
    </filter>
    ${rows
      .map((_, index) => {
        const base = palette[index % palette.length];
        return `<linearGradient id="bar-${index}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${base}" />
      <stop offset="100%" stop-color="${base}CC" />
    </linearGradient>`;
      })
      .join("")}
  </defs>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="${borderRadius}" />
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="#ffffff" rx="12" filter="url(#softShadow)" />
  <rect x="8.5" y="8.5" width="${width - 17}" height="${height - 17}" fill="none" stroke="${borderColor}" rx="12" />
  <text x="${paddingX}" y="${paddingX + 6}" font-size="16" fill="${labelColor}" font-weight="600">${header}</text>
  <text x="${paddingX}" y="${paddingX + 24}" font-size="11" fill="${headerColor}" class="subtitle">${subheader}</text>
  <text x="${width - rightPadding}" y="${paddingX + 8}" font-size="11" fill="${headerColor}" text-anchor="end">${repoSummary}</text>
  ${bars}
  <text x="${paddingX}" y="${height - 12}" font-size="10" fill="${footerColor}">${footer}</text>
</svg>`;
}
