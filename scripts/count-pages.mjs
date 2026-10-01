import Surreal from "surrealdb";

const endpoint = (process.env.SURREAL_URL || "");
const db = new Surreal();

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });
  
  const result = await db.query("SELECT count() AS total FROM page GROUP BY NONE");
  console.log("Total pages:", result[0]?.[0]?.total || "error");
  
  const pages = await db.query("SELECT id FROM page LIMIT 300");
  console.log("Page IDs:");
  for (const p of pages[0]) {
    console.log(p.id);
  }
  
  await db.close();
}

main();
