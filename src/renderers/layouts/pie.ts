import type { LanguageStat, LanguageStatsResult } from "../../types.js";
import type { Theme } from "../types.js";

function buildPieRows(stats: LanguageStatsResult): LanguageStat[] {
  const rows = stats.languages;
  const topRows = rows.slice(0, 5);
  const topBytes = topRows.reduce((sum, row) => sum + row.bytes, 0);
  const remainingBytes = Math.max(stats.totalBytes - topBytes, 0);
  const hasOther = remainingBytes > 0;

  if (!hasOther) {
    return topRows;
  }

  const otherPercent = stats.totalBytes === 0 ? 0 : (remainingBytes / stats.totalBytes) * 100;

  return [
    ...topRows,
    {
      language: "Other",
      bytes: remainingBytes,
      percent: otherPercent,
    },
  ];
}

export function renderPieLayout(stats: LanguageStatsResult, theme: Theme, width: number): string {
  const {
    palette,
    background,
    backgroundSecondary,
    headerColor,
    labelColor,
    footerColor,
    borderColor,
    fontFamily,
    fontImport,
    borderRadius,
  } = theme;

  const height = 360;
  const rows = buildPieRows(stats);
  const totalBytes = stats.totalBytes;

  const centerX = 185;
  const centerY = 195;
  const outerRadius = 110;
  const innerRadius = 55;

  const legendX = 360;
  const legendY = 90;
  const legendGap = 24;

  let currentAngle = -90;
  const segments = rows.map((row, index) => {
    const angle = totalBytes === 0 ? 0 : (row.bytes / totalBytes) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + outerRadius * Math.cos(startRad);
    const y1 = centerY + outerRadius * Math.sin(startRad);
    const x2 = centerX + outerRadius * Math.cos(endRad);
    const y2 = centerY + outerRadius * Math.sin(endRad);

    const x3 = centerX + innerRadius * Math.cos(endRad);
    const y3 = centerY + innerRadius * Math.sin(endRad);
    const x4 = centerX + innerRadius * Math.cos(startRad);
    const y4 = centerY + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;
    const path =
      `M ${x1} ${y1} ` +
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} ` +
      `L ${x3} ${y3} ` +
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      ...row,
      path,
      color: palette[index % palette.length],
    };
  });

  const segmentsSvg =
    segments.length > 0
      ? segments
          .map(
            (seg) =>
              `<path d="${seg.path}" fill="${seg.color}" stroke="${backgroundSecondary}" stroke-width="1" />`
          )
          .join("")
      : `<circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" fill="${backgroundSecondary}" stroke="${borderColor}" stroke-width="1" />`;

  const legendSvg =
    rows.length > 0
      ? rows
          .map((row, index) => {
            const y = legendY + index * legendGap;
            const color = palette[index % palette.length];
            return `
    <circle cx="${legendX}" cy="${y - 5}" r="5" fill="${color}" />
    <text x="${legendX + 14}" y="${y}" font-size="12" fill="${labelColor}">${row.language}</text>
    <text x="${width - 24}" y="${y}" font-size="12" fill="${headerColor}" text-anchor="end">${row.percent.toFixed(1)}%</text>`;
          })
          .join("")
      : `
    <text x="${legendX}" y="${legendY}" font-size="12" fill="${labelColor}">No language data</text>`;

  const header = "Top Languages";
  const repoSummary = `${stats.repositoryCount} repos`;
  const statSummary = `${rows.length} slices`;
  const generatedDate = new Date(stats.generatedAt).toISOString().split("T")[0];
  const footer = `Generated ${generatedDate}`;
  const windowLabel = stats.window ? `Past ${stats.window.days} days` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats">
  <style>
    ${fontImport ?? ""}
    text { font-family: ${fontFamily}; }
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}" />
      <stop offset="100%" stop-color="${backgroundSecondary}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="${borderRadius}" />
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" fill="none" stroke="${borderColor}" stroke-width="1" rx="${borderRadius - 4}" />

  <text x="24" y="34" font-size="16" fill="${labelColor}" font-weight="600">${header}</text>
  <text x="${width - 24}" y="34" font-size="11" fill="${headerColor}" text-anchor="end">${repoSummary} • ${statSummary}</text>
  ${windowLabel ? `<text x="24" y="54" font-size="11" fill="${footerColor}">${windowLabel}</text>` : ""}

  ${segmentsSvg}
  <circle cx="${centerX}" cy="${centerY}" r="${innerRadius - 6}" fill="${background}" />
  <text x="${centerX}" y="${centerY - 4}" font-size="14" fill="${labelColor}" text-anchor="middle" font-weight="600">
    ${rows[0]?.language ?? "No data"}
  </text>
  <text x="${centerX}" y="${centerY + 14}" font-size="11" fill="${footerColor}" text-anchor="middle">
    ${rows[0]?.percent?.toFixed(1) ?? "0.0"}%
  </text>

  <text x="${legendX}" y="${legendY - 26}" font-size="11" fill="${footerColor}" letter-spacing="1">DISTRIBUTION</text>
  ${legendSvg}

  <text x="24" y="${height - 16}" font-size="10" fill="${footerColor}">${footer}</text>
</svg>`;
}
