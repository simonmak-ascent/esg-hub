#!/usr/bin/env node

/**
 * KM R&D Verification Loop — daily link freshness, claim re-check, cross-ref, claim tracking.
 *
 * Usage: node scripts/km-rd-loop.mjs [--target-days 30] [--dry-run]
 *
 * Requires: PERPLEXITY_API_KEY, ESG_HUB_WRITE_TOKEN (optional, for PATCH proposals).
 */

import { getDbEnv, querySurrealAll } from "./lib/db-env.mjs";

const env = getDbEnv();

const args = process.argv.slice(2);
const daysIdx = args.indexOf("--target-days");
const TARGET_DAYS = daysIdx > -1 ? parseInt(args[daysIdx + 1], 10) || 30 : 30;
const DRY_RUN = args.includes("--dry-run");
const LEASE_TIMEOUT_H = 2;
const PERPLEXITY_API = "https://api.perplexity.ai/v1/agent";
const STANDARDS_INTERVAL_DAYS = 30;
const OTHER_INTERVAL_DAYS = 60;

const OWNER = `rd-loop-${process.pid}-${Date.now()}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function q(body) {
  const results = await querySurrealAll(body, env);
  return results[0]?.result;
}

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// ---------------------------------------------------------------------------
// Lease
// ---------------------------------------------------------------------------

async function acquireLease() {
  await q(`
    DEFINE TABLE IF NOT EXISTS lease;
    DEFINE FIELD IF NOT EXISTS owner ON lease TYPE string;
    DEFINE FIELD IF NOT EXISTS expires_at ON lease TYPE datetime;
    DEFINE FIELD IF NOT EXISTS created_at ON lease TYPE datetime DEFAULT time::now() READONLY;
  `);

  const existing = await q(`SELECT id, owner, expires_at FROM lease:km_rd_loop LIMIT 1;`);
  const record = Array.isArray(existing) ? existing[0] : existing;

  if (!record) {
    const expiresAt = new Date(Date.now() + LEASE_TIMEOUT_H * 3_600_000).toISOString();
    await q(`CREATE lease:km_rd_loop SET owner = '${esc(OWNER)}', expires_at = '${esc(expiresAt)}';`);
    console.log(`[km-rd-loop] Acquired lease, expires ${expiresAt}`);
    return true;
  }

  const expiresAt = new Date(record.expires_at).getTime();
  if (Date.now() > expiresAt) {
    console.warn(`[km-rd-loop] Lease expired (owner: ${record.owner}), taking over...`);
    const newExpires = new Date(Date.now() + LEASE_TIMEOUT_H * 3_600_000).toISOString();
    await q(`UPDATE lease:km_rd_loop SET owner = '${esc(OWNER)}', expires_at = '${esc(newExpires)}';`);
    return true;
  }

  console.error(`[km-rd-loop] Lease held by ${record.owner} until ${record.expires_at}`);
  return false;
}

async function releaseLease() {
  try {
    await q(`DELETE lease:km_rd_loop WHERE owner = '${esc(OWNER)}';`);
    console.log("[km-rd-loop] Lease released.");
  } catch (_err) {
    console.error(`[km-rd-loop] Failed to release lease: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Page selection (stratified)
// ---------------------------------------------------------------------------

async function selectPages() {
  const countResult = await q(`
    SELECT count()
    FROM page
    WHERE type != "external_resource"
      AND (last_verified IS NONE
           OR (section = 'standards' AND last_verified < time::now() - ${STANDARDS_INTERVAL_DAYS}d)
           OR (section != 'standards' AND last_verified < time::now() - ${OTHER_INTERVAL_DAYS}d))
    GROUP ALL;
  `);
  const totalDue = countResult?.[0]?.count || 0;
  const N = Math.ceil(totalDue / TARGET_DAYS);
  console.log(`[km-rd-loop] ${totalDue} pages due, selecting N=${N} for today`);

  if (N === 0) return [];

  const standards = await q(`
    SELECT *
    FROM page
    WHERE type != "external_resource"
      AND section = 'standards'
      AND (last_verified IS NONE OR last_verified < time::now() - ${STANDARDS_INTERVAL_DAYS}d)
    ORDER BY last_verified ASC
    LIMIT ${N};
  `);

  const others = await q(`
    SELECT *
    FROM page
    WHERE type != "external_resource"
      AND section != 'standards'
      AND (last_verified IS NONE OR last_verified < time::now() - ${OTHER_INTERVAL_DAYS}d)
    ORDER BY last_verified ASC
    LIMIT ${Math.max(0, N - (standards?.length || 0))};
  `);

  return [...(Array.isArray(standards) ? standards : []), ...(Array.isArray(others) ? others : [])];
}

