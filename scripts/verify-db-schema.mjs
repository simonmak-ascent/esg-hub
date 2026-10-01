/**
 * Database Schema Verification Script
 * Run: node scripts/verify-db-schema.mjs
 * 
 * Verifies:
 * - Required indexes exist
 * - Permalinks are unique
 * - Required fields are present
 * - KM tables exist (term, framework, industry, entity, source, scrape_job, content_enhancement_log)
 * - RELATION types exist (related_to, defines, cites, regulates, applies_to)
 * - KM indexes (FULLTEXT, HNSW, UNIQUE)
 * - page.last_verified field exists
 */

import { getDbEnv, querySurrealAll } from "./lib/db-env.mjs";

const env = getDbEnv();

async function querySurreal(sql) {
  return querySurrealAll(sql, env);
}

async function verifySchema() {
  console.log("🔍 Verifying ESG Hub Database Schema...\n");

  try {
    // Check table exists
    console.log("1. Checking if 'page' table exists...");
    const tableCheck = await querySurreal("INFO FOR TABLE page;");
    console.log("   ✅ Table 'page' exists\n");

    // Check for indexes
    console.log("2. Checking indexes on 'page' table...");
    const indexes = tableCheck[0]?.result?.indexes || {};
    console.log(`   Found indexes: ${Object.keys(indexes).join(", ") || "none"}`);

    // Check for unique constraint on permalink
    // INFO FOR TABLE returns indexes as { <name>: "DEFINE INDEX ... ON page FIELDS <field> UNIQUE" }
    console.log("\n3. Checking for unique constraint on 'permalink'...");
    const uniquePermalink = Object.values(indexes).some(
      (def) => typeof def === "string" && /FIELDS\s+permalink\b/i.test(def) && /\bUNIQUE\b/i.test(def)
    );
    if (uniquePermalink) {
      console.log("   ✅ Unique index on 'permalink' exists");
    } else {
      console.log("   ⚠️  No unique index on 'permalink' - duplicates possible");
    }

    // Check for indexes on commonly queried fields
    console.log("\n4. Checking commonly queried fields...");
    const recommendedIndexes = ["section", "slug", "related_pages", "backlinks"];
    for (const field of recommendedIndexes) {
      const hasIndex = Object.keys(indexes).some(k => k.includes(field));
      console.log(`   ${hasIndex ? "✅" : "⚠️ "} Index on '${field}': ${hasIndex ? "exists" : "missing"}`);
    }

    // Check for duplicate permalinks
    // SurrealDB does not support HAVING — filter after aggregation using a nested SELECT
    console.log("\n5. Checking for duplicate permalinks...");
    const duplicates = await querySurreal(`
      SELECT permalink, cnt FROM (
        SELECT permalink, count() AS cnt FROM page
        WHERE permalink IS NOT NONE
        GROUP BY permalink
      ) WHERE cnt > 1
    `);
    const dupList = duplicates[0]?.result || [];
    if (dupList.length > 0) {
      console.log(`   ⚠️  Found ${dupList.length} duplicate permalinks:`);
      dupList.slice(0, 5).forEach(d => {
        console.log(`      - ${d.permalink} (${d.cnt} times)`);
      });
    } else {
      console.log("   ✅ No duplicate permalinks found");
    }

    // Check for missing required fields
    console.log("\n6. Checking for pages with missing required fields...");
    const missingTitle = await querySurreal("SELECT count() FROM page WHERE title IS NONE GROUP ALL;");
    const missingPermalink = await querySurreal("SELECT count() FROM page WHERE permalink IS NONE GROUP ALL;");
    const missingSection = await querySurreal("SELECT count() FROM page WHERE section IS NONE GROUP ALL;");

    const titleCount = missingTitle[0]?.result?.[0]?.count || 0;
    const permalinkCount = missingPermalink[0]?.result?.[0]?.count || 0;
    const sectionCount = missingSection[0]?.result?.[0]?.count || 0;

    console.log(`   ${titleCount === 0 ? "✅" : "⚠️ "} Pages missing title: ${titleCount}`);
    console.log(`   ${permalinkCount === 0 ? "✅" : "⚠️ "} Pages missing permalink: ${permalinkCount}`);
    console.log(`   ${sectionCount === 0 ? "✅" : "⚠️ "} Pages missing section: ${sectionCount}`);

    // ---- KM Schema Verification ----\n    console.log(\"\\n7. Checking KM tables...\");\n    const kmTables = [\"term\", \"framework\", \"industry\", \"entity\", \"source\", \"scrape_job\", \"content_enhancement_log\"];\n    for (const table of kmTables) {\n      try {\n        await querySurreal(`SELECT count() FROM ${table} GROUP ALL;`);\n        console.log(`   ✅ Table '${table}' exists`);\n      } catch (e) {\n        console.log(`   ❌ Table '${table}' missing: ${e.message.split('\\n')[0]}`);\n        process.exitCode = 1;\n      }\n    }\n\n    console.log(\"\\n8. Checking RELATION types...\");\n    const relTypes = [\"related_to\", \"defines\", \"cites\", \"regulates\", \"applies_to\"];\n    for (const rel of relTypes) {\n      try {\n        const info = await querySurreal(`INFO FOR TABLE ${rel};`);\n        const def = JSON.stringify(info);\n        const isRel = /TYPE\\s+RELATION/i.test(def);\n        console.log(`   ${isRel ? \"✅\" : \"⚠️\"} RELATION '${rel}': ${isRel ? \"exists as RELATION\" : \"exists but not TYPE RELATION\"}`);\n      } catch (e) {\n        console.log(`   ❌ RELATION '${rel}' missing`);\n        process.exitCode = 1;\n      }\n    }\n\n    console.log(\"\\n9. Checking KM indexes...\");\n    const kmIndexTargets = [\n      { table: \"term\", fields: \"definition\", type: \"FULLTEXT\" },\n      { table: \"term\", fields: \"embedding\", type: \"HNSW\" },\n      { table: \"framework\", fields: \"embedding\", type: \"HNSW\" },\n      { table: \"industry\", fields: \"embedding\", type: \"HNSW\" },\n      { table: \"entity\", fields: \"embedding\", type: \"HNSW\" },\n      { table: \"related_to\", fields: \"in, out\", type: \"UNIQUE\" },\n      { table: \"defines\", fields: \"in, out\", type: \"UNIQUE\" },\n      { table: \"cites\", fields: \"in, out, context\", type: \"UNIQUE\" },\n      { table: \"regulates\", fields: \"in, out, jurisdiction\", type: \"UNIQUE\" },\n      { table: \"applies_to\", fields: \"in, out\", type: \"UNIQUE\" },\n    ];\n    for (const { table, fields, type } of kmIndexTargets) {\n      try {\n        const info = await querySurreal(`INFO FOR TABLE ${table};`);\n        const indexes = info[0]?.result?.indexes || {};\n        const hasIndex = Object.values(indexes).some(\n          d => typeof d === \"string\" && new RegExp(`FIELDS\\\\s+${fields.replace(/, /g, \",\\\\s*\")}`, \"i\").test(d) && new RegExp(type, \"i\").test(d)\n        );\n        console.log(`   ${hasIndex ? \"✅\" : \"❌\"} ${table}(${fields}): ${type}`);\n        if (!hasIndex) process.exitCode = 1;\n      } catch (e) {\n        console.log(`   ❌ ${table}: ${e.message.split('\\n')[0]}`);\n        process.exitCode = 1;\n      }\n    }\n\n    console.log(\"\\n10. Checking page.last_verified field...\");\n    try {\n      const info = await querySurreal(\"INFO FOR TABLE page;\");\n      const fields = info[0]?.result?.fields || {};\n      const hasField = Object.keys(fields).some(k => k === \"last_verified\");\n      console.log(`   ${hasField ? \"✅\" : \"❌\"} page.last_verified: ${hasField ? \"exists\" : \"missing\"}`);\n      if (!hasField) process.exitCode = 1;\n    } catch (e) {\n      console.log(`   ❌ ${e.message.split('\\n')[0]}`);\n      process.exitCode = 1;\n    }\n\n    // Summary
    console.log("\n📊 Summary:");
    console.log(`   Total pages: ${(await querySurreal("SELECT count() FROM page GROUP ALL;"))[0]?.result?.[0]?.count || 0}`);
    console.log(`   Total sections: ${(await querySurreal("SELECT section, count() FROM page WHERE section IS NOT NONE GROUP BY section;"))[0]?.result?.length || 0}`);

    // Recommendations
    console.log("\n📝 Recommendations:");
    console.log("   To add unique index on permalink:");
    console.log("   DEFINE INDEX unique_permalink ON TABLE page FIELDS permalink UNIQUE;");
    console.log("\n   To add index on section:");
    console.log("   DEFINE INDEX idx_section ON TABLE page FIELDS section;");

    console.log("\n✅ Schema verification complete!");

  } catch (error) {
    console.error("❌ Error verifying schema:", error.message);
  }
}

verifySchema();
