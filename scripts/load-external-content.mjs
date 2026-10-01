#!/usr/bin/env node
/**
 * Load scraped external content into SurrealDB for AI search.
 * Creates an `external_resource` table with the scraped content.
 */

import { readFileSync } from 'fs';

const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_NS = 'esg_hub';
const SURREAL_DB = 'main';
const SURREAL_USER = 'root';
const SURREAL_PASS = process.env.SURREAL_PASSWORD || "";

async function query(sql) {
  const res = await fetch(`${SURREAL_URL}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'surreal-ns': SURREAL_NS,
      'surreal-db': SURREAL_DB,
      'Authorization': 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64'),
    },
    body: sql,
  });
  return res.json();
}

async function main() {
  // Create the external_resource table
  console.log('Creating external_resource table...');
  const schemaResult = await query(`
    DEFINE TABLE IF NOT EXISTS external_resource SCHEMAFULL;
    DEFINE FIELD IF NOT EXISTS url ON external_resource TYPE string;
    DEFINE FIELD IF NOT EXISTS title ON external_resource TYPE string;
    DEFINE FIELD IF NOT EXISTS description ON external_resource TYPE string;
    DEFINE FIELD IF NOT EXISTS content ON external_resource TYPE string;
    DEFINE FIELD IF NOT EXISTS domain ON external_resource TYPE string;
    DEFINE FIELD IF NOT EXISTS scraped_at ON external_resource TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS idx_external_url ON external_resource FIELDS url UNIQUE;
    DEFINE ANALYZER IF NOT EXISTS ext_analyzer TOKENIZERS blank, class FILTERS lowercase, ascii, snowball(english);
    DEFINE INDEX IF NOT EXISTS idx_ext_title_search ON external_resource FIELDS title FULLTEXT ANALYZER ext_analyzer BM25;
    DEFINE INDEX IF NOT EXISTS idx_ext_content_search ON external_resource FIELDS content FULLTEXT ANALYZER ext_analyzer BM25;
  `);
  console.log('Schema result:', JSON.stringify(schemaResult).slice(0, 200));

  // Load the scraped data
  const rawData = readFileSync('/home/ubuntu/scrape_esg_urls.json', 'utf-8');
  const data = JSON.parse(rawData);
  
  const successful = data.results.filter(r => r.output && r.output.success && r.output.content && r.output.content.trim().length > 50);
  console.log(`Found ${successful.length} successful scrapes with content`);

  let inserted = 0;
  let errors = 0;
  
  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < successful.length; i += batchSize) {
    const batch = successful.slice(i, i + batchSize);
    const statements = batch.map(r => {
      const o = r.output;
      // Escape single quotes and backslashes for SurrealQL
      const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      // Truncate content to 5000 chars
      const content = (o.content || '').slice(0, 5000);
      return `CREATE external_resource SET url = '${esc(o.url)}', title = '${esc(o.title)}', description = '${esc(o.description)}', content = '${esc(content)}', domain = '${esc(o.domain)}';`;
    }).join('\n');
    
    try {
      const result = await query(statements);
      const batchErrors = result.filter(r => r.status === 'ERR');
      inserted += batch.length - batchErrors.length;
      errors += batchErrors.length;
      if (batchErrors.length > 0) {
        batchErrors.forEach(e => console.error(`  Error: ${e.result}`));
      }
    } catch (err) {
      console.error(`Batch error at index ${i}:`, err.message);
      errors += batch.length;
    }
    
    if ((i + batchSize) % 50 === 0 || i + batchSize >= successful.length) {
      console.log(`Progress: ${Math.min(i + batchSize, successful.length)}/${successful.length} (${inserted} inserted, ${errors} errors)`);
    }
  }
  
  console.log(`\nDone! Inserted: ${inserted}, Errors: ${errors}`);
  
  // Verify count
  const countResult = await query('SELECT count() FROM external_resource GROUP ALL;');
  console.log('Total external_resource records:', JSON.stringify(countResult));
}

main().catch(console.error);