// ---------------------------------------------------------------------------
// a. Link freshness
// ---------------------------------------------------------------------------

async function _checkLink(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return { url, status: res.status, ok: res.ok };
  } catch (_err) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      return { url, status: res.status, ok: res.ok, fallback: "GET-range" };
    } catch (err2) {
      return { url, status: 0, ok: false, error: err2.message };
    }
  }
}

function _isDeadLink(result) {
  if (result.status === 0) return true;
  if (result.status === 404 || result.status === 410) return true;
  if (result.status === 401 || result.status === 403 || result.status === 429) return false;
  return result.status >= 400 && result.status < 600;
}

async function _checkSoft404(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { soft404: false, status: res.status };
    const text = (await res.text().catch(() => "")).slice(0, 4000).toLowerCase();
    const soft404Signals = [
      "page not found",
      "404",
      "not found",
      "this page does not exist",
      "no longer available",
    ];
    const hits = soft404Signals.filter((s) => text.includes(s));
    return { soft404: hits.length > 0, status: res.status, signals: hits, textSample: text.slice(0, 200) };
  } catch {
    return { soft404: false, status: 0, error: "fetch_failed" };
  }
}

// ---------------------------------------------------------------------------
// b. Claim re-check via Perplexity
// ---------------------------------------------------------------------------

