/**
 * SurrealDB Migration: Add i18n Fields for Multilingual Support
 * 
 * Adds fields for Chinese (zh) and Hindi (hi) translations:
 *   - title_zh, title_hi
 *   - description_zh, description_hi
 *   - content_zh, content_hi
 * 
 * Run with Node.js:
 *   node scripts/migrate-i18n-fields.mjs
 * 
 * Or run directly via SurrealDB CLI:
 *   surreal sql --conn $SURREAL_URL --user $SURREAL_USERNAME --pass $SURREAL_PASSWORD --ns $SURREAL_NAMESPACE --db $SURREAL_DATABASE --pretty
 * 
 * Then execute these SurrealQL commands:
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS title_zh TYPE option<string>;
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS title_hi TYPE option<string>;
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS description_zh TYPE option<string>;
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS description_hi TYPE option<string>;
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS content_zh TYPE option<string>;
 *   ALTER TABLE page ADD FIELD IF NOT EXISTS content_hi TYPE option<string>;
 */

import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = process.env.SURREAL_URL;
const SURREAL_USERNAME = process.env.SURREAL_USERNAME;
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD;
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE;

if (!SURREAL_URL || !SURREAL_USERNAME || !SURREAL_PASSWORD || !SURREAL_DATABASE) {
  console.error("Error: Missing required environment variables.");
  console.error("Required: SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, SURREAL_DATABASE");
  process.exit(1);
}

async function querySurreal(sql) {
  const res = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Accept": "application/json",
      "surreal-ns": SURREAL_NAMESPACE,
      "surreal-db": SURREAL_DATABASE,
      "Authorization": "Basic " + Buffer.from(`${SURREAL_USERNAME}:${SURREAL_PASSWORD}`).toString("base64"),
    },
    body: sql,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SurrealDB error ${res.status}: ${text}`);
  }

  return res.json();
}

const migrations = [
  "ALTER TABLE page ADD FIELD IF NOT EXISTS title_zh TYPE option<string>;",
  "ALTER TABLE page ADD FIELD IF NOT EXISTS title_hi TYPE option<string>;",
  "ALTER TABLE page ADD FIELD IF NOT EXISTS description_zh TYPE option<string>;",
  "ALTER TABLE page ADD FIELD IF NOT EXISTS description_hi TYPE option<string>;",
  "ALTER TABLE page ADD FIELD IF NOT EXISTS content_zh TYPE option<string>;",
  "ALTER TABLE page ADD FIELD IF NOT EXISTS content_hi TYPE option<string>;",
];

async function main() {
  console.log("🔄 Running i18n fields migration...");
  console.log(`Endpoint: ${SURREAL_URL}`);
  console.log(`Namespace: ${SURREAL_NAMESPACE}`);
  console.log(`Database: ${SURREAL_DATABASE}`);
  console.log("");
  
  try {
    for (const sql of migrations) {
      console.log(`Running: ${sql}`);
      const results = await querySurreal(sql);
      for (const r of results) {
        if (r.status !== "OK") {
          console.error("  ERROR:", JSON.stringify(r));
        } else {
          console.log("  OK:", r.time || "completed");
        }
      }
    }
    
    // Verify fields were added
    console.log("\n📋 Verifying fields...");
    const info = await querySurreal("INFO FOR TABLE page;");
    const fields = info[0]?.result?.fields || {};
    
    const i18nFields = ["title_zh", "title_hi", "description_zh", "description_hi", "content_zh", "content_hi"];
    for (const field of i18nFields) {
      if (fields[field]) {
        console.log(`  ✅ ${field}: ${fields[field].type}`);
      } else {
        console.log(`  ⚠️  ${field}: not found (may already exist)`);
      }
    }
    
    console.log("\n✅ i18n migration complete!");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  }
}

main();
