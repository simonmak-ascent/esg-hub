import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { keywordSearch } from "@/lib/search";
import { queryHttp, queryHttpAll, sanitize, sanitizeInt } from "@/lib/surrealdb";
import { fuseRerankAndRespond, type RrfInput } from "@/lib/search/hybrid";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

const VALID_SOURCES = new Set(["all", "pages", "external"]);
const VALID_MODES = new Set(["keyword", "hybrid"]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/search?q=query&limit=20&source=all&mode=keyword|hybrid
 * 
 * mode=keyword (default): Full-text keyword search using BM25 ranking across pages and external resources.
 * mode=hybrid: Reciprocal Rank Fusion (BM25 + HNSW) with ESG-aware re-ranking across all content tables.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q");
    const limit = sanitizeInt(params.get("limit"), 20, 1, 50);
    const source = params.get("source") || "all";
    const mode = params.get("mode") || "keyword";

    if (!q) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (q.length > 500) {
      return NextResponse.json(
        { error: "Query must be 500 characters or fewer." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!VALID_SOURCES.has(source)) {
      return NextResponse.json(
        { error: "Invalid source parameter. Must be 'all', 'pages', or 'external'." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'keyword' or 'hybrid'." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // =========================================================================
    // mode=keyword — existing behaviour preserved unchanged
    // =========================================================================
    if (mode === "keyword") {
      const results = await keywordSearch(q);

      let filtered = results;
      if (source === "pages") {
        filtered = results.filter(r => r.source_type === "page");
      } else if (source === "external") {
        filtered = results.filter(r => r.source_type === "external");
      }

      return NextResponse.json({
        query: q,
        mode: "keyword",
        data: filtered.slice(0, limit),
        total: filtered.length,
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // mode=hybrid — RRF fusion (BM25 + HNSW) with ESG re-ranking
    // =========================================================================

    const offset = sanitizeInt(params.get("offset"), 0, 0, 10000);
    const hybridLimit = Math.max(1, Math.min(limit, 100));

    // Parse optional embedding for HNSW (omit to use BM25-only RRF)
    let embedding: number[] | undefined;
    const embParam = params.get("embedding");
    if (embParam) {
      embedding = embParam.split(",").map(Number);
      if (embedding.length !== 384 || embedding.some(v => !isFinite(v))) {
        return NextResponse.json(
          { error: "embedding must be 384 comma-separated finite numbers" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const escaped = sanitize(q.slice(0, 500));

    // ----- Table definitions for BM25 queries -----
    interface TableDef {
      name: string;
      select: string;
      ftsWhere: string;
      limit: number;
    }

    const allTableDefs: TableDef[] = [
      {
        name: "page",
        select: "id, title, permalink, description, section, updated_at",
        ftsWhere: `title @0@ '${escaped}' OR content @1@ '${escaped}'`,
        limit: 10,
      },
      {
        name: "term",
        select: "id, name AS title, definition AS description, updated_at",
        ftsWhere: `term @0@ '${escaped}' OR definition @1@ '${escaped}'`,
        limit: 5,
      },
      {
        name: "framework",
        select: "id, name AS title, description, updated_at",
        ftsWhere: `name @0@ '${escaped}' OR description @1@ '${escaped}'`,
        limit: 5,
      },
      {
        name: "industries",
        select: "id, name_en AS title, updated_at",
        ftsWhere: `name @0@ '${escaped}' OR description @1@ '${escaped}'`,
        limit: 5,
      },
      {
        name: "entity",
        select: "id, name AS title, description, updated_at",
        ftsWhere: `name @0@ '${escaped}' OR description @1@ '${escaped}'`,
        limit: 5,
      },
      {
        name: "external_resource",
        select: "id, title, url, domain AS source_domain, description, updated_at",
        ftsWhere: `title @0@ '${escaped}' OR content @1@ '${escaped}'`,
        limit: 5,
      },
    ];

    // Filter tables by source
    const bm25TableDefs = source === "external"
      ? allTableDefs.filter(t => t.name === "external_resource")
      : source === "pages"
        ? allTableDefs.filter(t => t.name !== "external_resource")
        : allTableDefs;

    // Populate "external" vs "pages" source_type per table
    const externalTables = new Set(["external_resource"]);

    // ----- Build BM25 + HNSW SQL -----
    const sqlParts: string[] = [];

    // BM25 queries
    for (const t of bm25TableDefs) {
      sqlParts.push(
        `SELECT ${t.select}, search::score(0) + search::score(1) AS relevance FROM ${t.name} WHERE ${t.ftsWhere} ORDER BY relevance DESC LIMIT ${t.limit};`
      );
    }

    // HNSW queries (only if embedding provided)
    const hnswQueries: string[] = [];
    if (embedding) {
      const embStr = "[" + embedding.map(v => v.toFixed(8)).join(",") + "]";
      for (const t of bm25TableDefs) {
        const hnswSql = `SELECT ${t.select}, vector::distance::knn() AS distance FROM ${t.name} WHERE embedding <|${t.limit},100|> ${embStr} ORDER BY distance LIMIT ${t.limit};`;
        sqlParts.push(hnswSql);
        hnswQueries.push(hnswSql);
      }
    }

    // Single round-trip via queryHttpAll
    const allQueryResults = await queryHttpAll<Record<string, unknown>>(sqlParts.join("\n"));

    // ----- Process BM25 results -----
    const bm25Inputs: RrfInput[] = [];
    const docMetadata = new Map<string, {
      title: string;
      permalink?: string;
      description?: string;
      section?: string;
      domain?: string;
      source_type?: "pages" | "external";
    }>();

    for (let i = 0; i < bm25TableDefs.length; i++) {
      const tableDef = bm25TableDefs[i];
      const result = allQueryResults[i];
      const sourceType: "pages" | "external" = externalTables.has(tableDef.name) ? "external" : "pages";

      if (result?.status === "OK" && Array.isArray(result.result)) {
        for (const r of result.result as Array<Record<string, unknown>>) {
          const id = String(r.id);
          const score = Number(r.relevance) || 0;
          bm25Inputs.push({ id, table: tableDef.name, score });

          const key = `${tableDef.name}:${id}`;
          if (!docMetadata.has(key)) {
            docMetadata.set(key, {
              title: String(r.title || ""),
              permalink: r.permalink ? String(r.permalink) : undefined,
              description: r.description ? String(r.description) : undefined,
              section: r.section ? String(r.section) : undefined,
              domain: r.source_domain ? String(r.source_domain) : r.domain ? String(r.domain) : undefined,
              source_type: sourceType,
            });
          }
        }
      }
    }

    // ----- Process HNSW results -----
    const hnswInputs: RrfInput[] = [];
    const docEmbeddingsMap = new Map<string, number[]>();

    if (embedding) {
      const hnswStartIdx = bm25TableDefs.length;
      for (let j = 0; j < bm25TableDefs.length; j++) {
        const tableDef = bm25TableDefs[j];
        const result = allQueryResults[hnswStartIdx + j];
        const sourceType: "pages" | "external" = externalTables.has(tableDef.name) ? "external" : "pages";

        if (result?.status === "OK" && Array.isArray(result.result)) {
          for (const r of result.result as Array<Record<string, unknown>>) {
            const id = String(r.id);
            const distance = Number(r.distance) || 0;
            const score = 1 - distance;
            hnswInputs.push({ id, table: tableDef.name, score });

            const key = `${tableDef.name}:${id}`;
            if (!docMetadata.has(key)) {
              docMetadata.set(key, {
                title: String(r.title || ""),
                permalink: r.permalink ? String(r.permalink) : undefined,
                description: r.description ? String(r.description) : undefined,
                section: r.section ? String(r.section) : undefined,
                domain: r.source_domain ? String(r.source_domain) : r.domain ? String(r.domain) : undefined,
                source_type: sourceType,
              });
            }
          }
        }
      }
    }

    // ----- Build updated_at map from metadata -----
    const docUpdatedAt = new Map<string, Date>();
    for (let i = 0; i < bm25TableDefs.length; i++) {
      const tableDef = bm25TableDefs[i];
      const result = allQueryResults[i];
      if (result?.status === "OK" && Array.isArray(result.result)) {
        for (const r of result.result as Array<Record<string, unknown>>) {
          const key = `${tableDef.name}:${String(r.id)}`;
          if (r.updated_at) {
            const d = new Date(String(r.updated_at));
            if (!isNaN(d.getTime())) {
              docUpdatedAt.set(key, d);
            }
          }
        }
      }
    }

    // Default authority scores per table
    const defaultAuthorities: Record<string, number> = {
      page: 0.6,
      term: 0.4,
      framework: 0.7,
      industries: 0.4,
      entity: 0.4,
      external_resource: 0.5,
    };
    const docAuthority = new Map<string, number>();
    for (const [key] of docMetadata) {
      const table = key.split(":")[0];
      docAuthority.set(key, defaultAuthorities[table] ?? 0.3);
    }

    // ----- Fuse, re-rank, paginate -----
    const response = fuseRerankAndRespond(bm25Inputs, hnswInputs, {
      limit: hybridLimit,
      offset,
      queryEmbedding: embedding,
      docAuthority,
      docUpdatedAt,
      docEmbeddings: docEmbeddingsMap,
      docMetadata,
    });

    return NextResponse.json({
      query: q,
      ...response,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[API /v1/search GET] Error:", err);
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * POST /api/v1/search
 * 
 * Semantic vector search using pre-computed embedding.
 * 
 * Body:
 *   - embedding: number[] (384-dimensional vector, required)
 *   - k: number (max results, default 10, max 50)
 *   - source: "all" | "pages" | "external" (default "all")
 */
export async function POST(request: NextRequest) {
  try {
    // Validate content type
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415, headers: CORS_HEADERS }
      );
    }

    // Limit body size (384 floats * ~12 chars each + overhead ≈ 6KB max)
    const body = await request.json();
    const { embedding, k = 10, source = "all" } = body;

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: "embedding array is required (384-dimensional float vector)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (embedding.length !== 384) {
      return NextResponse.json(
        { error: `Expected 384-dimensional embedding, got ${embedding.length}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate all elements are finite numbers
    for (let i = 0; i < embedding.length; i++) {
      if (typeof embedding[i] !== "number" || !isFinite(embedding[i])) {
        return NextResponse.json(
          { error: `Invalid embedding value at index ${i}. All values must be finite numbers.` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    if (!VALID_SOURCES.has(source)) {
      return NextResponse.json(
        { error: "Invalid source parameter. Must be 'all', 'pages', or 'external'." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const limit = Math.max(1, Math.min(typeof k === "number" ? k : 10, 50));
    const embStr = "[" + embedding.map((v: number) => v.toFixed(8)).join(",") + "]";
    const results: Array<{
      id: string;
      title: string;
      permalink?: string;
      url?: string;
      description?: string;
      section?: string;
      source_domain?: string;
      distance: number;
      similarity: number;
      source_type: "page" | "external";
    }> = [];

    if (source === "all" || source === "pages") {
      const pageResults = await queryHttp<{
        id: string;
        title: string;
        permalink: string;
        description: string | null;
        section: string | null;
        distance: number;
      }>(
        `SELECT id, title, permalink, description, section,
          vector::distance::knn() AS distance
        FROM page
        WHERE embedding <|${limit}, 100|> ${embStr}
        ORDER BY distance
        LIMIT ${limit};`
      );

      for (const r of pageResults) {
        results.push({
          id: r.id,
          title: r.title,
          permalink: r.permalink,
          description: r.description || undefined,
          section: r.section || undefined,
          distance: r.distance,
          similarity: Math.round((1 - r.distance) * 10000) / 100,
          source_type: "page",
        });
      }
    }

    if (source === "all" || source === "external") {
      const extResults = await queryHttp<{
        id: string;
        title: string;
        url: string;
        source_domain: string;
        distance: number;
      }>(
        `SELECT id, title, url, domain AS source_domain,
          vector::distance::knn() AS distance
        FROM external_resource
        WHERE embedding <|${limit}, 100|> ${embStr}
        ORDER BY distance
        LIMIT ${limit};`
      );

      for (const r of extResults) {
        results.push({
          id: r.id,
          title: r.title,
          url: r.url,
          source_domain: r.source_domain,
          distance: r.distance,
          similarity: Math.round((1 - r.distance) * 10000) / 100,
          source_type: "external",
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      mode: "semantic",
      model: "BAAI/bge-small-en-v1.5",
      dimensions: 384,
      data: results.slice(0, limit),
      total: results.length,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[API /v1/search POST] Error:", err);
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
