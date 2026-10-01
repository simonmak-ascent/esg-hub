import Surreal from "surrealdb";

const endpoint = process.env.SURREAL_URL || "";
const db = new Surreal();

async function main() {
  await db.connect(`${endpoint}/rpc`);
  await db.signin({ username: "root", password: process.env.SURREAL_PASSWORD || "" });
  await db.use({ namespace: "esg_hub", database: "main" });
  
  const result = await db.query("SELECT id, title, description FROM page LIMIT 20");
  console.log(JSON.stringify(result[0], null, 2));
  
  await db.close();
}

main();
