/**
 * Add Translation Fields to SurrealDB Schema
 * 
 * Adds fields for Chinese (zh) and Hindi (hi) translations to:
 * - page table: title_zh, title_hi, description_zh, description_hi, content_zh, content_hi
 * - resource table: title_zh, title_hi, description_zh, description_hi
 * 
 * Run: node scripts/add-translation-fields.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
import Surreal from "surrealdb";

const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

const db = new Surreal();

async function main() {
  console.log("Connecting to SurrealDB...");
  
  try {
    await db.connect(`${SURREAL_URL}/rpc`);
    await db.signin({
      username: SURREAL_USERNAME,
      password: SURREAL_PASSWORD,
    });
    await db.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });
    
    console.log("Connected successfully!");
    
    // Fields to add to page table
    const pageFields = [
      { name: "title_zh", type: "option<string>" },
      { name: "title_hi", type: "option<string>" },
      { name: "description_zh", type: "option<string>" },
      { name: "description_hi", type: "option<string>" },
      { name: "content_zh", type: "option<string>" },
      { name: "content_hi", type: "option<string>" },
    ];
    
    // Fields to add to resource table
    const resourceFields = [
      { name: "title_zh", type: "option<string>" },
      { name: "title_hi", type: "option<string>" },
      { name: "description_zh", type: "option<string>" },
      { name: "description_hi", type: "option<string>" },
    ];
    
    // Add fields to page table
    console.log("\nAdding translation fields to 'page' table...");
    for (const field of pageFields) {
      try {
        await db.query(`DEFINE FIELD IF NOT EXISTS ${field.name} ON page TYPE ${field.type}`);
        console.log(`  ✓ Added ${field.name} to page`);
      } catch (err) {
        console.error(`  ✗ Error adding ${field.name}:`, err.message);
      }
    }
    
    // Add fields to resource table
    console.log("\nAdding translation fields to 'resource' table...");
    for (const field of resourceFields) {
      try {
        await db.query(`DEFINE FIELD IF NOT EXISTS ${field.name} ON resource TYPE ${field.type}`);
        console.log(`  ✓ Added ${field.name} to resource`);
      } catch (err) {
        console.error(`  ✗ Error adding ${field.name}:`, err.message);
      }
    }
    
    console.log("\n✅ Migration complete!");
    
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
