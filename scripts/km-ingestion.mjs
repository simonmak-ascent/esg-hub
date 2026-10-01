#!/usr/bin/env node

/**
 * KM Ingestion Pipeline Driver
 *
 * ACQUIRE → ENQUEUE → FETCH → DEDUP → NORMALIZE → LLM → PRE-VERIFY → VERIFY → EMBED → PROPOSE → REPORT
 *
 * Usage: node scripts/km-ingestion.mjs [--schedule "0 6,18 * * *"] [--pipeline-version "1.0.0"]
 */

import { getDbEnv, querySurrealAll } from "./lib/db-env.mjs";
import { fetchSource, computeChecksum } from "./lib/pipeline-fetcher.mjs";
import { normalizeHTML, normalizeJSON, canonicalizeText } from "./lib/pipeline-normalizer.mjs";
import { extractEntities, verifyExtraction } from "./lib/pipeline-llm.mjs";
import { initEmbedder, embed } from "./lib/pipeline-embedder.mjs";

const env = getDbEnv();

const args = process.argv.slice(2);
const scheduleIdx = args.indexOf("--schedule");
const FETCH_SCHEDULE = scheduleIdx > -1 ? args[scheduleIdx + 1] : null;
const versionIdx = args.indexOf("--pipeline-version");
const PIPELINE_VERSION = versionIdx > -1 ? args[versionIdx + 1] : "1.0.0";
const LEASE_TIMEOUT_MIN = 30;
const GRACEFUL_SHUTDOWN_SEC = 60;
const API_BASE = process.env.ESG_HUB_API_BASE || "https://esg-hub.ascent.partners";

let shuttingDown = false;

