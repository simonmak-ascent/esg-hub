import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = (process.env.SURREAL_URL || "");
const SURREAL_USERNAME = "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = "main";

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

async function checkStatus() {
  console.log("Checking cross-reference status...\n");
  
  try {
    // Check pages with standards
    const standardsResult = await querySurreal('SELECT count() FROM page WHERE standards IS NOT NULL GROUP ALL');
    const withStandards = standardsResult[0]?.result?.[0]?.count || 0;
    
    // Check total pages
    const totalResult = await querySurreal('SELECT count() FROM page GROUP ALL');
    const total = totalResult[0]?.result?.[0]?.count || 0;
    
    // Check pages with related_pages
    const relatedResult = await querySurreal('SELECT count() FROM page WHERE related_pages IS NOT NULL GROUP ALL');
    const withRelated = relatedResult[0]?.result?.[0]?.count || 0;
    
    // Check pages with backlinks
    const backlinksResult = await querySurreal('SELECT count() FROM page WHERE backlinks IS NOT NULL GROUP ALL');
    const withBacklinks = backlinksResult[0]?.result?.[0]?.count || 0;
    
    // Check sample page
    const sampleResult = await querySurreal('SELECT id, title, standards, connects_to, array::len(related_pages) as related_count FROM page WHERE standards IS NOT NULL LIMIT 1');
    const sample = sampleResult[0]?.result?.[0];
    
    console.log(`📊 Cross-Reference Status:`);
    console.log(`  Total pages: ${total}`);
    console.log(`  With standards: ${withStandards}/${total} (${Math.round(withStandards/total*100)}%)`);
    console.log(`  With related_pages: ${withRelated}/${total} (${Math.round(withRelated/total*100)}%)`);
    console.log(`  With backlinks: ${withBacklinks}/${total} (${Math.round(withBacklinks/total*100)}%)`);
    
    if (sample) {
      console.log(`\n📝 Sample page: ${sample.title}`);
      console.log(`  Standards: ${sample.standards?.length || 0}`);
      console.log(`  Connects to: ${sample.connects_to?.join(', ')}`);
      console.log(`  Related pages: ${sample.related_count || 0}`);
    }
    
    if (withStandards === total) {
      console.log(`\n✅ All pages have cross-references generated!`);
    } else {
      console.log(`\n⚠️  ${total - withStandards} pages still need cross-references`);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkStatus();
