#!/usr/bin/env node
/**
 * Load a Vercel env file into the current job's environment without letting the
 * shell evaluate the values.
 *
 * `vercel env pull` writes `.vercel/.env.production.local` as `KEY="value"`
 * lines. Sourcing that file in bash would expand `$`, backticks and globs
 * inside double-quoted passwords, so the values are parsed here and written to
 * `$GITHUB_ENV` (heredoc form, so newlines and quotes survive) instead.
 *
 * Usage: node scripts/load-vercel-env.mjs [file]
 *   file defaults to .vercel/.env.production.local
 * Without $GITHUB_ENV (local runs) the values are applied to process.env for
 * the duration of this process only, which is not useful outside CI.
 */
import { appendFileSync, readFileSync } from "node:fs";

const file = process.argv[2] ?? ".vercel/.env.production.local";
const delimiter = "__GHA_ENV_EOF__";

/** Parse a dotenv-style value, honouring the quoting `vercel pull` emits. */
function parseValue(raw) {
  const value = raw.trim();
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      if (quote === '"') {
        try {
          return JSON.parse(value);
        } catch {
          return value.slice(1, -1);
        }
      }
      return value.slice(1, -1);
    }
  }
  // Unquoted values may carry a trailing comment: KEY=value # note
  return value.replace(/\s+#.*$/, "");
}

const entries = [];
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line || line.trimStart().startsWith("#")) continue;
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) continue;
  entries.push([match[1], parseValue(match[2])]);
}

const target = process.env.GITHUB_ENV;
if (target) {
  const body = entries
    .map(([key, value]) => `${key}<<${delimiter}\n${value}\n${delimiter}`)
    .join("\n");
  appendFileSync(target, `${body}\n`);
} else {
  for (const [key, value] of entries) process.env[key] = value;
}

// Names only: the values are secrets.
console.log(
  `Loaded ${entries.length} variables from ${file}: ${entries
    .map(([key]) => key)
    .sort()
    .join(", ")}`,
);
