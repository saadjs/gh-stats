export type LanguageBytes = Record<string, number>;

export interface RepoSummary {
  name: string;
  full_name: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
  languages_url: string;
  pushed_at: string | null;
}

export interface LanguageStat {
  language: string;
  bytes: number;
  percent: number;
}

export interface LanguageStatsResult {
  totalBytes: number;
  languages: LanguageStat[];
  generatedAt: string;
  repositoryCount: number;
  includedForks: boolean;
  includedArchived: boolean;
  includedMarkdown: boolean;
  excludedMarkupLanguages?: boolean;
  authorFilter?: string;
  authorPatterns?: string[];
  analysisSource?: "api" | "clone";
  analysisMethod?: "repo_bytes" | "changed_lines";
  engine?: "github-linguist";
  repoComposition?: {
    totalBytes: number;
    languages: LanguageStat[];
  };
  weeklyChurn?: {
    totalBytes: number;
    languages: LanguageStat[];
  };
  skippedRepositories?: Array<{
    fullName: string;
    reason: string;
  }>;
  window?: {
    days: number;
    since: string;
    until: string;
    activityField: "pushed_at" | "changed_lines";
  };
}

export interface FetchOptions {
  token: string;
  includeForks: boolean;
  includeArchived: boolean;
  includeMarkdown: boolean;
}
