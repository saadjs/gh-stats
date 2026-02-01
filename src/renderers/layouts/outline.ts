import type { LanguageStatsResult } from "../../types.js";
import type { Theme } from "../types.js";

export function renderOutlineLayout(
  stats: LanguageStatsResult,
  theme: Theme,
  width: number
): string {
  const { background, headerColor, labelColor, footerColor, borderColor, fontFamily, fontImport } = theme;
  const rows = stats.languages;
  const paddingX = 32;
  const paddingY = 32;
  const barHeight = 28;
  const gap = 16;
  const labelWidth = 100;
  const percentWidth = 50;
  const barAreaWidth = width - paddingX * 2 - labelWidth - percentWidth - 20;

  const chartTop = paddingY + 50;
  const height = chartTop + rows.length * (barHeight + gap) + paddingY + 20;
  const maxPercent = Math.max(...rows.map((row) => row.percent), 0);

  const bars = rows.map((row, index) => {
    const y = chartTop + index * (barHeight + gap);
    const barWidth = maxPercent === 0 ? 0 : (row.percent / maxPercent) * barAreaWidth;
    const barX = paddingX + labelWidth + 10;

    return `
    <text x="${paddingX}" y="${y + barHeight / 2 + 4}" font-size="13" fill="${labelColor}" font-weight="400">${row.language}</text>
    <rect x="${barX}" y="${y}" width="${barAreaWidth}" height="${barHeight}" fill="none" stroke="${borderColor}" stroke-width="1"/>
    <rect x="${barX}" y="${y}" width="${barWidth.toFixed(2)}" height="${barHeight}" fill="none" stroke="${labelColor}" stroke-width="2"/>
    <text x="${width - paddingX}" y="${y + barHeight / 2 + 4}" font-size="12" fill="${headerColor}" text-anchor="end">${row.percent.toFixed(1)}%</text>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats">
  <style>
    ${fontImport ?? ""}
    text { font-family: ${fontFamily}; }
  </style>

  <!-- Background -->
  <rect width="100%" height="100%" fill="${background}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${borderColor}" stroke-width="1"/>

  <!-- Header -->
  <text x="${paddingX}" y="${paddingY + 8}" font-size="11" fill="${headerColor}" font-weight="500" letter-spacing="1">LANGUAGE DISTRIBUTION</text>
  <line x1="${paddingX}" y1="${paddingY + 20}" x2="${width - paddingX}" y2="${paddingY + 20}" stroke="${borderColor}" stroke-width="1"/>
  <text x="${width - paddingX}" y="${paddingY + 8}" font-size="11" fill="${headerColor}" text-anchor="end">${stats.repositoryCount} repos</text>

  <!-- Bars -->
  ${bars}

  <!-- Footer -->
  <line x1="${paddingX}" y1="${height - paddingY - 8}" x2="${width - paddingX}" y2="${height - paddingY - 8}" stroke="${borderColor}" stroke-width="1"/>
  <text x="${paddingX}" y="${height - paddingY + 8}" font-size="10" fill="${footerColor}">${stats.generatedAt}</text>
</svg>`;
}