process.on("SIGTERM", () => {
  console.warn(`\n[km-ingestion] SIGTERM received, graceful shutdown (${GRACEFUL_SHUTDOWN_SEC}s)...`);
  shuttingDown = true;
  setTimeout(() => {
    console.error("[km-ingestion] Forced exit after grace period");
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_SEC * 1000);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function q(body) {
  const results = await querySurrealAll(body, env);
  return results[0]?.result;
}

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const OWNER = `pid-${process.pid}-${Date.now()}`;

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Lease
// ---------------------------------------------------------------------------

async function acquireLease() {
  // Ensure lease table exists
  await q(`
    DEFINE TABLE IF NOT EXISTS lease;
    DEFINE FIELD IF NOT EXISTS owner ON lease TYPE string;
    DEFINE FIELD IF NOT EXISTS expires_at ON lease TYPE datetime;
    DEFINE FIELD IF NOT EXISTS created_at ON lease TYPE datetime DEFAULT time::now() READONLY;
  `);

  const existing = await q(`SELECT id, owner, expires_at FROM lease:km_ingestion LIMIT 1;`);
  const record = Array.isArray(existing) ? existing[0] : existing;

  if (!record) {
    const expiresAt = new Date(Date.now() + LEASE_TIMEOUT_MIN * 60_000).toISOString();
    await q(`CREATE lease:km_ingestion SET owner = '${esc(OWNER)}', expires_at = '${esc(expiresAt)}';`);
    console.log(`[km-ingestion] Acquired lease (new), expires ${expiresAt}`);
    return true;
  }

  const expiresAt = new Date(record.expires_at).getTime();
  if (Date.now() > expiresAt) {
    console.warn(`[km-ingestion] Lease expired (owner: ${record.owner}), taking over...`);
    const newExpires = new Date(Date.now() + LEASE_TIMEOUT_MIN * 60_000).toISOString();
    await q(`UPDATE lease:km_ingestion SET owner = '${esc(OWNER)}', expires_at = '${esc(newExpires)}';`);
    console.log(`[km-ingestion] Lease taken over, expires ${newExpires}`);
    return true;
  }

  console.error(`[km-ingestion] Lease held by ${record.owner} until ${record.expires_at}. Exiting.`);
  return false;
}

async function releaseLease() {
  try {
    await q(`DELETE lease:km_ingestion WHERE owner = '${esc(OWNER)}';`);
    console.log("[km-ingestion] Lease released.");
  } catch (err) {
    console.error(`[km-ingestion] Failed to release lease: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// ScrapeJob helpers
// ---------------------------------------------------------------------------

async function createScrapeJob(sourceId, sourceUrl, sourceDomain) {
  const result = await q(`
    CREATE scrape_job SET
      source_url = '${esc(sourceUrl)}',
      source_domain = '${esc(sourceDomain)}',
      status = 'in_progress',
      pipeline_version = '${esc(PIPELINE_VERSION)}',
      created_at = time::now()
    RETURN id;
  `);
  if (!result || result.length === 0) {
    throw new Error("Failed to create scrape_job");
  }
  return Array.isArray(result) ? result[0]?.id : result.id;
}

async function updateScrapeJob(jobId, updates) {
  const setClauses = [];
  if (updates.status) setClauses.push(`status = '${esc(updates.status)}'`);
  if (updates.checksum) setClauses.push(`checksum = '${esc(updates.checksum)}'`);
  if (updates.raw_content) setClauses.push(`raw_content = '${esc(updates.raw_content)}'`);
  if (updates.normalized_content) setClauses.push(`normalized_content = '${esc(updates.normalized_content)}'`);
  if (updates.completed_at) setClauses.push(`completed_at = '${esc(updates.completed_at)}'`);
  if (setClauses.length === 0) return;
  await q(`UPDATE ${jobId} SET ${setClauses.join(", ")};`);
}

async function checksumExists(checksum) {
  const result = await q(
    `SELECT id FROM scrape_job WHERE checksum = '${esc(checksum)}' AND status != 'failed' LIMIT 1;`
  );
  return result && result.length > 0;
}

// ---------------------------------------------------------------------------
// Write API helpers
// ---------------------------------------------------------------------------

function writeTokenHeaders() {
  const token = process.env.ESG_HUB_WRITE_TOKEN;
  if (!token) throw new Error("ESG_HUB_WRITE_TOKEN not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function proposeTerm(name, definition, facets, sourceUrls) {
  const res = await fetch(`${API_BASE}/api/v1/terms`, {
    method: "POST",
    headers: writeTokenHeaders(),
    body: JSON.stringify({ name, definition, facets, source_urls: sourceUrls }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`[km-ingestion] Term proposal failed (${res.status}): ${JSON.stringify(body)}`);
    return null;
  }
  return body;
}

async function logContentEnhancement(jobId, targetTable, proposedChanges, sourceUrls, authorityScore) {
  const safeChanges = typeof proposedChanges === "string"
    ? `'${esc(proposedChanges)}'`
    : JSON.stringify(proposedChanges).replace(/'/g, "\\'");
  const safeUrls = sourceUrls ? JSON.stringify(sourceUrls).replace(/'/g, "\\'") : "[]";
  await q(`
    CREATE content_enhancement_log SET
      job_id = ${jobId},
      status = 'pending',
      target_table = '${esc(targetTable)}',
      proposed_changes = ${safeChanges},
      source_urls = ${safeUrls},
      authority_score = ${typeof authorityScore === "number" ? authorityScore : 0.5},
      created_at = time::now()
    RETURN AFTER;
  `);
}

// ---------------------------------------------------------------------------
// Pre-verification: offset match
// ---------------------------------------------------------------------------

function preVerifyOffsets(canonicalText, offsetMap, entities) {
  const failures = [];
  for (const entity of entities || []) {
    for (const claim of entity.claims || []) {
      const span = claim.source_span;
      if (!span || typeof span.start !== "number" || typeof span.end !== "number") continue;
      const sliced = canonicalText.slice(span.start, span.end);
      const expectedText = span.text || sliced;
      if (sliced !== expectedText) {
        failures.push({
          type: "offset_mismatch",
          entity: entity.name,
          claim_start: span.start,
          claim_end: span.end,
          expected: expectedText?.slice(0, 80),
          actual: sliced?.slice(0, 80),
        });
      }
    }
  }
  return { passed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function processSource(source) {
  const sourceUrl = source.api_endpoint || source.base_url;
  console.log(`\n[km-ingestion] Processing source: ${source.name} (${source.domain})`);

  // FETCH
  console.log(`  [FETCH] ${sourceUrl}`);
  let jobId;
  try {
    jobId = await createScrapeJob(source.id, sourceUrl, source.domain);
  } catch (err) {
    console.error(`  [FETCH] Failed to create scrape_job: ${err.message}`);
    return { success: false, error: err.message, stage: "create_job" };
  }

  await updateScrapeJob(jobId, { status: "fetching" });

  const fetchResult = await fetchSource(sourceUrl, {
    timeout: source.fetch_method === "api" ? 15_000 : 30_000,
  });

  if (fetchResult.error || fetchResult.status >= 400) {
    console.error(`  [FETCH] Failed (status ${fetchResult.status}): ${fetchResult.error}`);
    await updateScrapeJob(jobId, { status: "fetch_failed" });
    return { success: false, error: fetchResult.error, stage: "fetch", jobId };
  }

  if (fetchResult.notModified) {
    console.log(`  [FETCH] 304 Not Modified — skipping`);
    await updateScrapeJob(jobId, { status: "unchanged", completed_at: nowIso() });
    await q(`UPDATE source SET last_fetched_at = time::now() WHERE id = ${source.id};`);
    return { success: true, skipped: true, jobId };
  }

  const rawContent = fetchResult.body || "";

  // DEDUP
  const checksum = computeChecksum(rawContent);
  const dup = await checksumExists(checksum);
  if (dup) {
    console.log(`  [DEDUP] Duplicate found (checksum: ${checksum.slice(0, 16)}…) — skipping`);
    await updateScrapeJob(jobId, { status: "duplicate", checksum, completed_at: nowIso() });
    return { success: true, skipped: true, reason: "duplicate", jobId };
  }

  await updateScrapeJob(jobId, { checksum, raw_content: rawContent, status: "deduped" });

  // NORMALIZE
  console.log(`  [NORMALIZE] Content type: ${fetchResult.headers["content-type"] || "unknown"}`);
  const contentType = fetchResult.headers["content-type"] || "";
  let normalized;

  if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
    const htmlResult = normalizeHTML(rawContent, sourceUrl);
    normalized = canonicalizeText(htmlResult.text);
  } else if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(rawContent);
      const jsonResult = normalizeJSON(json);
      normalized = canonicalizeText(jsonResult.text);
    } catch {
      const htmlResult = normalizeHTML(rawContent, sourceUrl);
      normalized = canonicalizeText(htmlResult.text);
    }
  } else {
    normalized = canonicalizeText(rawContent);
  }

  if (!normalized.text || normalized.text.trim().length === 0) {
    console.error(`  [NORMALIZE] Empty normalized text`);
    await updateScrapeJob(jobId, { status: "normalize_empty" });
    return { success: false, error: "Empty normalized text", stage: "normalize", jobId };
  }

  console.log(`  [NORMALIZE] ${normalized.text.length} chars canonical`);

  const normalizedContent = normalized.text;
  await updateScrapeJob(jobId, {
    normalized_content: normalizedContent.slice(0, 100_000),
    status: "normalized",
  });

  // LLM EXTRACT
  console.log(`  [LLM] Extracting entities...`);
  await updateScrapeJob(jobId, { status: "llm_extracting" });

  let extraction;
  try {
    extraction = await extractEntities(normalizedContent, { sourceUrl });
  } catch (err) {
    console.error(`  [LLM] Extraction failed: ${err.message}`);
    extraction = { error: err.message };
  }

  if (extraction.error) {
    console.error(`  [LLM] Extraction error: ${extraction.error}`);
    await updateScrapeJob(jobId, { status: "llm_failed" });
    return { success: false, error: extraction.error, stage: "llm_extract", jobId };
  }

  console.log(`  [LLM] Extracted ${extraction.entities?.length || 0} entities, ${extraction.claims?.length || 0} claims`);
  await updateScrapeJob(jobId, { status: "llm_extracted" });

  // PRE-VERIFY offset match
  console.log(`  [PRE-VERIFY] Checking source_span offsets...`);
  const preVerify = preVerifyOffsets(normalizedContent, normalized.offsetMap, extraction);
  if (!preVerify.passed) {
    console.error(`  [PRE-VERIFY] FAILED — ${preVerify.failures.length} mismatches:`);
    for (const f of preVerify.failures.slice(0, 5)) {
      console.error(`    ${f.type}: expected "${f.expected}" got "${f.actual}"`);
    }
    await updateScrapeJob(jobId, { status: "pre_verify_failed" });

    // Log for human review
    await logContentEnhancement(
      jobId,
      "scrape_job",
      { pre_verification: "failed", failures: preVerify.failures, extraction },
      [sourceUrl],
      source.authority_score
    );
    return { success: false, error: "Pre-verification failed", stage: "pre_verify", jobId };
  }
  console.log(`  [PRE-VERIFY] PASSED`);

  // VERIFY (if low confidence or novel)
  let verification = null;
  const lowConfidence = (extraction.entities || []).some(
    (e) => (e.confidence ?? 1) < 0.8
  );
  const novelEntity = (extraction.entities || []).some(
    (e) => (e.taxonomyTags || e.facets || {}).novelty === true
  );

  if (lowConfidence || novelEntity) {
    console.log(`  [VERIFY] Low confidence or novel entity — verifying via reasoner...`);
    try {
      verification = await verifyExtraction(extraction, normalizedContent, { sourceUrl });
      console.log(`  [VERIFY] Confidence: ${verification.confidence}, Issues: ${verification.issues?.length || 0}`);
    } catch (err) {
      console.error(`  [VERIFY] Verification error: ${err.message}`);
    }
  }

  // EMBED
  console.log(`  [EMBED] Embedding new terms/frameworks...`);
  try {
    await initEmbedder();
  } catch (err) {
    console.error(`  [EMBED] Embedder init failed: ${err.message}`);
    // Continue without embeddings — non-fatal
  }

  const embeddings = {};
  for (const entity of extraction.entities || []) {
    if (entity.name && entity.entity_type === "term") {
      try {
        const vec = await embed(entity.definition || entity.name);
        embeddings[entity.name] = vec;
      } catch (err) {
        console.warn(`  [EMBED] Failed for "${entity.name}": ${err.message}`);
      }
    }
  }

  // PROPOSE
  console.log(`  [PROPOSE] Proposing terms and logging...`);
  const proposals = [];
  const sourceUrls = [sourceUrl];
  const authorityScore = source.authority_score ?? 0.5;

  for (const entity of extraction.entities || []) {
    if (!entity.name || !entity.definition) continue;

    if (entity.entity_type === "term" || entity.entity_type === "glossary_term") {
      const facets = {
        ...(entity.facets || {}),
        ...(entity.taxonomyTags || {}),
        source: source.domain,
      };

      const proposal = await proposeTerm(entity.name, entity.definition, facets, sourceUrls);
      if (proposal) {
        proposals.push(proposal);
        console.log(`    Term proposal: "${entity.name}" → ${proposal.proposal_id || proposal.id}`);
      }
    }

    // Also log to content_enhancement_log for any entity
    await logContentEnhancement(
      jobId,
      entity.entity_type === "framework" ? "framework" : "term",
      {
        name: entity.name,
        definition: entity.definition,
        entity_type: entity.entity_type,
        confidence: entity.confidence,
        facets: entity.facets,
        taxonomyTags: entity.taxonomyTags,
        verification,
      },
      sourceUrls,
      authorityScore
    );
  }

  // Log claims to content_enhancement_log
  for (const claim of extraction.claims || []) {
    await logContentEnhancement(
      jobId,
      "claim",
      {
        claim_text: claim.text || claim.claim,
        source_span: claim.source_span,
        confidence: claim.confidence,
        evidence: claim.evidence,
        verdict: verification ? "verified" : "unverified",
        verification_confidence: verification?.confidence,
      },
      sourceUrls,
      authorityScore
    );
  }

  // REPORT
  await q(`UPDATE source SET last_fetched_at = time::now() WHERE id = ${source.id};`);
  await updateScrapeJob(jobId, {
    status: "completed",
    completed_at: nowIso(),
  });

  console.log(`  [REPORT] Done: ${proposals.length} term proposals submitted for ${source.domain}`);
  return {
    success: true,
    jobId,
    sourceName: source.name,
    proposals: proposals.length,
    entities: extraction.entities?.length || 0,
    claims: extraction.claims?.length || 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[km-ingestion] Starting (version: ${PIPELINE_VERSION}, owner: ${OWNER})`);
  console.log(`[km-ingestion] Schedule filter: ${FETCH_SCHEDULE || "(all)"}`);

  // ACQUIRE
  const locked = await acquireLease();
  if (!locked) process.exit(1);

  const exitHandler = async () => {
    await releaseLease();
  };
  process.on("exit", exitHandler);
  process.on("SIGINT", async () => {
    await releaseLease();
    process.exit(0);
  });

  try {
    // ENQUEUE
    let sources;
    if (FETCH_SCHEDULE) {
      sources = await q(
        `SELECT * FROM source WHERE is_active = true AND fetch_schedule = '${esc(FETCH_SCHEDULE)}' ORDER BY authority_score DESC;`
      );
    } else {
      sources = await q(
        `SELECT * FROM source WHERE is_active = true ORDER BY authority_score DESC;`
      );
    }
    console.log(`[km-ingestion] ENQUEUE: ${sources.length} active sources`);

    if (sources.length === 0) {
      console.log("[km-ingestion] Nothing to process.");
    }

    const results = [];
    for (const source of sources) {
      if (shuttingDown) {
        console.warn("[km-ingestion] Shutting down — saving checkpoint and exiting.");
        break;
      }
      const result = await processSource(source);
      results.push(result);
    }

    // Summary
    const succeeded = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    const totalProposals = results.reduce((sum, r) => sum + (r.proposals || 0), 0);

    console.log(`\n[km-ingestion] SUMMARY`);
    console.log(`  Sources processed: ${results.length}`);
    console.log(`  Succeeded (new):   ${succeeded}`);
    console.log(`  Skipped:           ${skipped}`);
    console.log(`  Failed:            ${failed}`);
    console.log(`  Term proposals:    ${totalProposals}`);
  } finally {
    await releaseLease();
  }
}

main().catch((err) => {
  console.error(`[km-ingestion] Fatal: ${err.message}`);
  releaseLease().finally(() => process.exit(1));
});
