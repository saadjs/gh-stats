import type { LanguageStatsResult } from "./types.js";

export function renderJson(stats: LanguageStatsResult): string {
  return JSON.stringify(stats, null, 2);
}

interface SvgOptions {
  width?: number;
  barHeight?: number;
  gap?: number;
  labelWidth?: number;
  fontFamily?: string;
  background?: string;
  headerColor?: string;
  labelColor?: string;
  barColor?: string;
  borderColor?: string;
}

const palette = [
  "#6366F1",
  "#14B8A6",
  "#F97316",
  "#0EA5E9",
  "#F43F5E",
  "#22C55E",
  "#A855F7",
  "#EAB308",
  "#64748B",
  "#EC4899",
];

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[index]}`;
}

export function renderSvg(stats: LanguageStatsResult, options: SvgOptions = {}): string {
  const width = options.width ?? 600;
  const barHeight = options.barHeight ?? 18;
  const gap = options.gap ?? 10;
  const labelWidth = options.labelWidth ?? 140;
  const fontFamily =
    options.fontFamily ?? "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const background = options.background ?? "#ffffff";
  const headerColor = options.headerColor ?? "#6B7280";
  const labelColor = options.labelColor ?? "#111827";
  const barColor = options.barColor ?? "#4F46E5";
  const borderColor = options.borderColor ?? "#E5E7EB";

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
  const subheader = `Generated ${stats.generatedAt}`;
  const statSummary = `${formatBytes(stats.totalBytes)} total`;
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
      const barFill = palette[index % palette.length] ?? barColor;

      return `
  <text x="${paddingX}" y="${y + barHeight - 4}" font-size="12" fill="${labelColor}">${label}</text>
  <rect x="${paddingX + labelWidth}" y="${y}" width="${chartWidth}" height="${barHeight}" rx="6" fill="#EEF2FF" />
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
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#111827" flood-opacity="0.08" />
    </filter>
    ${rows
      .map((_, index) => {
        const base = palette[index % palette.length] ?? barColor;
        return `<linearGradient id="bar-${index}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${base}" />
      <stop offset="100%" stop-color="${base}CC" />
    </linearGradient>`;
      })
      .join("")}
  </defs>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" rx="14" />
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="#ffffff" rx="12" filter="url(#softShadow)" />
  <rect x="8.5" y="8.5" width="${width - 17}" height="${height - 17}" fill="none" stroke="${borderColor}" rx="12" />
  <text x="${paddingX}" y="${paddingX + 6}" font-size="16" fill="${labelColor}" font-weight="600">${header}</text>
  <text x="${paddingX}" y="${paddingX + 24}" font-size="11" fill="${headerColor}" class="subtitle">${subheader}</text>
  <text x="${width - rightPadding}" y="${paddingX + 8}" font-size="11" fill="${headerColor}" text-anchor="end">${repoSummary} • ${statSummary}</text>
  ${bars}
  <text x="${paddingX}" y="${height - 12}" font-size="10" fill="${headerColor}">${footer}</text>
</svg>`;
}
