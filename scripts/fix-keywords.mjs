/**
 * Fix Schema - Make keywords optional string
 */

import Surreal from "surrealdb";

const endpoint = (process.env.SURREAL_URL || "");
const db = new Surreal();

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });

  console.log("Fixing keywords field...");
  
  try {
    await db.query("REMOVE FIELD keywords ON page");
  } catch(_e) {}
  
  try {
    await db.query("DEFINE FIELD IF NOT EXISTS keywords ON page TYPE option<string>");
    console.log("✓ keywords fixed as string");
  } catch(_e) {
    console.log("✗:", e.message);
  }

  console.log("\n✅ Done!");
  await db.close();
}

main();
