import { NextRequest, NextResponse } from "next/server";
import { queryHttp, sanitizeInt } from "@/lib/surrealdb";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/industries
 *
 * List the industry taxonomy (IFRS/SASB-style) with its sector grouping.
 * Query params: limit (default 100, max 200), offset (default 0).
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = sanitizeInt(params.get("limit"), 100, 1, 200);
    const offset = sanitizeInt(params.get("offset"), 0, 0, 10000);

    const items = await queryHttp<{
      id: string;
      industry_id: string;
      name_en: string;
      name_zh?: string;
      name_zh_tw?: string;
      sector_id: string;
    }>(
      `SELECT id, industry_id, name_en, name_zh, name_zh_tw, sector_id FROM industries ORDER BY name_en ASC LIMIT ${limit} START ${offset};`
    );

    const countResult = await queryHttp<{ count: number }>(
      `SELECT count() FROM industries GROUP ALL;`
    );
    const total = countResult[0]?.count || 0;

    return NextResponse.json(
      {
        items,
        pagination: { total, limit, offset, has_more: offset + limit < total },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[API /v1/industries] Error:", err);
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
