/**
 * Fix Schema - Make optional fields optional
 */

import Surreal from "surrealdb";

const endpoint = (process.env.SURREAL_URL || "");
const db = new Surreal();

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });

  console.log("Fixing schema...");
  
  try {
    await db.query("DEFINE FIELD IF NOT EXISTS backlinks ON page TYPE option<array<record<page>>>");
    console.log("✓ backlinks");
  } catch(e) { console.log("✗ backlinks:", e.message); }
  
  try {
    await db.query("DEFINE FIELD IF NOT EXISTS connects_to ON page TYPE option<array<string>>");
    console.log("✓ connects_to");
  } catch(e) { console.log("✗ connects_to:", e.message); }

  console.log("\n✅ Schema fixed!");
  await db.close();
}

main();
