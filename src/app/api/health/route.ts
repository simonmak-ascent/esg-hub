import { NextResponse } from "next/server";
import { queryHttp } from "@/lib/surrealdb";
import { isDbConfigured } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe with a content assertion.
 *
 * A DB outage previously rendered "content unavailable" pages with HTTP 200,
 * so an uptime check on `/` could not tell a healthy site from an empty one.
 * This endpoint fails (503) when the database is unreachable or the corpus is
 * suspiciously small, which is what an external monitor should poll.
 */
const MIN_PAGES = 200;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (!isDbConfigured()) {
    return NextResponse.json(
      { status: "error", reason: "database_not_configured" },
      { status: 503, headers }
    );
  }

  try {
    const rows = await queryHttp<{ count: number }>(
      "SELECT count() FROM page GROUP ALL;"
    );
    const pages = Number(rows?.[0]?.count ?? 0);
    const healthy = pages >= MIN_PAGES;

    return NextResponse.json(
      {
        status: healthy ? "ok" : "degraded",
        pages,
        minimum_pages: MIN_PAGES,
        checked_at: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503, headers }
    );
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json(
      { status: "error", reason: "database_unreachable" },
      { status: 503, headers }
    );
  }
}
