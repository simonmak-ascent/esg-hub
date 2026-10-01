import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Glama connector ownership metadata.
 *
 * Glama verifies domain ownership by fetching this file from the connector's
 * origin (`https://esg-hub.ascent.partners/.well-known/glama.json`). It must
 * stay published (public, valid JSON, 200) to retain verified ownership.
 * Schema: https://glama.ai/mcp/schemas/connector.json
 */
const GLAMA_CONNECTOR = {
  $schema: "https://glama.ai/mcp/schemas/connector.json",
  claim: "glama_claim_-rgFSSE6Fr8KZ_NK1iogclzjnF4VfXzn",
};

export function GET() {
  return NextResponse.json(GLAMA_CONNECTOR, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
