import { NextRequest, NextResponse } from "next/server";
import { queryHttp, sanitize } from "@/lib/surrealdb";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
};

const SELECT_FIELDS =
  "id, name, definition, facets, aliases, source_urls, section, pillar, permalink, created_at, updated_at";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/terms/:id
 *
 * Retrieve a single glossary term by SurrealDB record ID (`term:...`), permalink,
 * or (case-insensitive) name.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.length > 500) {
      return NextResponse.json(
        { error: "Invalid term identifier" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const decoded = decodeURIComponent(id);
    let results;

    if (decoded.startsWith("term:")) {
      if (!/^term:[a-zA-Z0-9_]+$/.test(decoded)) {
        return NextResponse.json(
          { error: "Invalid record ID format" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      results = await queryHttp(`SELECT ${SELECT_FIELDS} FROM ${decoded};`);
    } else {
      const safe = sanitize(decoded);
      results = await queryHttp(
        `SELECT ${SELECT_FIELDS} FROM term WHERE permalink = '${safe}' OR string::lowercase(name) = string::lowercase('${safe}') LIMIT 1;`
      );
    }

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "Term not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json({ data: results[0] }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[API /v1/terms/:id] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
