/**
 * Pilot content review driver (specs/ux-mcp-content-bestpractice, AC-C3).
 *
 *   node scripts/review-pilot-content.mjs --fetch <permalink>
 *   node scripts/review-pilot-content.mjs --apply <permalink> --file <path> [--write]
 *   node scripts/review-pilot-content.mjs --status
 */

import { querySurreal } from "./lib/db-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SPEC_DIR = new URL("../specs/ux-mcp-content-bestpractice/", import.meta.url).pathname;

const args = process.argv.slice(2);
const mode = args[0];
const permalink = args[1];
const fileIdx = args.indexOf("--file");
const file = fileIdx > -1 ? args[fileIdx + 1] : null;
const write = args.includes("--write");

// SurrealDB Cloud rejects HTTP Basic auth for namespace/database users ("There
// was a problem with authentication"); db-env signs in over JSON-RPC and sends
// a Bearer token, which is the only path that works.
const q = (body) => querySurreal(body);
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const slugOf = (pl) => pl.replace(/^\/|\/$/g, "").replace(/\//g, "__");

async function verifyUrl(url) {
  const curlCheck = () => {
    try {
      const code = execFileSync("curl", [
        "-s", "-o", "/dev/null", "-w", "%{http_code}",
        "--max-time", "30", "-L", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", url,
      ], { encoding: "utf8" }).trim();
      return code;
    } catch {
      return null;
    }
  };
  const classify = (code) => {
    if (code === "200") return "ok";
    if (["403", "415", "429", "202"].includes(code)) return `bot-blocked(${code})`;
    return null;
  };
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(45000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (res.status === 200) return "ok";
    if ([403, 415, 429, 202].includes(res.status)) return `bot-blocked(${res.status})`;
    // Second opinion via curl — WAFy sites answer differently per client
    const curlCode = curlCheck();
    const verdict = classify(curlCode);
    if (verdict) return verdict;
    return `FAIL(${res.status}${curlCode ? `, curl:${curlCode}` : ""})`;
  } catch (e) {
    const verdict = classify(curlCheck());
    if (verdict) return verdict;
    return `FAIL(${e.name})`;
  }
}

if (mode === "--fetch") {
  const rows = await q(`SELECT title, content FROM page WHERE permalink = '${esc(permalink)}';`);
  const page = rows?.[0];
  if (!page) throw new Error(`Page not found: ${permalink}`);
  fs.mkdirSync(path.join(SPEC_DIR, "backup"), { recursive: true });
  fs.mkdirSync(path.join(SPEC_DIR, "work"), { recursive: true });
  fs.writeFileSync(path.join(SPEC_DIR, "backup", `${slugOf(permalink)}.md`), page.content);
  fs.writeFileSync(path.join(SPEC_DIR, "work", `${slugOf(permalink)}.md`), page.content);
  console.log(`fetched ${page.title} -> backup/ + work/${slugOf(permalink)}.md (${page.content.length} chars)`);
  process.exit(0);
}

if (mode === "--status") {
  const rows = await q(`SELECT permalink, content CONTAINS '## References' AS has_refs FROM page WHERE section = 'standards' ORDER BY permalink;`);
  const done = rows.filter((r) => r.has_refs);
  console.log(`standards pilot: ${done.length}/${rows.length} pages have ## References`);
  rows.filter((r) => !r.has_refs).forEach((r) => console.log("  pending:", r.permalink));
  process.exit(0);
}

if (mode === "--apply") {
  if (!permalink || !file) throw new Error("usage: --apply <permalink> --file <path> [--write]");
  const updated = fs.readFileSync(file, "utf8");

  if (!updated.includes("## References")) throw new Error("validation: updated file lacks '## References' section");

  const urls = [...updated.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  console.log(`validating ${urls.length} URLs...`);
  const bad = [];
  for (const u of urls) {
    const status = await verifyUrl(u);
    if (status.startsWith("FAIL")) bad.push(`${u} -> ${status}`);
  }
  if (bad.length) {
    console.error("URL verification failures (fix before applying):");
    bad.forEach((b) => console.error("  " + b));
    process.exit(1);
  }
  console.log("all URLs verified (200 or documented bot-block)");

  const rows = await q(`SELECT content FROM page WHERE permalink = '${esc(permalink)}';`);
  const current = rows?.[0]?.content;
  if (current === undefined) throw new Error(`Page not found: ${permalink}`);
  if (current === updated) {
    console.log("no-op: content identical");
    process.exit(0);
  }

  if (!write) {
    const a = current.split("\n"), b = updated.split("\n");
    const added = b.filter((l) => !a.includes(l));
    const removed = a.filter((l) => !b.includes(l));
    console.log(`--- DRY-RUN for ${permalink} ---`);
    console.log(`+${added.length} / -${removed.length} lines`);
    console.log("\nadded lines (first 40):"); added.slice(0, 40).forEach((l) => console.log("+ " + l));
    console.log("\nremoved lines (first 20):"); removed.slice(0, 20).forEach((l) => console.log("- " + l));
    console.log("\n(dry-run — pass --write to apply)");
    process.exit(0);
  }

  fs.mkdirSync(path.join(SPEC_DIR, "backup"), { recursive: true });
  fs.writeFileSync(path.join(SPEC_DIR, "backup", `${slugOf(permalink)}.md`), current);
  await q(`UPDATE page SET content = '${esc(updated)}' WHERE permalink = '${esc(permalink)}';`);
  const after = await q(`SELECT content CONTAINS '## References' AS has_refs FROM page WHERE permalink = '${esc(permalink)}';`);
  if (!after?.[0]?.has_refs) throw new Error("re-verify failed: no References section after update");
  console.log(`✅ applied + verified: ${permalink}`);
  process.exit(0);
}

console.log("usage: --fetch <permalink> | --apply <permalink> --file <path> [--write] | --status");
process.exit(1);
