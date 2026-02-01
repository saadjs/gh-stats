import type { LanguageStatsResult } from "../types.js";

export function renderJson(stats: LanguageStatsResult): string {
  return JSON.stringify(stats, null, 2);
}