async function _verifyClaimViaPerplexity(claimText, pageTitle) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn(`[km-rd-loop] PERPLEXITY_API_KEY not set — skipping claim re-check`);
    return null;
  }

  const prompt = `Verify this claim from the ESG page "${pageTitle}": "${claimText}". Return JSON: {"verdict":"supported|refuted|conflicting|insufficient_evidence","citations":["url1","url2"],"confidence":0.0-1.0}`;

  try {
    const res = await fetch(PERPLEXITY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: { preset: "medium" },
        messages: [
          { role: "system", content: "You verify factual claims in ESG knowledge. Be precise and cite sources." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      console.error(`[km-rd-loop] Perplexity API error ${res.status}`);
      return null;
    }

    const text = await res.text();
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return { raw: text.slice(0, 500) };
  } catch (_err) {
    console.error(`[km-rd-loop] Perplexity call failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// c. Cross-reference checks
// ---------------------------------------------------------------------------

async function _checkCrossRefs(pageId, _permalink) {
  const issues = [];

  // Check related_to bidirectionality
  const outbound = await q(`
    SELECT out, relationship_type, score
    FROM related_to
    WHERE in = ${pageId};
  `);
  const inbound = await q(`
    SELECT in AS source, relationship_type, score
    FROM related_to
    WHERE out = ${pageId};
  `);

  const _outboundIds = new Set(outbound.map((r) => r.out));
  const inboundIds = new Set(inbound.map((r) => r.source));

  for (const rel of outbound) {
    if (!inboundIds.has(rel.out)) {
      issues.push({ type: "unidirectional_related_to", from: pageId, to: rel.out, direction: "outbound" });
    }
  }

  // Check defines edges (framework→term) for orphan targets
  const definesIn = await q(`
    SELECT out FROM defines WHERE in = ${pageId};
  `);
  const _definesOut = await q(`
    SELECT in FROM defines WHERE out = ${pageId};
  `);

  // For pages used in denies/similar edges: verify target exists
  for (const def of definesIn) {
    const target = await q(`SELECT id FROM ${def.out} LIMIT 1;`);
    if (!target || target.length === 0) {
      issues.push({ type: "orphan_defines_target", source: pageId, target: def.out });
    }
  }

  // Check cites edges for orphan targets
  const citesOutbound = await q(`
    SELECT out, context FROM cites WHERE in = ${pageId};
  `);
  for (const cite of citesOutbound) {
    const target = await q(`SELECT id FROM ${cite.out} LIMIT 1;`);
    if (!target || target.length === 0) {
      issues.push({ type: "orphan_cites_target", source: pageId, target: cite.out, context: cite.context });
    }
  }

  return { issues, outboundCount: outbound.length, inboundCount: inbound.length };
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

function writeTokenHeaders() {
  const token = process.env.ESG_HUB_WRITE_TOKEN;
  return token ? {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  } : null;
}

async function _proposeLinkFix(pageId, deadLinks) {
  const headers = writeTokenHeaders();
  if (!headers || DRY_RUN) {
    console.log(`  [PROPOSE] Would fix ${deadLinks.length} dead links on ${pageId}`);
    return;
  }

  await q(`
    CREATE content_enhancement_log SET
      target_table = 'page',
      target_id = ${pageId},
      status = 'pending',
      proposed_changes = { dead_links: ${JSON.stringify(deadLinks).replace(/'/g, "\\'")} },
      created_at = time::now()
    RETURN AFTER;
  `);
  console.log(`  [PROPOSE] Link fix logged for ${pageId}`);
}

// async function _proposeFacetFix(recordId, field, oldValue, newValue, fixType) {
//   if (DRY_RUN) {
// //     console.log(`  [PATCH] Would fix ${field} on ${recordId}: "${oldValue}" → "${newValue}" (${fixType})`);
// //     return;
// //   }
// //   await q(`
// //     CREATE content_enhancement_log SET
// //       target_table = '${esc(fixType)}',
// //       target_id = ${recordId},
// //       status = 'pending',
// //       proposed_changes = {
// //         field: '${esc(field)}',
// //         old: '${esc(String(oldValue))}',
// //         new: '${esc(String(newValue))}'
// //       },
// //       created_at = time::now()
// //     RETURN AFTER;
// //   `);
// // }
// // 
// // // ---------------------------------------------------------------------------
// // // Per-page verification
// // // ---------------------------------------------------------------------------
// // 
// // async function verifyPage(page) {
// //   const pageId = page.id;
// //   const permalink = page.permalink || "unknown";
// //   console.log(`\n── ${"─".repeat(50)}`);
// //   console.log(`[km-rd-loop] Verifying: ${page.title} (${permalink})`);
// 
//   const findings = { deadLinks: [], claimResults: [], crossRefIssues: [], facetIssues: [] };
// 
//   // a. Link freshness
//   console.log(`  [a] Link freshness check...`);
//   const externalLinks = page.external_links || page.links || [];
//   if (externalLinks.length > 0) {
//     const linkResults = [];
//     for (let i = 0; i < externalLinks.length; i += CONCURRENT_FETCHES) {
//       const batch = externalLinks.slice(i, i + CONCURRENT_FETCHES).map((l) => {
//         const url = typeof l === "string" ? l : l.url || l.href;
//         return url ? checkLink(url) : Promise.resolve(null);
//       });
//       const batchResults = await Promise.all(batch);
//       for (const r of batchResults) {
//         if (r && isDeadLink(r)) {
//           const softCheck = await checkSoft404(r.url);
//           if (softCheck.soft404) {
//             linkResults.push({ ...r, soft404: true, signals: softCheck.signals });
//           } else {
//             linkResults.push(r);
//           }
//         }
//       }
//     }
//     findings.deadLinks = linkResults;
//     if (linkResults.length > 0) {
//       console.warn(`  [a] ${linkResults.length} dead/soft-404 links found`);
//       for (const dl of linkResults.slice(0, 5)) {
//         console.warn(`    ${dl.status} ${dl.url}${dl.soft404 ? " (soft-404)" : ""}`);
//       }
//       if (linkResults.length > 5) console.warn(`    ... and ${linkResults.length - 5} more`);
//     } else {
//       console.log(`  [a] All ${externalLinks.length} links OK`);
//     }
//   } else {
//     console.log(`  [a] No external links to check`);
//   }
// 
//   // b. Claim re-check (for pages with high authority_score sources)
//   const hasHighAuthority = page.authority_score && page.authority_score >= 0.7;
//   if (hasHighAuthority && page.claims && page.claims.length > 0) {
//     console.log(`  [b] Claim re-check (${page.claims.length} claims)...`);
//     // Pick 2-3 key claims (longest text = most substantive)
//     const topClaims = [...page.claims]
//       .sort((a, b) => (b.text || b.claim || "").length - (a.text || a.claim || "").length)
//       .slice(0, 3);
// 
//     for (const claim of topClaims) {
//       const claimText = claim.text || claim.claim || "";
//       if (!claimText) continue;
//       console.log(`    Verifying claim: "${claimText.slice(0, 100)}..."`);
//       const result = await verifyClaimViaPerplexity(claimText, page.title || permalink);
//       if (result) {
//         findings.claimResults.push({ claim: claimText.slice(0, 500), verdict: result.verdict, citations: result.citations, confidence: result.confidence });
// 
//         // d. Claim tracking via content_enhancement_log
//         await q(`
//           CREATE content_enhancement_log SET
//             target_table = 'claim',
//             target_id = ${pageId},
//             status = 'pending',
//             proposed_changes = {
//               claim_text: '${esc(claimText.slice(0, 500))}',
//               source_span: ${JSON.stringify(claim.source_span || {}).replace(/'/g, "\\'")},
//               verdict: '${esc(result.verdict || "unknown")}',
//               evidence_snapshot: ${JSON.stringify(result).replace(/'/g, "\\'")},
//               confidence: ${result.confidence ?? 0}
//             },
//             source_urls = ${JSON.stringify(result.citations || []).replace(/'/g, "\\'")},
//             created_at = time::now()
//           RETURN AFTER;
//         `);
// 
//         if (result.verdict === "refuted" || result.verdict === "conflicting") {
//           console.warn(`    ⚠ ${result.verdict}: "${claimText.slice(0, 80)}..."`);
//         } else {
//           console.log(`    ✓ ${result.verdict || "unknown"}`);
//         }
//       }
//     }
//   } else {
//     console.log(`  [b] Claim re-check skipped (authority_score: ${page.authority_score}, claims: ${page.claims?.length || 0})`);
//   }
// 
//   // c. Cross-reference check
//   console.log(`  [c] Cross-reference check...`);
//   const crossRef = await checkCrossRefs(pageId, permalink);
//   findings.crossRefIssues = crossRef.issues;
//   if (crossRef.issues.length > 0) {
//     console.warn(`  [c] ${crossRef.issues.length} cross-ref issues:`);
//     for (const issue of crossRef.issues.slice(0, 5)) {
//       console.warn(`    ${issue.type}: ${issue.from || "?"} → ${issue.to || "?"}`);
//     }
//   }
//   console.log(`  [c] Outbound: ${crossRef.outboundCount}, Inbound: ${crossRef.inboundCount}`);
// 
//   // PROPOSE fixes
//   if (findings.deadLinks.length > 0) {
//     await proposeLinkFix(pageId, findings.deadLinks);
//   }
//   if (findings.crossRefIssues.length > 0) {
//     console.log(`  [PATCH] ${findings.crossRefIssues.length} cross-ref issues need attention`);
//   }
// 
//   // Mark as verified
//   if (!DRY_RUN) {
//     await q(`UPDATE ${pageId} SET last_verified = time::now();`);
//     console.log(`  [✓] last_verified updated`);
//   } else {
//     console.log(`  [dry-run] Would update last_verified`);
//   }
// 
//   return findings;
// }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[km-rd-loop] Daily R&D verification (target=${TARGET_DAYS}d, dry-run=${DRY_RUN})`);
  console.log(`[km-rd-loop] Owner: ${OWNER}`);

  const locked = await acquireLease();
  if (!locked) process.exit(1);

  process.on("exit", () => releaseLease());
  process.on("SIGINT", async () => {
    await releaseLease();
    process.exit(0);
  });

  try {
    const pages = await selectPages();
    console.log(`[km-rd-loop] Selected ${pages.length} pages for verification today\n`);

    if (pages.length === 0) {
      console.log("[km-rd-loop] No pages due. Exiting.");
      return;
    }

    let totalDeadLinks = 0;
    let totalClaimChecks = 0;
    let totalCrossrefIssues = 0;
    let totalClaimsRefuted = 0;

    for (const page of pages) {
      const findings = await verifyPage(page);
      totalDeadLinks += findings.deadLinks.length;
      totalClaimChecks += findings.claimResults.length;
      totalCrossrefIssues += findings.crossRefIssues.length;
      totalClaimsRefuted += findings.claimResults.filter((c) => c.verdict === "refuted").length;
    }

    console.log(`\n[km-rd-loop] SUMMARY`);
    console.log(`  Pages verified:     ${pages.length}`);
    console.log(`  Dead links found:   ${totalDeadLinks}`);
    console.log(`  Claims re-checked:  ${totalClaimChecks}`);
    console.log(`  Claims refuted:     ${totalClaimsRefuted}`);
    console.log(`  Cross-ref issues:   ${totalCrossrefIssues}`);
    console.log(`  Dry-run:            ${DRY_RUN}`);
  } finally {
    await releaseLease();
  }
}

main().catch((err) => {
  console.error(`[km-rd-loop] Fatal: ${err.message}`);
  releaseLease().finally(() => process.exit(1));
});
