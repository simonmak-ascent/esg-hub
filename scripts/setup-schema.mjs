/**
 * SurrealDB Schema Setup for ESG Hub
 * 
 * Tables:
 *   - page: All content pages (articles, hub pages, redirects)
 *   - navigation: Navigation structure (primary nav, secondary nav)
 * 
 * Run: node scripts/setup-schema.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

async function query(sql) {
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

const schema = `
-- ============================================
-- ESG Hub Schema
-- ============================================

-- Page table: stores all content pages
DEFINE TABLE IF NOT EXISTS page SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS slug ON page TYPE string;
DEFINE FIELD IF NOT EXISTS title ON page TYPE string;
DEFINE FIELD IF NOT EXISTS description ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS keywords ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS pillar ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS parent ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS permalink ON page TYPE string;
DEFINE FIELD IF NOT EXISTS layout ON page TYPE string DEFAULT 'article';
DEFINE FIELD IF NOT EXISTS content ON page TYPE string;
DEFINE FIELD IF NOT EXISTS redirect_to ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS section ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS subsection ON page TYPE option<string>;
DEFINE FIELD IF NOT EXISTS sort_order ON page TYPE option<int>;
DEFINE FIELD IF NOT EXISTS created_at ON page TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON page TYPE datetime DEFAULT time::now();

-- Indexes for fast lookups
DEFINE INDEX IF NOT EXISTS idx_page_permalink ON page FIELDS permalink UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_page_slug ON page FIELDS slug;
DEFINE INDEX IF NOT EXISTS idx_page_section ON page FIELDS section;
DEFINE INDEX IF NOT EXISTS idx_page_pillar ON page FIELDS pillar;

-- Full-text search indexes (separate indexes for title and content to support OR queries)
DEFINE ANALYZER IF NOT EXISTS esg_analyzer TOKENIZERS blank, class FILTERS lowercase, ascii, snowball(english);
DEFINE INDEX IF NOT EXISTS idx_page_title_search ON page FIELDS title FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);
DEFINE INDEX IF NOT EXISTS idx_page_content_search ON page FIELDS content FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);
DEFINE INDEX IF NOT EXISTS idx_page_title_zh_search ON page FIELDS title_zh FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);
DEFINE INDEX IF NOT EXISTS idx_page_title_hi_search ON page FIELDS title_hi FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);
DEFINE INDEX IF NOT EXISTS idx_page_content_zh_search ON page FIELDS content_zh FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);
DEFINE INDEX IF NOT EXISTS idx_page_content_hi_search ON page FIELDS content_hi FULLTEXT ANALYZER esg_analyzer BM25(1.2,0.75);

-- Navigation table: stores nav structure
DEFINE TABLE IF NOT EXISTS navigation SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS nav_type ON navigation TYPE string;
DEFINE FIELD IF NOT EXISTS label ON navigation TYPE string;
DEFINE FIELD IF NOT EXISTS href ON navigation TYPE string;
DEFINE FIELD IF NOT EXISTS sort_order ON navigation TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS icon ON navigation TYPE option<string>;
`;

async function main() {
  console.log("Setting up ESG Hub schema in SurrealDB...");
  console.log(`Endpoint: ${SURREAL_URL}`);
  console.log(`Namespace: ${SURREAL_NAMESPACE}`);
  console.log(`Database: ${SURREAL_DATABASE}`);
  
  try {
    const results = await query(schema);
    console.log("Schema setup results:");
    for (const r of results) {
      if (r.status !== "OK") {
        console.error("  ERROR:", JSON.stringify(r));
      } else {
        console.log("  OK:", r.time);
      }
    }
    console.log("Schema setup complete!");
  } catch (err) {
    console.error("Failed to set up schema:", err.message);
    process.exit(1);
  }
}

main();
