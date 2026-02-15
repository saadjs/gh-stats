import type { LanguageStatsResult } from "../../types.js";
import type { Theme } from "../types.js";

export function renderPhosphorDefs(): string {
  return `
    <filter id="phosphorGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="crtFlicker">
      <feFlood flood-color="#33FF33" flood-opacity="0.03" result="flood"/>
      <feComposite in="flood" in2="SourceGraphic" operator="over"/>
    </filter>
    <pattern id="scanlines" patternUnits="userSpaceOnUse" width="4" height="4">
      <rect width="4" height="2" fill="rgba(0,0,0,0.2)"/>
    </pattern>
    <pattern id="gridPattern" patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" fill="none" stroke="#1A3D1A" stroke-width="0.5"/>
    </pattern>`;
}

export function renderPhosphorLayout(
  stats: LanguageStatsResult,
  theme: Theme,
  width: number
): string {
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
  const rows = stats.languages;
  const paddingX = 20;

  // Create terminal-style block visualization
  const blockWidth = 16;
  const blockHeight = 12;
  const blocksPerRow = Math.floor((width - paddingX * 2) / (blockWidth + 2));
  const totalBlocks = blocksPerRow * 6; // 6 rows of blocks

  // Calculate blocks per language
  const totalPercent = rows.reduce((sum, r) => sum + r.percent, 0);
  const languageBlocks = rows.map((row, i) => ({
    ...row,
    blocks: Math.max(1, Math.round((row.percent / totalPercent) * totalBlocks)),
    color: palette[i % palette.length],
  }));

  // Build block grid
  let blocksSvg = "";
  let currentBlock = 0;
  const blockStartY = 70;
  const blockStartX = paddingX;

  for (const lang of languageBlocks) {
    for (let b = 0; b < lang.blocks && currentBlock < totalBlocks; b++) {
      const row = Math.floor(currentBlock / blocksPerRow);
      const col = currentBlock % blocksPerRow;
      const x = blockStartX + col * (blockWidth + 2);
      const y = blockStartY + row * (blockHeight + 2);
      blocksSvg += `<rect x="${x}" y="${y}" width="${blockWidth}" height="${blockHeight}" fill="${lang.color}" filter="url(#phosphorGlow)">
        <animate attributeName="opacity" values="0.9;1;0.9" dur="${2 + Math.random()}s" repeatCount="indefinite"/>
      </rect>`;
      currentBlock++;
    }
  }

  // Calculate where blocks end
  const blockEndY = blockStartY + 6 * (blockHeight + 2) + 25;

  // Terminal text output style listing - just language and percentage
  const listStartY = blockEndY + 20;
  const listX = paddingX;

  const listingSvg = rows
    .map((row, i) => {
      const y = listStartY + i * 20;
      const color = palette[i % palette.length];
      const blockChar = "█";
      return `
    <text x="${listX}" y="${y}" font-size="12" fill="${color}" filter="url(#phosphorGlow)">${blockChar}${blockChar}</text>
    <text x="${listX + 30}" y="${y}" font-size="12" fill="${labelColor}" filter="url(#phosphorGlow)">${row.language}</text>
    <text x="${width - paddingX}" y="${y}" font-size="12" fill="${color}" filter="url(#phosphorGlow)" text-anchor="end">${row.percent.toFixed(1)}%</text>`;
    })
    .join("");

  // Footer stats
  const footerY = listStartY + rows.length * 20 + 20;
  const finalHeight = footerY + 25;
  const windowLine = stats.window ? `│ Past ${stats.window.days} days (pushed_at)` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${finalHeight}" viewBox="0 0 ${width} ${finalHeight}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats">
  <style>
    ${fontImport ?? ""}
    text { font-family: ${fontFamily}; }
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${backgroundSecondary}"/>
    </linearGradient>
    ${renderPhosphorDefs()}
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)" rx="${borderRadius}"/>
  <rect x="1" y="1" width="${width - 2}" height="${finalHeight - 2}" fill="none" stroke="${borderColor}" stroke-width="2" rx="${borderRadius}"/>
  <rect width="100%" height="100%" fill="url(#gridPattern)" rx="${borderRadius}" opacity="0.3"/>

  <!-- Header -->
  <text x="${paddingX}" y="28" font-size="14" fill="${headerColor}" font-weight="600" filter="url(#phosphorGlow)">┌─ LANG_STATS.EXE ───────────────────────────────────────────────┐</text>
  <text x="${paddingX}" y="50" font-size="11" fill="${labelColor}" filter="url(#phosphorGlow)">│ ${stats.repositoryCount} repositories scanned</text>
  ${
    windowLine
      ? `<text x="${paddingX}" y="64" font-size="11" fill="${labelColor}" filter="url(#phosphorGlow)">${windowLine}</text>`
      : ""
  }

  <!-- Blinking cursor -->
  <rect x="${width - paddingX - 20}" y="38" width="8" height="12" fill="${headerColor}">
    <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
  </rect>

  <!-- Memory blocks -->
  ${blocksSvg}

  <!-- Legend divider -->
  <text x="${paddingX}" y="${blockEndY}" font-size="11" fill="${footerColor}" filter="url(#phosphorGlow)">├─ DISTRIBUTION ─────────────────────────────────────────────────┤</text>

  <!-- Language listing -->
  ${listingSvg}

  <!-- Footer -->
  <text x="${paddingX}" y="${footerY}" font-size="10" fill="${footerColor}" filter="url(#phosphorGlow)">└─ ${stats.generatedAt} ─────────────────────────────────────────┘</text>

  <!-- Scanlines overlay -->
  <rect width="100%" height="100%" fill="url(#scanlines)" rx="${borderRadius}" pointer-events="none"/>
</svg>`;
}
