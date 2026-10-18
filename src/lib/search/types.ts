export interface HybridSearchParams {
  query: string;
  limit?: number;
  offset?: number;
  mode?: "keyword" | "hybrid";
}

export interface SearchResult {
  id: string;
  table: string;
  title: string;
  permalink?: string;
  url?: string;
  description?: string;
  section?: string;
  domain?: string;
  relevance?: number;
  facets?: Record<string, string | string[]>;
  source_type?: "page" | "external";
}

export interface HybridSearchResponse {
  results: SearchResult[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    has_more: boolean;
  };
  mode: "keyword" | "hybrid";
}

export interface RankedResult {
  id: string;
  table: string;
  rrfScore: number;
  textScore: number;
  frameworkMatch: number;
  topicMatch: number;
  authority: number;
  freshness: number;
  finalScore: number;
}
