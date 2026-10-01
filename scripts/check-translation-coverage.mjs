/**
 * Translation Coverage Report Script
 * 
 * Reports how many pages have zh/hi translations populated in SurrealDB.
 * 
 * Run: node scripts/check-translation-coverage.mjs
 * 
 * Prerequisites:
 * - Set SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, SURREAL_DATABASE
 */

import { getNamespace } from "./lib/db-env.mjs";
import Surreal from "surrealdb";

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

const db = new Surreal();

async function connectDB() {
  await db.connect(`${SURREAL_URL}/rpc`);
  await db.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });
  await db.signin({ username: SURREAL_USERNAME, password: SURREAL_PASSWORD });
}

async function main() {
  console.log("🔍 Checking translation coverage...\n");
  
  await connectDB();
  
  const result = await db.query(`
    SELECT 
      count() as total,
      count(title_zh) as title_zh_count,
      count(title_hi) as title_hi_count,
      count(description_zh) as description_zh_count,
      count(description_hi) as description_hi_count,
      count(content_zh) as content_zh_count,
      count(content_hi) as content_hi_count
    FROM page
    WHERE title IS NOT NONE
    GROUP ALL
  `);
  
  const stats = result[0]?.[0] || {};
  const total = stats.total || 0;
  
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│          ESG Hub Translation Coverage Report              │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Total pages: ${total.toString().padEnd(48)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  
  const fields = [
    { key: "title_zh_count", label: "title_zh" },
    { key: "title_hi_count", label: "title_hi" },
    { key: "description_zh_count", label: "description_zh" },
    { key: "description_hi_count", label: "description_hi" },
    { key: "content_zh_count", label: "content_zh" },
    { key: "content_hi_count", label: "content_hi" },
  ];
  
  for (const field of fields) {
    const count = stats[field.key] || 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    const bar = "█".repeat(Math.floor((count / total) * 20)) + "░".repeat(20 - Math.floor((count / total) * 20));
    console.log(`│  ${field.label.padEnd(18)} ${count.toString().padStart(5)} / ${total} (${pct.padStart(5)}%) ${bar} │`);
  }
  
  console.log("└─────────────────────────────────────────────────────────────┘\n");
  
  const fullyTranslated = await db.query(`
    SELECT count() as count FROM page 
    WHERE title IS NOT NONE 
    AND title_zh IS NOT NONE AND title_zh != '' 
    AND title_hi IS NOT NONE AND title_hi != ''
    AND description_zh IS NOT NONE AND description_zh != ''
    AND description_hi IS NOT NONE AND description_hi != ''
    AND content_zh IS NOT NONE AND content_zh != ''
    AND content_hi IS NOT NONE AND content_hi != ''
    GROUP ALL
  `);
  
  const fullCount = fullyTranslated[0]?.[0]?.count || 0;
  console.log(`Pages with FULL translations (all 6 fields): ${fullCount} / ${total} (${total > 0 ? ((fullCount / total) * 100).toFixed(1) : "0.0"}%)\n`);
  
  const missingTranslations = await db.query(`
    SELECT id, title FROM page 
    WHERE title IS NOT NONE 
    AND (title_zh IS NONE OR title_zh = '' OR title_hi IS NONE OR title_hi = '')
    LIMIT 20
  `);
  
  if (missingTranslations[0]?.length > 0) {
    console.log("Sample pages missing translations (first 20):");
    for (const p of missingTranslations[0]) {
      console.log(`  - ${p.title?.substring(0, 50) || p.id}`);
    }
    console.log("");
  }
  
  await db.close();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
