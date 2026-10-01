/**
 * Update ESG Hub database schema for cross-references
 * Run: node scripts/update-schema-crossrefs.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

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

async function main() {
  console.log("Updating ESG Hub schema for cross-references...\n");

  try {
    // Add standards field (array of strings)
    console.log("1. Adding 'standards' field...");
    await querySurreal(`
      DEFINE FIELD standards ON page TYPE array<string> DEFAULT [];
    `);
    console.log("   ✓ standards field added\n");

    // Add related_pages field (array of record references)
    console.log("2. Adding 'related_pages' field...");
    await querySurreal(`
      DEFINE FIELD related_pages ON page TYPE array<record<page>> DEFAULT [];
    `);
    console.log("   ✓ related_pages field added\n");

    // Add connects_to field (array of strings for E/S/G)
    console.log("3. Adding 'connects_to' field...");
    await querySurreal(`
      DEFINE FIELD connects_to ON page TYPE array<string> DEFAULT [];
    `);
    console.log("   ✓ connects_to field added\n");

    // Add backlinks field (array of record references)
    console.log("4. Adding 'backlinks' field...");
    await querySurreal(`
      DEFINE FIELD backlinks ON page TYPE array<record<page>> DEFAULT [];
    `);
    console.log("   ✓ backlinks field added\n");

    // Create index on standards for faster queries
    console.log("5. Creating index on standards field...");
    await querySurreal(`
      DEFINE INDEX idx_page_standards ON page COLUMNS standards;
    `);
    console.log("   ✓ Index created\n");

    // Create index on connects_to for faster queries
    console.log("6. Creating index on connects_to field...");
    await querySurreal(`
      DEFINE INDEX idx_page_connects_to ON page COLUMNS connects_to;
    `);
    console.log("   ✓ Index created\n");

    console.log("✅ Schema update complete!");
    console.log("\nNew fields added:");
    console.log("  - standards: Array of applicable standard names");
    console.log("  - related_pages: Array of related page references");
    console.log("  - connects_to: Array of ESG pillars [E, S, G]");
    console.log("  - backlinks: Array of pages linking to this page");
    
  } catch (error) {
    console.error("❌ Schema update failed:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
