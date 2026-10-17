import { createMcpServer } from "@simonmak-ascent/esg-hub-mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { checkRateLimit, rateLimitResponse } from "@/lib/middleware/rate-limit";
import { forbiddenOriginResponse, isAllowedOrigin } from "@/lib/middleware/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Stateless Streamable HTTP MCP endpoint.
 *
 * A fresh McpServer + transport is created per request (no shared caller
 * state), per the MCP SDK stateless pattern.
 *
 * Read-only: the HTTP transport registers the twelve read tools only. The
 * token-backed write tools (propose_term, tag_content, flag_content) are
 * available over stdio, where the operator controls the process.
 */
export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const limit = checkRateLimit(request, { max: 60, windowMs: 60_000 });
  if (limit.rateLimited) {
    return rateLimitResponse(limit);
  }

  const server = createMcpServer({ readOnly: true });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const res = await transport.handleRequest(request);
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function GET() {
  return new Response(
    "ESG Hub MCP endpoint. Use POST with MCP JSON-RPC (Streamable HTTP).",
    {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain", Allow: "POST, OPTIONS" },
    }
  );
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
}
