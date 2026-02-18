import type { LanguageStatsResult } from "../../types.js";
import type { Theme } from "../types.js";
import { formatActivityFieldLabel } from "../utils.js";

export function renderInfraredDefs(): string {
  return `
    <filter id="heatBloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="thermalGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="8" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="infraredBorder" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C4DFF"/>
      <stop offset="100%" stop-color="#FF4081"/>
    </linearGradient>
    <radialGradient id="scopeGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1A1525"/>
      <stop offset="70%" stop-color="#0D0D12"/>
      <stop offset="100%" stop-color="#08080C"/>
    </radialGradient>
    <linearGradient id="heatScale" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000033"/>
      <stop offset="20%" stop-color="#0066FF"/>
      <stop offset="40%" stop-color="#00FFFF"/>
      <stop offset="60%" stop-color="#00FF00"/>
      <stop offset="80%" stop-color="#FFFF00"/>
      <stop offset="100%" stop-color="#FF0000"/>
    </linearGradient>`;
}

export function renderInfraredLayout(
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
    fontFamily,
    fontImport,
    borderRadius,
  } = theme;
  const rows = stats.languages;
  const rowGap = 22;
  const panelTop = 70;
  const panelHeaderOffset = 30;
  const panelBottomPadding = 80;
  const minHeight = 420;
  const panelContentHeight =
    panelTop + panelHeaderOffset + Math.max(0, rows.length - 1) * rowGap + panelBottomPadding;
  const height = Math.max(minHeight, panelContentHeight);

  // Position pie chart on the left side
  const centerX = 180;
  const centerY = Math.round(height / 2);
  const maxRadius = 130;
  const minRadius = 40;

  // Create pie/donut segments with thermal coloring
  let currentAngle = -90; // Start from top
  const segments = rows.map((row, i) => {
    const angle = (row.percent / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Outer arc
    const x1 = centerX + maxRadius * Math.cos(startRad);
    const y1 = centerY + maxRadius * Math.sin(startRad);
    const x2 = centerX + maxRadius * Math.cos(endRad);
    const y2 = centerY + maxRadius * Math.sin(endRad);

    // Inner arc
    const x3 = centerX + minRadius * Math.cos(endRad);
    const y3 = centerY + minRadius * Math.sin(endRad);
    const x4 = centerX + minRadius * Math.cos(startRad);
    const y4 = centerY + minRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = `M ${x1} ${y1} A ${maxRadius} ${maxRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${minRadius} ${minRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      ...row,
      path,
      color: palette[i % palette.length],
    };
  });

  const segmentsSvg = segments
    .map(
      (seg, i) => `
    <path d="${seg.path}" fill="${seg.color}" filter="url(#heatBloom)" opacity="0.9">
      ${i === 0 ? '<animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite"/>' : ""}
    </path>`
    )
    .join("");

  // Concentric guide rings
  const rings = [60, 95, 130]
    .map(
      (r) =>
        `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="#2A2040" stroke-width="1" stroke-dasharray="4 4"/>`
    )
    .join("");

  // Crosshair
  const crosshair = `
    <line x1="${centerX - 150}" y1="${centerY}" x2="${centerX + 150}" y2="${centerY}" stroke="#3A3050" stroke-width="1"/>
    <line x1="${centerX}" y1="${centerY - 150}" x2="${centerX}" y2="${centerY + 150}" stroke="#3A3050" stroke-width="1"/>
    <circle cx="${centerX}" cy="${centerY}" r="5" fill="none" stroke="#FF4081" stroke-width="2">
      <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/>
    </circle>`;

  // Data readout panel (right side) - positioned clearly to the right
  const panelX = 340;
  const panelY = panelTop;
  const readoutSvg = rows
    .map((row, i) => {
      const y = panelY + panelHeaderOffset + i * rowGap;
      const color = palette[i % palette.length];
      return `
    <rect x="${panelX}" y="${y - 14}" width="4" height="18" fill="${color}" filter="url(#heatBloom)"/>
    <text x="${panelX + 14}" y="${y}" font-size="11" fill="${labelColor}">${row.language}</text>
    <text x="${width - 25}" y="${y}" font-size="11" fill="${color}" text-anchor="end" filter="url(#heatBloom)">${row.percent.toFixed(1)}%</text>`;
    })
    .join("");

  // Heat scale bar
  const scaleY = height - 45;
  const scaleWidth = width - 60;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats">
  <style>
    ${fontImport ?? ""}
    text { font-family: ${fontFamily}; }
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${backgroundSecondary}"/>
    </linearGradient>
    ${renderInfraredDefs()}
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)" rx="${borderRadius}"/>
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="url(#infraredBorder)" stroke-width="2" rx="${borderRadius - 2}"/>

  <!-- Header -->
  <text x="20" y="30" font-size="14" fill="${headerColor}" font-weight="600" letter-spacing="2">THERMAL ANALYSIS</text>
  <text x="20" y="48" font-size="10" fill="${footerColor}" letter-spacing="1">${stats.repositoryCount} repositories scanned</text>
  ${
    stats.window
      ? `<text x="20" y="62" font-size="10" fill="${footerColor}" letter-spacing="1">PAST ${stats.window.days} DAYS • ${formatActivityFieldLabel(
          stats.window.activityField
        )}</text>`
      : ""
  }

  <!-- Crosshair and rings -->
  ${crosshair}
  ${rings}

  <!-- Pie segments -->
  ${segmentsSvg}

  <!-- Center readout -->
  <circle cx="${centerX}" cy="${centerY}" r="${minRadius - 5}" fill="#0D0D12"/>
  <text x="${centerX}" y="${centerY - 5}" font-size="20" fill="${headerColor}" text-anchor="middle" font-weight="600" filter="url(#thermalGlow)">${rows[0]?.percent.toFixed(0) ?? 0}%</text>
  <text x="${centerX}" y="${centerY + 14}" font-size="10" fill="${footerColor}" text-anchor="middle">${rows[0]?.language ?? "N/A"}</text>

  <!-- Data panel on right -->
  <text x="${panelX}" y="${panelY + 10}" font-size="10" fill="${footerColor}" letter-spacing="1">DISTRIBUTION</text>
  ${readoutSvg}

  <!-- Heat scale -->
  <rect x="30" y="${scaleY}" width="${scaleWidth}" height="10" rx="2" fill="url(#heatScale)"/>
  <text x="30" y="${scaleY + 22}" font-size="8" fill="${footerColor}">0%</text>
  <text x="${30 + scaleWidth}" y="${scaleY + 22}" font-size="8" fill="${footerColor}" text-anchor="end">100%</text>

  <!-- Timestamp -->
  <text x="20" y="${height - 12}" font-size="9" fill="${footerColor}">${stats.generatedAt}</text>
</svg>`;
}
