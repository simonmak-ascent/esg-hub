import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { queryHttpAll, sanitize } from "@/lib/surrealdb";

/**
 * Quick Search API — returns instant results from SurrealDB BM25 search
 * without AI processing. Used for search suggestions and quick results.
 *
 * GET /api/quick-search?q=query&limit=10
 */

interface QuickResult {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  snippet: string;
  source_type: "page" | "book" | "external";
  section?: string;
  domain?: string;
  relevance: number;
}


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const localeParam = request.nextUrl.searchParams.get("locale") || "en";
    const locale = ["en", "zh", "hk"].includes(localeParam) ? localeParam : "en";
    const isCjk = locale === "zh" || locale === "hk";

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    const limit = Math.max(1, Math.min(parseInt(limitParam || "8", 10) || 8, 20));
    const escaped = sanitize(q.trim().slice(0, 500));

    // The page FTS analyzer is ASCII/English, so CJK queries use substring
    // matching on the translated fields instead of the `@n@` match operator.
    const pageWhere = isCjk
      ? `title_zh CONTAINS '${escaped}' OR content_zh CONTAINS '${escaped}'`
      : `title @0@ '${escaped}' OR content @1@ '${escaped}'`;
    const pageScore = isCjk
      ? `(IF title_zh CONTAINS '${escaped}' THEN 10 ELSE 1 END)`
      : `search::score(0) + search::score(1)`;

    const sql = `
      SELECT id, title, title_zh, permalink, description, description_zh, section,
        ${pageScore} AS relevance
      FROM page
      WHERE ${pageWhere}
      ORDER BY relevance DESC
      LIMIT ${limit};

      SELECT id, title, url, domain, description,
        search::score(0) + search::score(1) AS relevance
      FROM external_resource
      WHERE title @0@ '${escaped}' OR content @1@ '${escaped}'
      ORDER BY relevance DESC
      LIMIT ${Math.ceil(limit / 2)};
    `;

    const allResults = await queryHttpAll<Record<string, unknown>>(sql);
    const results: QuickResult[] = [];

    // Pages
    if (allResults[0]?.status === "OK" && Array.isArray(allResults[0].result)) {
      for (const r of allResults[0].result as Array<Record<string, unknown>>) {
        const localizedTitle = isCjk && r.title_zh ? String(r.title_zh) : String(r.title || "");
        const localizedDescription = isCjk && r.description_zh ? String(r.description_zh) : String(r.description || "");
        results.push({
          id: String(r.id),
          title: localizedTitle,
          permalink: r.permalink ? String(r.permalink) : undefined,
          snippet: localizedDescription.slice(0, 200),
          source_type: "page",
          section: r.section ? String(r.section) : undefined,
          relevance: Number(r.relevance) || 0,
        });
      }
    }

    // External resources
    if (allResults[1]?.status === "OK" && Array.isArray(allResults[1].result)) {
      for (const r of allResults[1].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: String(r.title || ""),
          url: r.url ? String(r.url) : undefined,
          snippet: String(r.description || "").slice(0, 200),
          source_type: "external",
          domain: r.domain ? String(r.domain) : undefined,
          relevance: Number(r.relevance) || 0,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({
      results: results.slice(0, limit),
      count: results.length,
    });
  } catch (err) {
    console.error("[Quick Search] Error:", err);
    return NextResponse.json(
      { error: "Search failed", results: [] },
      { status: 500 }
    );
  }
}
