import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { queryHttp, sanitize, sanitizeInt } from "@/lib/surrealdb";
import { requireWriteToken } from "@/lib/auth/write-token";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/terms
 *
 * Create a glossary term proposal.
 * Body: { name: string, definition: string, facets?: object, source_urls?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { rateLimited } = checkRateLimit(request);
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const unauth = requireWriteToken(request);
    if (unauth) {
      return unauth;
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();
    const { name, definition, facets, source_urls } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Field 'name' is required and must be a non-empty string" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (name.length > 500) {
      return NextResponse.json(
        { error: "Field 'name' must be 500 characters or fewer" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!definition || typeof definition !== "string" || definition.trim().length === 0) {
      return NextResponse.json(
        { error: "Field 'definition' is required and must be a non-empty string" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (definition.length > 10000) {
      return NextResponse.json(
        { error: "Field 'definition' must be 10,000 characters or fewer" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (facets !== undefined && (typeof facets !== "object" || facets === null || Array.isArray(facets))) {
      return NextResponse.json(
        { error: "Field 'facets' must be an object if provided" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (source_urls !== undefined) {
      if (!Array.isArray(source_urls)) {
        return NextResponse.json(
          { error: "Field 'source_urls' must be an array of strings if provided" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      for (let i = 0; i < source_urls.length; i++) {
        if (typeof source_urls[i] !== "string") {
          return NextResponse.json(
            { error: `source_urls[${i}] must be a string` },
            { status: 400, headers: CORS_HEADERS }
          );
        }
      }
    }

    const safeName = sanitize(name.trim());
    const safeDefinition = sanitize(definition.trim());
    const safeSourceUrls = source_urls ? source_urls.map((u: string) => sanitize(u.trim())) : [];

    const results = await queryHttp<{ id: string; status: string }>(
      `CREATE content_enhancement_log CONTENT {
        status: "pending",
        target_table: "term",
        proposed_changes: $proposed_changes,
        source_urls: $source_urls,
        created_at: time::now()
      } RETURN id, status;`,
      {
        proposed_changes: { name: safeName, definition: safeDefinition, facets },
        source_urls: safeSourceUrls,
      }
    );

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "Failed to create proposal" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { proposal_id: results[0].id, status: results[0].status },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[API /v1/terms POST] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * GET /api/v1/terms
 *
 * List terms with pagination.
 * Query params:
 *   - limit (default 20, max 100)
 *   - offset (default 0)
 *   - q (optional, substring match on name)
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = sanitizeInt(params.get("limit"), 20, 1, 100);
    const offset = sanitizeInt(params.get("offset"), 0, 0, 100000);
    const q = params.get("q");

    const conditions: string[] = [];
    if (q) {
      if (q.length > 200) {
        return NextResponse.json(
          { error: "Query parameter 'q' must be 200 characters or fewer" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      conditions.push(`string::lowercase(name) CONTAINS string::lowercase('${sanitize(q)}')`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `SELECT id, name, definition, facets, aliases, source_urls, section, pillar, created_at, updated_at FROM term ${where} ORDER BY name ASC LIMIT ${limit} START ${offset};`;
    const results = await queryHttp(sql);

    const countSql = `SELECT count() FROM term ${where} GROUP ALL;`;
    const countResult = await queryHttp<{ count: number }>(countSql);
    const total = countResult.length > 0 ? countResult[0].count : 0;

    return NextResponse.json(
      {
        items: results,
        pagination: {
          total,
          offset,
          limit,
          has_more: offset + limit < total,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[API /v1/terms GET] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
