import { queryHttp, sanitize } from "./surrealdb";

export interface SearchResult {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  description?: string;
  section?: string;
  source_domain?: string;
  relevance?: number;
  distance?: number;
  source_type: "page" | "external";
}

/**
 * Resolve localized title/description from page record
 */
function resolveLocalizedContent<
  T extends { title: string; title_zh?: string | null; title_hi?: string | null; description?: string | null; description_zh?: string | null; description_hi?: string | null }
>(record: T, locale: string): { title: string; description: string | undefined } {
  const isCjk = locale === "zh" || locale === "hk"; // hk reuses zh copy until its own lands

  const title = isCjk && record.title_zh ? record.title_zh : record.title;

  const description = isCjk && record.description_zh ? record.description_zh : record.description || undefined;

  return { title, description };
}

/**
 * Full-text keyword search using BM25 ranking.
 * Input is sanitized to prevent SurrealQL injection.
 *
 * Localized fields use distinct match references: reusing `@0@`/`@1@` across
 * six fields made a row that matched only in `title_zh` sum to zero, so it
 * ranked last instead of first.
 */
export async function keywordSearch(query: string, locale?: string): Promise<SearchResult[]> {
  // Truncate excessively long queries
  const trimmed = query.slice(0, 500);
  const escaped = sanitize(trimmed);
  const isCjk = locale === "zh" || locale === "hk";

  // Search pages (include localized fields)
  const pageResults = await queryHttp<{
    id: string;
    title: string;
    title_zh: string | null;
    title_hi: string | null;
    permalink: string;
    description: string | null;
    description_zh: string | null;
    description_hi: string | null;
    section: string | null;
    relevance: number;
  }>(
    `SELECT id, title, title_zh, title_hi, permalink, description, description_zh, section,
      search::score(0) + search::score(1) + search::score(2) + search::score(3) + search::score(4) + search::score(5) AS relevance
    FROM page
    WHERE title @0@ '${escaped}' OR content @1@ '${escaped}' OR title_zh @2@ '${escaped}' OR content_zh @3@ '${escaped}' OR title_hi @4@ '${escaped}' OR content_hi @5@ '${escaped}'
    ORDER BY relevance DESC
    LIMIT 50;`
  );

  // Search external resources
  const extResults = await queryHttp<{
    id: string;
    title: string;
    url: string;
    source_domain: string | null;
    description: string | null;
    relevance: number;
  }>(
    `SELECT id, title, url, domain AS source_domain, description,
      search::score(0) + search::score(1) AS relevance
    FROM external_resource
    WHERE title @0@ '${escaped}' OR content @1@ '${escaped}'
    ORDER BY relevance DESC
    LIMIT 20;`
  );

  // The page FTS analyzer is ASCII/English; CJK text is not tokenized. For
  // zh/hk, substring matching is the reliable path (354 rows, cheap).
  let zhResults: typeof pageResults = [];
  if (isCjk) {
    zhResults = await queryHttp<(typeof pageResults)[number]>(
      `SELECT id, title, title_zh, title_hi, permalink, description, description_zh, section,
        (IF title_zh CONTAINS '${escaped}' THEN 10 ELSE 1 END) AS relevance
      FROM page
      WHERE title_zh CONTAINS '${escaped}' OR content_zh CONTAINS '${escaped}'
      ORDER BY relevance DESC
      LIMIT 50;`
    );
  }

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const r of [...zhResults, ...pageResults]) {
    const relevance = Number(r.relevance) || 0;
    if (relevance <= 0) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    const localized = resolveLocalizedContent(r, locale || "en");
    results.push({
      id: r.id,
      title: localized.title,
      permalink: r.permalink,
      description: localized.description,
      section: r.section || undefined,
      relevance,
      source_type: "page",
    });
  }

  for (const r of extResults) {
    const relevance = Number(r.relevance) || 0;
    if (relevance <= 0) continue;
    results.push({
      id: r.id,
      title: r.title,
      url: r.url,
      description: r.description || undefined,
      source_domain: r.source_domain || undefined,
      relevance,
      source_type: "external",
    });
  }

  // Sort by relevance descending
  results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  return results.slice(0, 50);
}

/**
 * Semantic vector search using HNSW index.
 * Embedding values are validated before use.
 */
export async function semanticSearch(
  embedding: number[],
  k: number = 15,
  locale?: string
): Promise<SearchResult[]> {
  // Validate embedding
  if (!Array.isArray(embedding) || embedding.length !== 384) {
    throw new Error("Invalid embedding: expected 384-dimensional array");
  }
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== "number" || !isFinite(embedding[i])) {
      throw new Error(`Invalid embedding value at index ${i}`);
    }
  }

  // Sanitize k
  const safeK = Math.max(1, Math.min(k, 50));

  const embStr = "[" + embedding.map((v) => v.toFixed(8)).join(",") + "]";
  const results: SearchResult[] = [];

  // Search pages
  try {
    const pageResults = await queryHttp<{
      id: string;
      title: string;
      title_zh: string | null;
      title_hi: string | null;
      permalink: string;
      description: string | null;
      description_zh: string | null;
      description_hi: string | null;
      section: string | null;
      distance: number;
    }>(
      `SELECT id, title, title_zh, title_hi, permalink, description, description_zh, description_hi, section,
        vector::distance::knn() AS distance
      FROM page
      WHERE embedding <|${safeK}, 100|> ${embStr}
      ORDER BY distance
      LIMIT ${safeK};`
    );

    for (const r of pageResults) {
      const localized = resolveLocalizedContent(r, locale || "en");
      results.push({
        id: r.id,
        title: localized.title,
        permalink: r.permalink,
        description: localized.description,
        section: r.section || undefined,
        distance: r.distance,
        source_type: "page",
      });
    }
  } catch (err) {
    console.error("[Search] Page semantic search error:", err);
  }

  // Search external resources
  try {
    const extResults = await queryHttp<{
      id: string;
      title: string;
      url: string;
      source_domain: string;
      distance: number;
    }>(
      `SELECT id, title, url, source_domain,
        vector::distance::knn() AS distance
      FROM external_resource
      WHERE embedding <|${safeK}, 100|> ${embStr}
      ORDER BY distance
      LIMIT ${safeK};`
    );

    for (const r of extResults) {
      results.push({
        id: r.id,
        title: r.title,
        url: r.url,
        source_domain: r.source_domain,
        distance: r.distance,
        source_type: "external",
      });
    }
  } catch (err) {
    console.error("[Search] External semantic search error:", err);
  }

  // Sort by distance ascending (lower = more similar)
  results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  return results.slice(0, safeK);
}
