/**
 * Generate cross-references for all ESG Hub pages
 * Automatically assigns standards, related pages, and pillar connections
 * Run: node scripts/generate-cross-references.mjs
 */

import { getNamespace } from "./lib/db-env.mjs";
const SURREAL_URL = process.env.SURREAL_URL || "";
const SURREAL_USERNAME = process.env.SURREAL_USERNAME || "root";
const SURREAL_PASSWORD = process.env.SURREAL_PASSWORD || "";
const SURREAL_NAMESPACE = getNamespace();
const SURREAL_DATABASE = process.env.SURREAL_DATABASE || "main";

async function querySurreal(sql, vars = {}) {
  let query = sql;
  if (Object.keys(vars).length > 0) {
    // Simple variable substitution for SurrealQL
    Object.entries(vars).forEach(([key, value]) => {
      const placeholder = `$${key}`;
      if (typeof value === 'string') {
        query = query.replace(new RegExp(placeholder, 'g'), `'${value.replace(/'/g, "\\'")}'`);
      } else if (Array.isArray(value)) {
        const arrayStr = value.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : v).join(', ');
        query = query.replace(new RegExp(placeholder, 'g'), `[${arrayStr}]`);
      } else {
        query = query.replace(new RegExp(placeholder, 'g'), value);
      }
    });
  }
  
  const res = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Accept": "application/json",
      "surreal-ns": SURREAL_NAMESPACE,
      "surreal-db": SURREAL_DATABASE,
      "Authorization": "Basic " + Buffer.from(`${SURREAL_USERNAME}:${SURREAL_PASSWORD}`).toString("base64"),
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SurrealDB error ${res.status}: ${text}`);
  }

  return res.json();
}

// Standards patterns for automatic detection
const STANDARDS_PATTERNS = {
  // GRI Environmental Standards (300 series)
  'GRI 301: Materials 2016': /\bGRI\s+301\b|\bmaterials\s+(use|consumption|input)\b|\bsustainable\s+sourcing\b/i,
  'GRI 302: Energy 2016': /\bGRI\s+302\b|\benergy\s+(consumption|intensity|efficiency)\b|\brenewable\s+energy\b/i,
  'GRI 303: Water and Effluents 2018': /\bGRI\s+303\b|\bwater\s+(withdrawal|consumption|discharge)\b|\bwater\s+stress\b|\baquatic\s+ecosystems?\b/i,
  'GRI 304: Biodiversity 2016': /\bGRI\s+304\b|\bbiodiversity\b|\bprotected\s+areas?\b|\bspecies\s+at\s+risk\b|\becosystem\s+services?\b/i,
  'GRI 305: Emissions 2016': /\bGRI\s+305\b|\bGHG\s+emissions?\b|\bgreenhouse\s+gas\b|\bcarbon\s+(footprint|accounting)\b|\bscope\s+[123]\b/i,
  'GRI 306: Waste 2020': /\bGRI\s+306\b|\bwaste\s+(generation|management|diversion)\b|\bhazardous\s+waste\b|\bcircular\s+economy\b/i,
  'GRI 307: Environmental Compliance 2016': /\bGRI\s+307\b|\benvironmental\s+compliance\b|\bISO\s+14001\b|\benvironmental\s+(permits?|violations?)\b/i,
  'GRI 308: Supplier Environmental Assessment 2016': /\bGRI\s+308\b|\bsupplier\s+environmental\b|\bsupply\s+chain\s+environmental\b/i,
  
  // GRI Social Standards (400 series)
  'GRI 401: Employment 2016': /\bGRI\s+401\b|\bemployment\s+(practices|turnover)\b|\bnew\s+employee\s+hires\b/i,
  'GRI 403: Occupational Health and Safety 2018': /\bGRI\s+403\b|\boccupational\s+(health|safety)\b|\bworker\s+safety\b|\bISO\s+45001\b|\bincident\s+reporting\b/i,
  'GRI 404: Training and Education 2016': /\bGRI\s+404\b|\btraining\s+and\s+education\b|\bskills\s+development\b|\btraining\s+hours?\b/i,
  'GRI 405: Diversity and Equal Opportunity 2016': /\bGRI\s+405\b|\bdiversity\s+and\s+equal\s+opportunity\b|\bgovernance\s+bodies?\b|\bemployee\s+diversity\b/i,
  'GRI 406: Non-discrimination 2016': /\bGRI\s+406\b|\bnon-discrimination\b|\banti-discrimination\b|\bdiscrimination\s+incidents?\b/i,
  'GRI 407: Freedom of Association 2016': /\bGRI\s+407\b|\bfreedom\s+of\s+association\b|\bcollective\s+bargaining\b|\bunion\s+relations?\b/i,
  'GRI 408: Child Labor 2016': /\bGRI\s+408\b|\bchild\s+labor\b/i,
  'GRI 409: Forced or Compulsory Labor 2016': /\bGRI\s+409\b|\bforced\s+labor\b|\bcompulsory\s+labor\b|\bhuman\s+trafficking\b/i,
  'GRI 410: Security Practices 2016': /\bGRI\s+410\b|\bsecurity\s+practices?\b/i,
  'GRI 411: Rights of Indigenous Peoples 2016': /\bGRI\s+411\b|\bindigenous\s+peoples?'?\s+rights\b|\bindigenous\s+rights\b/i,
  'GRI 412: Human Rights Assessment 2016': /\bGRI\s+412\b|\bhuman\s+rights\s+assessment\b|\bhuman\s+rights\s+due\s+diligence\b/i,
  'GRI 413: Local Communities 2016': /\bGRI\s+413\b|\blocal\s+communities\b|\bcommunity\s+engagement\b/i,
  'GRI 414: Supplier Social Assessment 2016': /\bGRI\s+414\b|\bsupplier\s+social\b|\bsupply\s+chain\s+social\b/i,
  'GRI 415: Public Policy 2016': /\bGRI\s+415\b|\bpublic\s+policy\b|\bpolitical\s+(contributions?|lobbying)\b/i,
  'GRI 416: Customer Health and Safety 2016': /\bGRI\s+416\b|\bcustomer\s+(health|safety)\b|\bproduct\s+safety\b/i,
  'GRI 417: Marketing and Labeling 2016': /\bGRI\s+417\b|\bmarketing\s+(and|&)\s+labeling\b|\bfair\s+marketing\b/i,
  'GRI 418: Customer Privacy 2016': /\bGRI\s+418\b|\bcustomer\s+privacy\b|\bdata\s+privacy\b|\bdata\s+protection\b/i,
  'GRI 419: Socioeconomic Compliance 2016': /\bGRI\s+419\b|\bsocioeconomic\s+compliance\b/i,
  
  // IFRS/ISSB Standards
  'IFRS S1: General Requirements for Sustainability-related Disclosures': /\bIFRS\s+S1\b|\bgeneral\s+sustainability\s+disclosures?\b/i,
  'IFRS S2: Climate-related Disclosures': /\bIFRS\s+S2\b|\bclimate-related\s+disclosures?\b/i,
  
  // Task Forces
  'TCFD: Task Force on Climate-related Financial Disclosures': /\bTCFD\b|\bTask\s+Force\s+on\s+Climate\b|\bclimate[-\s]?related\s+financial\s+disclosures?\b/i,
  'TNFD: Task Force on Nature-related Financial Disclosures': /\bTNFD\b|\bTask\s+Force\s+on\s+Nature\b|\bnature[-\s]?related\s+financial\s+disclosures?\b/i,
  
  // Other Frameworks
  'SASB: Sustainability Accounting Standards Board': /\bSASB\b|\bSustainability\s+Accounting\s+Standards?\b/i,
  'CDP: Carbon Disclosure Project': /\bCDP\b|\bCarbon\s+Disclosure\s+Project\b/i,
  'SBTi: Science Based Targets initiative': /\bSBTi\b|\bScience\s+Based\s+Targets?\b/i,
};

// Section to pillar mapping
const SECTION_TO_PILLAR = {
  'environmental': ['E'],
  'social': ['S'],
  'governance': ['G'],
  'climate-finance': ['E'],
  'biodiversity': ['E'],
  'finance': ['E', 'G'],
  'investment': ['G'],
  'standards': ['E', 'S', 'G'],
  'frameworks': ['E', 'S', 'G'],
  'regulations': ['E', 'S', 'G'],
  'hk-apac': ['E', 'S', 'G'],
  'regional': ['E', 'S', 'G'],
  'emerging-topics': ['E', 'S', 'G'],
  'ratings': ['G'],
  'sdg': ['E', 'S', 'G'],
  'learning': ['E', 'S', 'G'],
  'practice': ['E', 'S', 'G'],
  'fundamentals': ['E', 'S', 'G'],
};

// Detect standards from content
function detectStandards(content, title, description) {
  const textToAnalyze = `${title} ${description || ''} ${content}`.toLowerCase();
  const detected = [];
  
  for (const [standard, pattern] of Object.entries(STANDARDS_PATTERNS)) {
    if (pattern.test(textToAnalyze)) {
      detected.push(standard);
    }
  }
  
  // Remove duplicates and limit
  return [...new Set(detected)].slice(0, 8);
}

// Determine pillar connections
function determinePillarConnections(section, content) {
  const basePillars = SECTION_TO_PILLAR[section] || ['E', 'S', 'G'];
  const connections = [...basePillars];
  
  const contentLower = content.toLowerCase();
  
  // Detect cross-pillar connections from content
  if (contentLower.includes('climate justice') || 
      contentLower.includes('environmental justice') ||
      contentLower.includes('just transition')) {
    if (!connections.includes('S')) connections.push('S');
  }
  
  if (contentLower.includes('climate governance') ||
      contentLower.includes('sustainability governance') ||
      contentLower.includes('esg governance')) {
    if (!connections.includes('G')) connections.push('G');
  }
  
  if (contentLower.includes('human rights governance') ||
      contentLower.includes('social governance')) {
    if (!connections.includes('G')) connections.push('G');
  }
  
  if (contentLower.includes('supply chain') || 
      contentLower.includes('value chain')) {
    // Supply chain often connects all three
    if (!connections.includes('E')) connections.push('E');
    if (!connections.includes('S')) connections.push('S');
    if (!connections.includes('G')) connections.push('G');
  }
  
  return [...new Set(connections)].sort();
}

// Calculate content similarity using simple word overlap
function calculateSimilarity(content1, content2) {
  const words1 = new Set(content1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(content2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

async function generateCrossReferences() {
  console.log("Generating cross-references for ESG Hub pages...\n");
  
  // Get all pages
  const result = await querySurreal('SELECT * FROM page WHERE content IS NOT NULL LIMIT 500');
  const pages = result[0]?.result || [];
  
  console.log(`Found ${pages.length} pages to process\n`);
  
  let processed = 0;
  let updated = 0;
  
  for (const page of pages) {
    try {
      // 1. Detect standards
      const standards = detectStandards(page.content, page.title, page.description);
      
      // 2. Determine pillar connections
      const connectsTo = determinePillarConnections(page.section, page.content);
      
      // 3. Find related pages (calculate similarity with all other pages)
      const similarities = [];
      for (const otherPage of pages) {
        if (otherPage.id !== page.id) {
          const similarity = calculateSimilarity(page.content, otherPage.content);
          if (similarity > 0.05) { // Threshold for relevance
            similarities.push({
              id: otherPage.id,
              similarity
            });
          }
        }
      }
      
      // Sort by similarity and take top 15
      similarities.sort((a, b) => b.similarity - a.similarity);
      const relatedPages = similarities.slice(0, 15).map(s => s.id);
      
      // 4. Update page record
      await querySurreal(`
        UPDATE page SET 
          standards = $standards,
          connects_to = $connectsTo,
          related_pages = $relatedPages
        WHERE id = $pageId
      `, {
        pageId: page.id,
        standards,
        connectsTo,
        relatedPages
      });
      
      updated++;
      
      if (processed % 50 === 0) {
        console.log(`Processed ${processed}/${pages.length} pages...`);
      }
      
    } catch (error) {
      console.error(`Error processing page ${page.id}:`, error.message);
    }
    
    processed++;
  }
  
  // Generate backlinks
  console.log("\nGenerating backlinks...");
  for (const page of pages) {
    try {
      // Find all pages that reference this page
      const backlinkResult = await querySurreal(`
        SELECT id FROM page WHERE $pageId IN related_pages
      `, { pageId: page.id });
      
      const backlinks = backlinkResult[0]?.result?.map(r => r.id) || [];
      
      if (backlinks.length > 0) {
        await querySurreal(`
          UPDATE page SET backlinks = $backlinks WHERE id = $pageId
        `, {
          pageId: page.id,
          backlinks
        });
      }
    } catch (error) {
      console.error(`Error generating backlinks for ${page.id}:`, error.message);
    }
  }
  
  console.log(`\n✅ Cross-reference generation complete!`);
  console.log(`Updated ${updated}/${pages.length} pages`);
  console.log(`\nGenerated fields:`);
  console.log(`  - standards: Applicable GRI/IFRS/TCFD/TNFD/SASB standards`);
  console.log(`  - connects_to: ESG pillar connections (E, S, G)`);
  console.log(`  - related_pages: Top 15 semantically similar pages`);
  console.log(`  - backlinks: Pages referencing this page`);
}

generateCrossReferences().catch(console.error);
