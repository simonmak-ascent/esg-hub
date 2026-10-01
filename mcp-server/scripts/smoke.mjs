#!/usr/bin/env node
/**
 * Contract smoke test for the ESG Hub MCP server.
 *
 * Spawns the built stdio server (dist/index.js) and exercises the read tools
 * against a live API, asserting each returns structured content (no isError).
 *
 * Usage:
 *   node scripts/smoke.mjs [apiBase]
 * Defaults to https://esg-hub.ascent.partners.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const API_BASE = process.argv[2] || "https://esg-hub.ascent.partners";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, ESG_HUB_API_BASE: API_BASE, ESG_HUB_API_URL: API_BASE },
});
const client = new Client({ name: "esg-hub-smoke", version: "1.0.0" });

await client.connect(transport);

const listed = await client.listTools();
console.log(`tools listed: ${listed.tools.length}`);
if (listed.tools.length !== 13) fail(`expected 13 tools, got ${listed.tools.length}`);
for (const t of listed.tools) {
  if (!t.title) fail(`tool ${t.name} has no title`);
  if (!t.outputSchema) fail(`tool ${t.name} has no outputSchema`);
}

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) {
    const detail = r.content?.[0]?.text || JSON.stringify(r.structuredContent);
    console.log(`- ${name}: isError -> ${detail}`);
    fail(`${name} returned isError`);
  } else {
    console.log(`- ${name}: ok`);
  }
  return r.structuredContent;
}

const info = await call("get_server_info", {});
if (!info?.version) fail("get_server_info lacked version");

const meta = await call("get_esg_metadata", {});
if (!meta?.stats?.total_pages) fail("get_esg_metadata lacked stats");

const kw = await call("search_esg", { query: "climate", limit: 2 });
if (!kw?.items?.length) fail("search_esg returned no items");

const hy = await call("search_content", { query: "climate", limit: 2 });
if (!hy?.items?.length) fail("search_content returned no items");

const fw = await call("list_frameworks", { limit: 2 });
if (!fw?.items?.length) fail("list_frameworks returned no items");

const ind = await call("list_industries", {});
if (!ind?.industries?.length) fail("list_industries returned no industries");

const pg = await call("list_esg_pages", { limit: 1 });
const pageId = pg?.items?.[0]?.id;
const page = await call("get_esg_page", { page_id: pageId });
if (!page?.page?.title) fail("get_esg_page returned no page");

const termList = await client.callTool({ name: "list_esg_pages", arguments: { limit: 1 } });
void termList;

const rel = await call("get_related", {
  record_id: "social/labour-practices/employment-relationships",
});
void rel;

await client.close();

if (process.exitCode) {
  console.error("SMOKE FAILED");
} else {
  console.log("SMOKE OK");
}
