import type { Theme } from "./types.js";

export const themes: Record<string, Theme> = {
  default: {
    name: "default",
    palette: [
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
    ],
    background: "#ffffff",
    backgroundSecondary: "#F8FAFC",
    headerColor: "#6B7280",
    labelColor: "#111827",
    footerColor: "#6B7280",
    borderColor: "#E5E7EB",
    barTrackColor: "#EEF2FF",
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    borderRadius: 14,
    effects: {},
    footerSeparator: " • ",
  },
  phosphor: {
    name: "phosphor",
    palette: [
      "#33FF33", // bright green
      "#FF6B35", // orange
      "#FFDD33", // yellow
      "#35A7FF", // blue
      "#FF35A7", // magenta/pink
      "#35FFDD", // cyan
      "#DD35FF", // purple
      "#A7FF35", // lime
      "#FF3535", // red
      "#35DDFF", // light blue
    ],
    background: "#0A0E0A",
    backgroundSecondary: "#0D120D",
    headerColor: "#33FF33",
    labelColor: "#22DD22",
    footerColor: "#118811",
    borderColor: "#1A3D1A",
    barTrackColor: "#0F1A0F",
    fontFamily: "'IBM Plex Mono', monospace",
    fontImport:
      "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&amp;display=swap');",
    borderRadius: 4,
    effects: {
      glow: true,
      scanlines: true,
      cursorBlink: true,
    },
    headerPrefix: ">_ ",
    footerSeparator: " | ",
  },
  infrared: {
    name: "infrared",
    palette: [
      "#FF1744",
      "#FF6D00",
      "#FFEA00",
      "#FF4081",
      "#E040FB",
      "#7C4DFF",
      "#448AFF",
      "#00E5FF",
      "#FFFFFF",
      "#FF3D00",
    ],
    background: "#0D0D12",
    backgroundSecondary: "#12101A",
    headerColor: "#FFFFFF",
    labelColor: "#E8E8F0",
    footerColor: "#8888AA",
    borderColor: "#7C4DFF",
    barTrackColor: "#1A1525",
    fontFamily: "'Space Grotesk', sans-serif",
    fontImport:
      "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600&amp;display=swap');",
    borderRadius: 8,
    effects: {
      heatBloom: true,
      thermalGradient: true,
      heatPulse: true,
      heatLegend: true,
    },
    footerSeparator: " • ",
    headerUppercase: true,
    headerLetterSpacing: 2,
  },
  outline: {
    name: "outline",
    palette: [
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
      "#18181B",
    ],
    background: "#FAFAFA",
    backgroundSecondary: "#FFFFFF",
    headerColor: "#71717A",
    labelColor: "#18181B",
    footerColor: "#A1A1AA",
    borderColor: "#E4E4E7",
    barTrackColor: "none",
    fontFamily: "'Inter', -apple-system, sans-serif",
    fontImport:
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&amp;display=swap');",
    borderRadius: 0,
    effects: {},
    footerSeparator: " · ",
  },
};

export type ThemeName = keyof typeof themes;
