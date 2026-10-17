import { NextRequest, NextResponse } from "next/server";
import { getPageByPermalink, isDbConfigured, DB_ERROR } from "@/lib/pages";
import { queryHttp } from "@/lib/surrealdb";
import { formatPermalink } from "@/lib/utils";
import { parsePageIdentifier } from "@/lib/page-identifier";

export const runtime = "nodejs";

interface RelatedPage {
  id: string;
  title: string;
  permalink: string;
  section: string | null;
}

function validateLimit(limitParam: string | null): { valid: boolean; value?: number; error?: string } {
  if (!limitParam) {
    return { valid: true, value: 15 };
  }
  const limit = Number(limitParam);
  if (Number.isNaN(limit)) {
    return { valid: false, error: "Limit must be a number" };
  }
  if (limit < 1) {
    return { valid: false, error: "Limit must be at least 1" };
  }
  if (limit > 50) {
    return { valid: false, error: "Limit cannot exceed 50" };
  }
  return { valid: true, value: Math.floor(limit) };
}

async function resolvePageId(identifier: { value: string; kind: "record" | "path" }): Promise<string | null> {
  if (identifier.kind === "record") {
    return identifier.value;
  }

  const page = await getPageByPermalink(formatPermalink(identifier.value));
  if (page && page !== DB_ERROR) {
    return page.id;
  }

  // Bare slug for a page nested under a hub (e.g. `physical-climate-risk`).
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const { id } = await params;
    
    // Validate id parameter
    const idValidation = parsePageIdentifier(id);
    if (!idValidation.valid) {
      return NextResponse.json({ error: idValidation.error }, { status: 400 });
    }

    // Validate limit parameter
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limitValidation = validateLimit(limitParam);
    if (!limitValidation.valid) {
      return NextResponse.json({ error: limitValidation.error }, { status: 400 });
    }
    const limit = limitValidation.value!;

    const pageId = await resolvePageId({ value: idValidation.value, kind: idValidation.kind });
    if (!pageId) {
      return NextResponse.json({ data: [] }, { status: 404 });
    }

    const relatedResult = await queryHttp<{ related_pages?: string[] }>(
      `SELECT related_pages FROM page WHERE id = $id LIMIT 1;`,
      { id: pageId }
    );

    const relatedIds = relatedResult?.[0]?.related_pages ?? [];
    if (!relatedIds.length) {
      return NextResponse.json({ data: [] });
    }

    const relatedPages = await queryHttp<RelatedPage>(
      `SELECT id, title, permalink, section FROM page WHERE id IN $ids LIMIT ${limit};`,
      { ids: relatedIds }
    );

    return NextResponse.json({ data: relatedPages });
  } catch (error) {
    console.error("[api] Related pages error:", error);
    return NextResponse.json(
      { error: "Failed to load related content" },
      { status: 500 }
    );
  }
}
