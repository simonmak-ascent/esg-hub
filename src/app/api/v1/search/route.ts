import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { keywordSearch } from "@/lib/search";
import { queryHttp, queryHttpAll, sanitize, sanitizeInt } from "@/lib/surrealdb";
import { fuseListsAndRespond, type RrfInput } from "@/lib/search/hybrid";
import { toWordBoundaryLiteral, wordBoundaryWhere } from "@/lib/search/query";

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

    const localeParam = params.get("locale") || "en";
    const locale = ["en", "zh", "hk"].includes(localeParam) ? localeParam : "en";
    const isCjk = locale === "zh" || locale === "hk";

    // =========================================================================
    // mode=keyword — BM25 across pages and external resources
    // =========================================================================
    if (mode === "keyword") {
      const offset = sanitizeInt(params.get("offset"), 0, 0, 10000);
      const results = await keywordSearch(q, locale);

      let filtered = results;
      if (source === "pages") {
        filtered = results.filter(r => r.source_type === "page");
      } else if (source === "external") {
        filtered = results.filter(r => r.source_type === "external");
      }

      const page = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        query: q,
        mode: "keyword",
        data: page,
        total: filtered.length,
        pagination: {
          total: filtered.length,
          offset,
          limit,
          has_more: offset + page.length < filtered.length,
        },
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
    const wordLiteral = sanitize(toWordBoundaryLiteral(q.slice(0, 500)));

    // ----- Table definitions -----
    // `where` + `score` must use match references that exist as FULLTEXT
    // indexes; reusing one reference across several fields made localized
    // matches score zero. Tables without a FULLTEXT index use a substring
    // match so they remain searchable instead of erroring silently.
    interface TableDef {
      name: string;
      select: string;
      where: string;
      score: string;
      limit: number;
      sourceType: "page" | "external";
    }

    const allTableDefs: TableDef[] = [
      {
        name: "page",
        select: "id, title, title_zh, permalink, description, description_zh, section, updated_at",
        where: `title @0@ '${escaped}' OR content @1@ '${escaped}' OR title_zh @2@ '${escaped}' OR content_zh @3@ '${escaped}' OR title_hi @4@ '${escaped}' OR content_hi @5@ '${escaped}'`,
        score: "search::score(0) + search::score(1) + search::score(2) + search::score(3) + search::score(4) + search::score(5)",
        limit: 10,
        sourceType: "page",
      },
      {
        name: "term",
        select: "id, name AS title, definition AS description, permalink, updated_at",
        where: `name @0@ '${escaped}' OR definition @1@ '${escaped}'`,
        score: "search::score(0) + search::score(1)",
        limit: 5,
        sourceType: "page",
      },
      {
        name: "framework",
        select: "id, name AS title, description, permalink, updated_at",
        where: `name @0@ '${escaped}' OR description @1@ '${escaped}'`,
        score: "search::score(0) + search::score(1)",
        limit: 5,
        sourceType: "page",
      },
      {
        name: "industries",
        select: "id, name_en AS title, name_zh AS title_zh, sector_id AS section, updated_at",
        where: wordBoundaryWhere("name_en", wordLiteral),
        score: "1",
        limit: 5,
        sourceType: "page",
      },
      {
        name: "entity",
        select: "id, name AS title, entity_type AS section, permalink, updated_at",
        where: wordBoundaryWhere("name", wordLiteral),
        score: "1",
        limit: 5,
        sourceType: "page",
      },
      {
        name: "external_resource",
        select: "id, title, url, domain AS source_domain, description, updated_at",
        where: `title @0@ '${escaped}' OR content @1@ '${escaped}'`,
        score: "search::score(0) + search::score(1)",
        limit: 5,
        sourceType: "external",
      },
    ];

    const bm25TableDefs = source === "external"
      ? allTableDefs.filter(t => t.name === "external_resource")
      : source === "pages"
        ? allTableDefs.filter(t => t.name !== "external_resource")
        : allTableDefs;

    // ----- Build one ranked list per statement -----
    const statements: Array<{ def: TableDef; kind: "bm25" | "hnsw" | "zh" }> = [];
    const sqlParts: string[] = [];

    for (const t of bm25TableDefs) {
      sqlParts.push(
        `SELECT ${t.select}, ${t.score} AS relevance FROM ${t.name} WHERE ${t.where} ORDER BY relevance DESC LIMIT ${t.limit};`
      );
      statements.push({ def: t, kind: "bm25" });
    }

    if (embedding) {
      const embStr = "[" + embedding.map(v => v.toFixed(8)).join(",") + "]";
      for (const t of bm25TableDefs) {
        sqlParts.push(
          `SELECT ${t.select}, vector::distance::knn() AS distance FROM ${t.name} WHERE embedding <|${t.limit},100|> ${embStr} ORDER BY distance LIMIT ${t.limit};`
        );
        statements.push({ def: t, kind: "hnsw" });
      }
    }

    // CJK substring retriever: the page FTS analyzer is ASCII/English, so
    // Chinese matches never surface through `@0@`-style match operators.
    if (isCjk && source !== "external") {
      const zhDef: TableDef = {
        name: "page",
        select: "id, title, title_zh, permalink, description, description_zh, section, updated_at",
        where: `title_zh CONTAINS '${escaped}' OR content_zh CONTAINS '${escaped}'`,
        score: `(IF title_zh CONTAINS '${escaped}' THEN 10 ELSE 1 END)`,
        limit: 10,
        sourceType: "page",
      };
      sqlParts.push(
        `SELECT ${zhDef.select}, ${zhDef.score} AS relevance FROM page WHERE ${zhDef.where} ORDER BY relevance DESC LIMIT ${zhDef.limit};`
      );
      statements.push({ def: zhDef, kind: "zh" });
    }

    // Single round-trip via queryHttpAll. A parse error aborts the whole batch,
    // so degrade to keyword search rather than failing the request outright.
    let allQueryResults: Awaited<ReturnType<typeof queryHttpAll<Record<string, unknown>>>>;
    try {
      allQueryResults = await queryHttpAll<Record<string, unknown>>(sqlParts.join("\n"));
    } catch (err) {
      console.error("[v1/search] hybrid batch failed, falling back to keyword search:", err);
      const fallback = await keywordSearch(q, locale);
      const page = fallback.slice(offset, offset + hybridLimit);
      return NextResponse.json({
        query: q,
        mode: "hybrid",
        degraded: true,
        results: page,
        data: page,
        total: fallback.length,
        pagination: {
          total: fallback.length,
          offset,
          limit: hybridLimit,
          has_more: offset + page.length < fallback.length,
        },
      }, { headers: CORS_HEADERS });
    }

    // ----- Collect one ranked list per statement -----
    const lists: RrfInput[][] = [];
    const docMetadata = new Map<string, {
      title: string;
      permalink?: string;
      url?: string;
      description?: string;
      section?: string;
      domain?: string;
      source_type?: "page" | "external";
    }>();
    const docUpdatedAt = new Map<string, Date>();

    for (let i = 0; i < statements.length; i++) {
      const { def, kind } = statements[i];
      const result = allQueryResults[i];

      if (result?.status !== "OK" || !Array.isArray(result.result)) {
        console.warn(`[v1/search] ${def.name} (${kind}) query failed: ${result?.status ?? "no result"}`);
        continue;
      }

      const list: RrfInput[] = [];
      for (const r of result.result as Array<Record<string, unknown>>) {
        const id = String(r.id);
        const key = `${def.name}:${id}`;
        const score = kind === "hnsw" ? 1 - (Number(r.distance) || 0) : Number(r.relevance) || 0;

        list.push({ id, table: def.name, score });

        if (!docMetadata.has(key)) {
          const domain = r.source_domain ?? r.domain;
          const localizedTitle = isCjk && r.title_zh ? String(r.title_zh) : String(r.title || "");
          const localizedDescription = isCjk && r.description_zh ? String(r.description_zh) : (r.description ? String(r.description) : undefined);
          docMetadata.set(key, {
            title: localizedTitle,
            permalink: r.permalink ? String(r.permalink) : undefined,
            url: r.url ? String(r.url) : undefined,
            description: localizedDescription,
            section: r.section ? String(r.section) : undefined,
            domain: domain ? String(domain) : undefined,
            source_type: def.sourceType,
          });
        }

        if (r.updated_at) {
          const updated = new Date(String(r.updated_at));
          if (!isNaN(updated.getTime())) {
            docUpdatedAt.set(key, updated);
          }
        }
      }

      if (list.length) lists.push(list);
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
    const response = fuseListsAndRespond(lists, {
      limit: hybridLimit,
      offset,
      queryEmbedding: embedding,
      docAuthority,
      docUpdatedAt,
      docEmbeddings: new Map(),
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
