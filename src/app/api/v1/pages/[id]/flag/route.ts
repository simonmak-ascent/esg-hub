import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { queryHttp } from "@/lib/surrealdb";
import { requireWriteToken } from "@/lib/auth/write-token";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const VALID_ACTIONS = new Set(["delist", "remove", "review"]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/pages/:id/flag
 *
 * Queue a page for human curation (delist / remove / review). Does not mutate the
 * page: writes a pending `content_enhancement_log` row.
 * Body: { action: "delist" | "remove" | "review", reason: string (10-1000) }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { rateLimited } = checkRateLimit(request);
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const unauth = requireWriteToken(request);
    if (unauth) return unauth;

    const { id } = await params;
    if (!id || id.length > 500) {
      return NextResponse.json({ error: "Invalid page identifier" }, { status: 400, headers: CORS_HEADERS });
    }

    const pageId = decodeURIComponent(id);
    if (!/^page:[a-zA-Z0-9_]+$/.test(pageId)) {
      return NextResponse.json(
        { error: "Invalid record ID format. Expected 'page:<id>'" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415, headers: CORS_HEADERS });
    }

    const body = (await request.json().catch(() => null)) as
      | { action?: unknown; reason?: unknown }
      | null;
    const action = typeof body?.action === "string" ? body.action : "review";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be delist, remove, or review." },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (reason.length < 10 || reason.length > 1000) {
      return NextResponse.json({ error: "reason must be 10-1000 characters" }, { status: 400, headers: CORS_HEADERS });
    }

    const results = await queryHttp<{ id: string; status: string }>(
      `CREATE content_enhancement_log CONTENT {
        status: "pending",
        target_table: "page",
        proposed_changes: $proposed_changes,
        source_urls: [],
        created_at: time::now()
      } RETURN id, status;`,
      { proposed_changes: { page_id: pageId, action, reason } }
    );

    if (!results || results.length === 0) {
      return NextResponse.json({ error: "Failed to create curation request" }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { proposal_id: results[0].id, status: results[0].status },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[API /v1/pages/:id/flag POST] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
