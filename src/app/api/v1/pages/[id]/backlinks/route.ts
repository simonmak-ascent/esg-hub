import { NextRequest, NextResponse } from "next/server";
import { getPageByPermalink, isDbConfigured, DB_ERROR } from "@/lib/pages";
import { queryHttp } from "@/lib/surrealdb";
import { formatPermalink } from "@/lib/utils";
import { parsePageIdentifier } from "@/lib/page-identifier";

export const runtime = "nodejs";

interface BacklinkPage {
  id: string;
  title: string;
  permalink: string;
  section: string | null;
}

async function resolvePageId(identifier: { value: string; kind: "record" | "path" }): Promise<string | null> {
  if (identifier.kind === "record") {
    return identifier.value;
  }

  const page = await getPageByPermalink(formatPermalink(identifier.value));
  if (page && page !== DB_ERROR) {
    return page.id;
  }

  const bySlug = await queryHttp<{ id: string }>(
    `SELECT id FROM page WHERE slug = $slug LIMIT 1;`,
    { slug: identifier.value.split("/").pop() }
  );
  return bySlug?.[0]?.id ?? null;
}


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    
    const idValidation = parsePageIdentifier(id);
    if (!idValidation.valid) {
      return NextResponse.json({ error: idValidation.error }, { status: 400 });
    }

    const pageId = await resolvePageId({ value: idValidation.value, kind: idValidation.kind });
    if (!pageId) {
      return NextResponse.json({ data: [] }, { status: 404 });
    }

    const backlinks = await queryHttp<BacklinkPage>(
      `SELECT id, title, permalink, section FROM page WHERE $id IN backlinks;`,
      { id: pageId }
    );

    return NextResponse.json({ data: backlinks });
  } catch (error) {
    console.error("[api] Backlinks error:", error);
    return NextResponse.json(
      { error: "Failed to load backlinks" },
      { status: 500 }
    );
  }
}
