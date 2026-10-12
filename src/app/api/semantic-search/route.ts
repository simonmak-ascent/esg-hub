import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { queryHttp } from "@/lib/surrealdb";

/**
 * Semantic Search API
 * 
 * Accepts a query embedding vector and returns the most relevant pages
 * and external resources using SurrealDB's HNSW vector index.
 * 
 * POST /api/semantic-search
 * Body: { query: string, embedding: number[], k?: number, source?: "all" | "pages" | "external", locale?: string }
 * 
 * GET /api/semantic-search?q=<query>&k=<number>&source=<all|pages|external>
 * (uses server-side embedding generation via fastembed proxy)
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
 * Perform vector search against SurrealDB using a pre-computed embedding
 */
async function vectorSearch(
  embedding: number[],
  k: number = 10,
  source: string = "all",
  locale: string = "en"
): Promise<SearchResult[]> {
  const embStr = "[" + embedding.map((v) => v.toFixed(8)).join(",") + "]";
  const results: SearchResult[] = [];

  if (source === "all" || source === "pages") {
    const pageSql = `
      SELECT id, title, title_zh, title_hi, permalink, description, description_zh, description_hi, section,
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
        title_hi: string | null;
        permalink: string;
        description: string | null;
        description_zh: string | null;
        description_hi: string | null;
        section: string | null;
        distance: number;
      }>(pageSql);
      
      const isCjk = locale === "zh" || locale === "hk"; // hk reuses zh copy until its own lands
      
      for (const r of pageResults) {
        const title = isCjk && r.title_zh ? r.title_zh : r.title;
        const description = isCjk && r.description_zh ? r.description_zh : r.description || undefined;
        
        results.push({
          id: r.id,
          title,
          permalink: r.permalink,
          description,
          section: r.section || undefined,
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
      SELECT id, title, url, source_domain,
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

  // Sort combined results by distance
  results.sort((a, b) => a.distance - b.distance);

  return results.slice(0, k);
}


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { embedding, k = 10, source = "all", locale = "en" } = body;

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: "embedding array is required" },
        { status: 400 }
      );
    }

    const results = await vectorSearch(embedding, k, source, locale);
    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    console.error("Semantic search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // For GET requests, we can't do server-side embedding without a model
  // Instead, redirect to the search page
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Use POST with an embedding vector for semantic search, or use the /search page for full-text search.",
    fallback_url: `/search?q=${encodeURIComponent(q)}`,
  });
}
