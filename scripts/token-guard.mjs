#!/usr/bin/env node
/**
 * Token drift guard — fails when a component embeds a hex colour literal
 * outside the token layer. Mirrors apf-website/scripts/token-guard.mjs.
 *
 *   node scripts/token-guard.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.env.TOKEN_GUARD_ROOT || process.cwd();

/** Files where hex literals are legitimate (the token / generated layer). */
const ALLOWLIST = new Set([
  "src/styles/tokens/tokens.v2.json",
  "src/styles/tokens/tokens-dark.json",
  "src/styles/tokens/tokens.status.json",
  "src/styles/tokens.generated.css",
  "src/styles/esg-overlay.css",
]);

const SCAN_DIR = join(ROOT, "src");

function flattenTokens(obj, out = []) {
  for (const [, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flattenTokens(v, out);
    else if (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v)) out.push(v.toLowerCase());
  }
  return out;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|css)$/.test(entry)) files.push(full);
  }
  return files;
}

const v2 = JSON.parse(readFileSync(join(ROOT, "src/styles/tokens/tokens.v2.json"), "utf8"));
const dark = JSON.parse(readFileSync(join(ROOT, "src/styles/tokens/tokens-dark.json"), "utf8"));
const tokens = new Set([...flattenTokens(v2), ...flattenTokens(dark)]);
const violations = [];

for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel) || rel.includes("/__tests__/") || /\.test\.(ts|tsx)$/.test(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const lit = m[0].toLowerCase();
      violations.push(
        `${rel}:${i + 1}  ${m[0]}${tokens.has(lit) ? " (token value)" : " (colour literal)"}`,
      );
    }
  });
}

if (violations.length) {
  console.error(
    "Token guard: hex colour literals found outside the token layer:\n" + violations.join("\n"),
  );
  process.exit(1);
}
console.log("Token guard: OK — no hex colour literals outside the token/CSS-var layer.");
