import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { queryHttp } from "@/lib/surrealdb";
import { parseEmbedding, parseResultCount, parseSource } from "@/lib/search/validate";
import { checkRateLimit, rateLimitResponse } from "@/lib/middleware/rate-limit";
import { forbiddenOriginResponse, isAllowedOrigin } from "@/lib/middleware/origin";

/**
 * Semantic search API
 *
 * Accepts a query embedding vector and returns the most relevant pages and
 * external resources using SurrealDB's HNSW vector index.
 *
 * POST /api/semantic-search
 * Body: { embedding: number[], k?: number, source?: "all" | "pages" | "external", locale?: string }
 */

interface SearchResult {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  description?: string;
  section?: string;
  source_domain?: string;
  distance: number;
  source_type: "page" | "external";
}

/**
 * Perform vector search against SurrealDB using a pre-computed embedding.
 *
 * `k` must already be a validated integer: it is interpolated into the KNN
 * operator and LIMIT clause, so a string or float would allow statement
 * injection through the JSON-RPC query endpoint.
 */
async function vectorSearch(
  embedding: number[],
  k: number = 10,
  source: "all" | "pages" | "external" = "all",
  locale: string = "en"
): Promise<SearchResult[]> {
  const embStr = "[" + embedding.map((v) => v.toFixed(8)).join(",") + "]";
  const results: SearchResult[] = [];

  if (source === "all" || source === "pages") {
    const pageSql = `
      SELECT id, title, title_zh, permalink, description, description_zh, section,
        vector::distance::knn() AS distance
      FROM page
      WHERE embedding <|${k}, 100|> ${embStr}
      ORDER BY distance
      LIMIT ${k};
    `;
    try {
      const pageResults = await queryHttp<{
        id: string;
        title: string;
        title_zh: string | null;
        permalink: string;
        description: string | null;
        description_zh: string | null;
        section: string | null;
        distance: number;
      }>(pageSql);
      for (const r of pageResults) {
        const title = locale !== "en" && r.title_zh ? r.title_zh : r.title;
        const description =
          locale !== "en" && r.description_zh ? r.description_zh : r.description;
        results.push({
          id: r.id,
          title,
          permalink: r.permalink,
          description: description ?? undefined,
          section: r.section ?? undefined,
          distance: r.distance,
          source_type: "page",
        });
      }
    } catch (err) {
      console.error("Page vector search error:", err);
    }
  }

  if (source === "all" || source === "external") {
    const extSql = `
      SELECT id, title, url, domain AS source_domain,
        vector::distance::knn() AS distance
      FROM external_resource
      WHERE embedding <|${k}, 100|> ${embStr}
      ORDER BY distance
      LIMIT ${k};
    `;
    try {
      const extResults = await queryHttp<{
        id: string;
        title: string;
        url: string;
        source_domain: string;
        distance: number;
      }>(extSql);
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
      console.error("External vector search error:", err);
    }
  }

  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, k);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return forbiddenOriginResponse();
    }

    const limit = checkRateLimit(request, { max: 60, windowMs: 60_000 });
    if (limit.rateLimited) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const embedding = parseEmbedding(body?.embedding);

    if (!embedding) {
      return NextResponse.json(
        { error: "embedding must be an array of 384 finite numbers" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const k = parseResultCount(body?.k);
    if (k === null) {
      return NextResponse.json(
        { error: "k must be an integer between 1 and 50" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const source = parseSource(body?.source);
    const locale = typeof body?.locale === "string" ? body.locale.slice(0, 8) : "en";

    const results = await vectorSearch(embedding, k, source, locale);
    return NextResponse.json(
      { results, count: results.length },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Semantic search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error:
        "POST an embedding vector to this endpoint. For full-text search use /search.",
    },
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } }
  );
}
