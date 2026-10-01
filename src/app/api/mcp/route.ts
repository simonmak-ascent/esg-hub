import { createMcpServer } from "@simonmak-ascent/esg-hub-mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
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
 * A fresh McpServer + transport is created per request (no shared caller state),
 * per the MCP SDK stateless pattern. Read-only: write tools are stdio-only.
 */
export async function POST(request: Request) {
  const server = createMcpServer();
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
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "text/plain" } }
  );
}

export async function DELETE() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
