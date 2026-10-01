/**
 * Auto-Translation Script for ESG Hub Content
 * 
 * Fetches all pages from SurrealDB and auto-translates missing
 * title, description, and content fields to Chinese (zh) and Hindi (hi)
 * using DeepSeek API.
 * 
 * Run: node scripts/auto-translate.mjs
 * 
 * Prerequisites:
 * - Run migration script first: node scripts/migrate-i18n-fields.mjs
 * - Set DEEPSEEK_API_KEY environment variable
 * - Set SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, SURREAL_DATABASE
 */

import { getNamespace } from "./lib/db-env.mjs";
import Surreal from "surrealdb";

const SURREAL_URL = process.env.SURREAL_URL;
const SURREAL_USERNAME = process.env.SURREAL_USERNAME;
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD;
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!SURREAL_URL || !SURREAL_USERNAME || !SURREAL_PASSWORD || !SURREAL_DATABASE) {
  console.error("Error: Missing required environment variables.");
  console.error("Required: SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, SURREAL_DATABASE");
  process.exit(1);
}

if (!DEEPSEEK_API_KEY) {
  console.error("Error: DEEPSEEK_API_KEY environment variable is required.");
  process.exit(1);
}

const db = new Surreal();

async function connectDB() {
  await db.connect(`${SURREAL_URL}/rpc`);
  await db.use({ namespace: SURREAL_NAMESPACE, database: SURREAL_DATABASE });
  await db.signin({ username: SURREAL_USERNAME, password: SURREAL_PASSWORD });
  console.log("✅ Connected to SurrealDB");
}

async function translateText(text, targetLang) {
  const langName = targetLang === "zh" ? "Chinese (Simplified)" : "Hindi";
  
  const systemPrompt = `You are a professional translator. Translate the following ESG-related content from English to ${langName}. 
- Preserve all markdown formatting (headers, bold, italic, links, lists, code blocks)
- Keep technical ESG terms in English with ${langName} translation in parentheses if helpful
- Maintain the original structure and line breaks
- Do NOT add any explanations or comments, only provide the translation`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

async function updatePage(pageId, updates) {
  try {
    await db.query(
      `UPDATE $id SET title_zh = $title_zh, title_hi = $title_hi, description_zh = $description_zh, description_hi = $description_hi, content_zh = $content_zh, content_hi = $content_hi`,
      {
        id: pageId,
        title_zh: updates.title_zh || null,
        title_hi: updates.title_hi || null,
        description_zh: updates.description_zh || null,
        description_hi: updates.description_hi || null,
        content_zh: updates.content_zh || null,
        content_hi: updates.content_hi || null,
      }
    );
    return true;
  } catch (error) {
    console.error(`Failed to update ${pageId}:`, error);
    return false;
  }
}

async function main() {
  console.log("🔄 Starting auto-translation...");
  console.log(`Endpoint: ${SURREAL_URL}`);
  console.log(`Namespace: ${SURREAL_NAMESPACE}`);
  console.log(`Database: ${SURREAL_DATABASE}`);
  
  try {
    await connectDB();
    
    console.log("\n📄 Fetching all pages from database...");
    const result = await db.query(`
      SELECT id, title, title_zh, title_hi, description, description_zh, description_hi, content, content_zh, content_hi 
      FROM page 
      WHERE title IS NOT NONE
    `);
    
    const pageList = result[0] || [];
    console.log(`   Found ${pageList.length} pages`);
    
    let translated = 0;
    let skipped = 0;
    let errors = 0;
    let apiCalls = 0;
    
    for (let i = 0; i < pageList.length; i++) {
      const page = pageList[i];
      const pageId = page.id;
      const _updates = {};
      
      const needsZh = !page.title_zh || page.title_zh === "";
      const needsHi = !page.title_hi || page.title_hi === "";
      const needsDescZh = !page.description_zh || page.description_zh === "";
      const needsDescHi = !page.description_hi || page.description_hi === "";
      const needsContentZh = !page.content_zh || page.content_zh === "";
      const needsContentHi = !page.content_hi || page.content_hi === "";
      
      if (!needsZh && !needsHi && !needsDescZh && !needsDescHi && !needsContentZh && !needsContentHi) {
        skipped++;
        if ((i + 1) % 20 === 0) {
          console.log(`[${i + 1}/${pageList.length}] ⏭️  skipped (all translated)`);
        }
        continue;
      }
      
      console.log(`\n[${i + 1}/${pageList.length}] 📝 ${page.title?.substring(0, 40) || "Untitled"}...`);
      
      const translations = {};
      
      if (needsZh || needsHi) {
        const titlePromises = [];
        if (needsZh) {
          titlePromises.push(translateText(page.title, "zh").then(r => { translations.title_zh = r; apiCalls++; }));
        }
        if (needsHi) {
          titlePromises.push(translateText(page.title, "hi").then(r => { translations.title_hi = r; apiCalls++; }));
        }
        console.log("   → translating title (zh+hi)...");
        await Promise.all(titlePromises);
      }
      
      if (page.description && (needsDescZh || needsDescHi)) {
        const descPromises = [];
        if (needsDescZh) {
          descPromises.push(translateText(page.description, "zh").then(r => { translations.description_zh = r; apiCalls++; }));
        }
        if (needsDescHi) {
          descPromises.push(translateText(page.description, "hi").then(r => { translations.description_hi = r; apiCalls++; }));
        }
        console.log("   → translating description (zh+hi)...");
        await Promise.all(descPromises);
      }
      
      if (page.content && (needsContentZh || needsContentHi)) {
        const contentPromises = [];
        if (needsContentZh) {
          contentPromises.push(translateText(page.content, "zh").then(r => { translations.content_zh = r; apiCalls++; }));
        }
        if (needsContentHi) {
          contentPromises.push(translateText(page.content, "hi").then(r => { translations.content_hi = r; apiCalls++; }));
        }
        console.log("   → translating content (zh+hi)...");
        await Promise.all(contentPromises);
      }
      
      if (Object.keys(translations).length > 0) {
        const success = await updatePage(pageId, translations);
        if (success) {
          translated++;
          console.log(`   ✅ Updated ${Object.keys(translations).length} fields`);
        } else {
          errors++;
        }
      } else {
        skipped++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log("\n✅ Translation complete!");
    console.log(`   Pages translated: ${translated}`);
    console.log(`   Pages skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total DeepSeek API calls: ${apiCalls}`);
    
    await db.close();
    process.exit(0);
    
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

main();
