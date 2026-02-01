export type LanguageBytes = Record<string, number>;

export interface RepoSummary {
  name: string;
  full_name: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
  languages_url: string;
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
}

export interface FetchOptions {
  token: string;
  includeForks: boolean;
  includeArchived: boolean;
  includeMarkdown: boolean;
}
