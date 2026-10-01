/**
 * Migrate all Jekyll Markdown content pages into SurrealDB
 * 
 * Reads all .md files from the Jekyll repo, parses frontmatter,
 * extracts content, and inserts into SurrealDB page table.
 * 
 * Run: node scripts/migrate-content.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
import fs from "fs";
import path from "path";

const JEKYLL_ROOT = "/home/ubuntu/esg-resources-github-repo";
const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

// Files/dirs to skip
const SKIP_FILES = new Set([
  "README.md", "LICENSE.md", "DEPLOYMENT.md", "DEPLOYMENT-GUIDE.md",
  "REPOSITORY-INFO.md", "TODO.md", "changelog.md", "templates.md",
  "qa-wcag-checklist.md", "qa-performance.md", "site-review-checklist.md",
  "gap-analysis-current-content.txt"
]);

const SKIP_DIRS = new Set([
  "_site", ".git", "node_modules", "docs", "backend", "vendor",
  "_layouts", "_includes", "scripts"
]);

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

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fmRaw = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of fmRaw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function deriveSection(permalink) {
  if (!permalink || permalink === "/") return "home";
  const parts = permalink.replace(/^\/|\/$/g, "").split("/");
  return parts[0] || "home";
}

function deriveSubsection(permalink) {
  if (!permalink) return null;
  const parts = permalink.replace(/^\/|\/$/g, "").split("/");
  return parts.length > 1 ? parts[1] : null;
}

function deriveSlug(permalink, filePath) {
  if (permalink) {
    const parts = permalink.replace(/^\/|\/$/g, "").split("/");
    return parts[parts.length - 1] || parts[0] || "index";
  }
  return path.basename(filePath, ".md");
}

function escapeSurrealString(str) {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function findMarkdownFiles(dir, relativeTo) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(relativeTo, fullPath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...findMarkdownFiles(fullPath, relativeTo));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (SKIP_FILES.has(entry.name)) continue;
      results.push({ fullPath, relPath });
    }
  }

  return results;
}

async function main() {
  console.log("Starting content migration from Jekyll to SurrealDB...");
  console.log(`Source: ${JEKYLL_ROOT}`);
  console.log(`Target: ${SURREAL_URL} (ns: ${SURREAL_NAMESPACE}, db: ${SURREAL_DATABASE})`);

  // Clear existing pages
  console.log("\nClearing existing pages...");
  await querySurreal("DELETE page;");

  // Find all markdown files
  const files = findMarkdownFiles(JEKYLL_ROOT, JEKYLL_ROOT);
  console.log(`Found ${files.length} Markdown files to migrate.\n`);

  let success = 0;
  let errors = 0;
  let skipped = 0;

  // Process in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const statements = [];

    for (const { fullPath, relPath } of batch) {
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(raw);

        // Skip files without frontmatter (not content pages)
        if (!frontmatter.title && !frontmatter.permalink) {
          skipped++;
          continue;
        }

        const permalink = frontmatter.permalink || `/${relPath.replace(/\.md$/, "/").replace(/index\/$/, "")}`;
        const slug = deriveSlug(permalink, relPath);
        const section = deriveSection(permalink);
        const subsection = deriveSubsection(permalink);
        const layout = frontmatter.layout || "article";
        const title = frontmatter.title || slug;
        const description = frontmatter.description || null;
        const keywords = frontmatter.keywords || null;
        const pillar = frontmatter.pillar || null;
        const parent = frontmatter.parent || null;
        const redirect_to = frontmatter.redirect_to || null;

        let stmt = `CREATE page SET slug = '${escapeSurrealString(slug)}', title = '${escapeSurrealString(title)}', permalink = '${escapeSurrealString(permalink)}', layout = '${escapeSurrealString(layout)}', content = '${escapeSurrealString(body)}', section = '${escapeSurrealString(section)}'`;

        if (subsection) stmt += `, subsection = '${escapeSurrealString(subsection)}'`;
        if (description) stmt += `, description = '${escapeSurrealString(description)}'`;
        if (keywords) stmt += `, keywords = '${escapeSurrealString(keywords)}'`;
        if (pillar) stmt += `, pillar = '${escapeSurrealString(pillar)}'`;
        if (parent) stmt += `, parent = '${escapeSurrealString(parent)}'`;
        if (redirect_to) stmt += `, redirect_to = '${escapeSurrealString(redirect_to)}'`;

        stmt += ";";
        statements.push({ stmt, title, relPath });
      } catch (err) {
        console.error(`  ERROR parsing ${relPath}: ${err.message}`);
        errors++;
      }
    }

    // Execute batch
    if (statements.length > 0) {
      const batchQuery = statements.map(s => s.stmt).join("\n");
      try {
        const results = await querySurreal(batchQuery);
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === "OK") {
            success++;
            console.log(`  OK: ${statements[j]?.title || "unknown"} (${statements[j]?.relPath})`);
          } else {
            errors++;
            console.error(`  FAIL: ${statements[j]?.title || "unknown"} - ${JSON.stringify(results[j])}`);
          }
        }
      } catch (err) {
        // If batch fails, try one by one
        console.warn(`  Batch failed, retrying individually: ${err.message}`);
        for (const { stmt, title, relPath } of statements) {
          try {
            const results = await querySurreal(stmt);
            if (results[0]?.status === "OK") {
              success++;
              console.log(`  OK: ${title} (${relPath})`);
            } else {
              errors++;
              console.error(`  FAIL: ${title} - ${JSON.stringify(results[0])}`);
            }
          } catch (err2) {
            errors++;
            console.error(`  ERROR: ${title} (${relPath}): ${err2.message}`);
          }
        }
      }
    }
  }

  // Set up navigation
  console.log("\nSetting up navigation...");
  await querySurreal("DELETE navigation;");

  const navQuery = `
    CREATE navigation SET nav_type = 'primary', label = 'Home', href = '/', sort_order = 0;
    CREATE navigation SET nav_type = 'primary', label = 'Environmental', href = '/environmental/', sort_order = 1;
    CREATE navigation SET nav_type = 'primary', label = 'Social', href = '/social/', sort_order = 2;
    CREATE navigation SET nav_type = 'primary', label = 'Governance', href = '/governance/', sort_order = 3;
    CREATE navigation SET nav_type = 'primary', label = 'Standards', href = '/standards/', sort_order = 4;
    CREATE navigation SET nav_type = 'primary', label = 'Regional', href = '/hk-apac/', sort_order = 5;
    CREATE navigation SET nav_type = 'primary', label = 'Learn', href = '/learning/', sort_order = 6;
    CREATE navigation SET nav_type = 'primary', label = 'SDGs', href = '/sdg/', sort_order = 7;
    CREATE navigation SET nav_type = 'secondary', label = 'Ratings', href = '/ratings/', sort_order = 0;
    CREATE navigation SET nav_type = 'secondary', label = 'Finance', href = '/finance/', sort_order = 1;
    CREATE navigation SET nav_type = 'secondary', label = 'Investment', href = '/investment/', sort_order = 2;
    CREATE navigation SET nav_type = 'secondary', label = 'Frameworks', href = '/frameworks/', sort_order = 3;
    CREATE navigation SET nav_type = 'secondary', label = 'Fundamentals', href = '/fundamentals/', sort_order = 4;
    CREATE navigation SET nav_type = 'secondary', label = 'Emerging', href = '/emerging-topics/', sort_order = 5;
    CREATE navigation SET nav_type = 'secondary', label = 'Books', href = '/books/', sort_order = 6;
    CREATE navigation SET nav_type = 'secondary', label = 'Glossary', href = '/glossary/', sort_order = 7;
  `;
  await querySurreal(navQuery);
  console.log("Navigation setup complete.");

  console.log(`\n=== Migration Summary ===`);
  console.log(`  Success: ${success}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${files.length}`);

  // Verify count
  const countResult = await querySurreal("SELECT count() FROM page GROUP ALL;");
  console.log(`  Pages in DB: ${JSON.stringify(countResult)}`);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
