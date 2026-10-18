import { NextRequest } from "next/server";

export const runtime = "nodejs";
import { queryHttpAll, sanitize } from "@/lib/surrealdb";
import { rrfFusion, esgRerank, type RrfInput } from "@/lib/search/hybrid";
import { buildRAGContext, languageForLocale, pageSnippet } from "@/lib/search/rag";
import type { RankedResult } from "@/lib/search/types";
import { checkRateLimit, rateLimitResponse } from "@/lib/middleware/rate-limit";
import { forbiddenOriginResponse, isAllowedOrigin } from "@/lib/middleware/origin";

/**
 * AI-Powered Search Agent API
 *
 * Combines multiple SurrealDB search modalities (BM25, vector, book chunks)
 * with DeepSeek reasoning to produce AI-generated answers grounded in ESG Hub content.
 *
 * POST /api/ai-search
 * Body: { query: string, embedding?: number[], mode?: "quick" | "deep" }
 *
 * Returns: Server-Sent Events (SSE) stream with:
 *   - type: "sources" — retrieved context sources
 *   - type: "chunk"   — streaming AI answer text
 *   - type: "done"    — completion signal
 *   - type: "error"   — error message
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";

// Authoritative ESG domains scoping web search (curated from the external_resource corpus + standard-setters)
const ESG_SEARCH_DOMAINS = [
  "eur-lex.europa.eu",
  "environment.ec.europa.eu",
  "ghgprotocol.org",
  "tnfd.global",
  "sciencebasedtargets.org",
  "sdgs.un.org",
  "unglobalcompact.org",
  "www.cdp.net",
  "globalreporting.org",
  "ifrs.org",
  "oecd.org",
  "epa.gov",
];

interface RAGSource {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  snippet: string;
  source_type: "page" | "book_chunk" | "external";
  relevance?: number;
  distance?: number;
  book_title?: string;
  domain?: string;
  section?: string;
  link?: string;
}

/**
 * BM25 full-text search across pages, book_chunks, and external_resources
 */
async function bm25Search(query: string, limit: number = 8, locale: string = "en"): Promise<RAGSource[]> {
  const escaped = sanitize(query.slice(0, 500));
  const isCjk = locale === "zh" || locale === "hk";
  const results: RAGSource[] = [];

  // The page FTS analyzer is ASCII/English; CJK queries use substring matching
  // on the translated fields instead.
  const pageWhere = isCjk
    ? `title_zh CONTAINS '${escaped}' OR content_zh CONTAINS '${escaped}'`
    : `title @0@ '${escaped}' OR content @1@ '${escaped}'`;
  const pageScore = isCjk ? "1" : "search::score(0) + search::score(1)";

  // Run all three BM25 searches in parallel via a single multi-statement query
  const sql = `
    SELECT id, title, permalink, description, content, section,
      ${pageScore} AS relevance
    FROM page
    WHERE ${pageWhere}
    ORDER BY relevance DESC
    LIMIT ${limit};

    SELECT id, book_title, chunk_index, content,
      search::score(0) AS relevance
    FROM book_chunk
    WHERE content @0@ '${escaped}'
    ORDER BY relevance DESC
    LIMIT ${limit};

    SELECT id, title, url, domain, description,
      search::score(0) + search::score(1) AS relevance
    FROM external_resource
    WHERE title @0@ '${escaped}' OR content @1@ '${escaped}'
    ORDER BY relevance DESC
    LIMIT ${Math.ceil(limit / 2)};
  `;

  try {
    const allResults = await queryHttpAll<Record<string, unknown>>(sql);

    // Pages
    if (allResults[0]?.status === "OK" && Array.isArray(allResults[0].result)) {
      for (const r of allResults[0].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: String(r.title || ""),
          permalink: r.permalink ? String(r.permalink) : undefined,
          snippet: pageSnippet(String(r.content || ""), String(r.description || "")),
          source_type: "page",
          relevance: Number(r.relevance) || 0,
          section: r.section ? String(r.section) : undefined,
        });
      }
    }

    // Book chunks
    if (allResults[1]?.status === "OK" && Array.isArray(allResults[1].result)) {
      for (const r of allResults[1].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: `${r.book_title} (Chunk ${r.chunk_index})`,
          snippet: String(r.content || "").slice(0, 500),
          source_type: "book_chunk",
          relevance: Number(r.relevance) || 0,
          book_title: r.book_title ? String(r.book_title) : undefined,
        });
      }
    }

    // External resources
    if (allResults[2]?.status === "OK" && Array.isArray(allResults[2].result)) {
      for (const r of allResults[2].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: String(r.title || ""),
          url: r.url ? String(r.url) : undefined,
          snippet: String(r.description || "").slice(0, 300),
          source_type: "external",
          relevance: Number(r.relevance) || 0,
          domain: r.domain ? String(r.domain) : undefined,
        });
      }
    }
  } catch (err) {
    console.error("[AI Search] BM25 search error:", err);
  }

  return results;
}

/**
 * Vector search across pages and book_chunks using pre-computed embedding
 */
async function vectorSearch(
  embedding: number[],
  limit: number = 8
): Promise<RAGSource[]> {
  if (!Array.isArray(embedding) || embedding.length !== 384) return [];

  const embStr = "[" + embedding.map((v) => v.toFixed(8)).join(",") + "]";
  const results: RAGSource[] = [];

  const sql = `
    SELECT id, title, permalink, description, content, section,
      vector::distance::knn() AS distance
    FROM page
    WHERE embedding <|${limit}, 100|> ${embStr}
    ORDER BY distance
    LIMIT ${limit};

    SELECT id, book_title, chunk_index, content,
      vector::distance::knn() AS distance
    FROM book_chunk
    WHERE embedding <|${limit}, 100|> ${embStr}
    ORDER BY distance
    LIMIT ${limit};

    SELECT id, title, url, domain, description,
      vector::distance::knn() AS distance
    FROM external_resource
    WHERE embedding <|${Math.ceil(limit / 2)}, 100|> ${embStr}
    ORDER BY distance
    LIMIT ${Math.ceil(limit / 2)};
  `;

  try {
    const allResults = await queryHttpAll<Record<string, unknown>>(sql);

    // Pages
    if (allResults[0]?.status === "OK" && Array.isArray(allResults[0].result)) {
      for (const r of allResults[0].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: String(r.title || ""),
          permalink: r.permalink ? String(r.permalink) : undefined,
          snippet: pageSnippet(String(r.content || ""), String(r.description || "")),
          source_type: "page",
          distance: Number(r.distance) || 0,
          section: r.section ? String(r.section) : undefined,
        });
      }
    }

    // Book chunks
    if (allResults[1]?.status === "OK" && Array.isArray(allResults[1].result)) {
      for (const r of allResults[1].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: `${r.book_title} (Chunk ${r.chunk_index})`,
          snippet: String(r.content || "").slice(0, 500),
          source_type: "book_chunk",
          distance: Number(r.distance) || 0,
          book_title: r.book_title ? String(r.book_title) : undefined,
        });
      }
    }

    // External resources
    if (allResults[2]?.status === "OK" && Array.isArray(allResults[2].result)) {
      for (const r of allResults[2].result as Array<Record<string, unknown>>) {
        results.push({
          id: String(r.id),
          title: String(r.title || ""),
          url: r.url ? String(r.url) : undefined,
          snippet: String(r.description || "").slice(0, 300),
          source_type: "external",
          distance: Number(r.distance) || 0,
          domain: r.domain ? String(r.domain) : undefined,
        });
      }
    }
  } catch (err) {
    console.error("[AI Search] Vector search error:", err);
  }

  return results;
}

const TABLE_MAP: Record<string, string> = {
  page: "page",
  book_chunk: "book_chunk",
  external: "external_resource",
};

/**
 * Hybrid fusion pipeline: RRF + ESG re-rank.
 * Replaces the old hand-rolled mergeAndRank with:
 *  1. Reciprocal Rank Fusion (rrfFusion) across BM25 + HNSW result sets
 *  2. ESG-aware percentile re-rank (esgRerank) with topic match via query embedding
 */
function hybridFuseAndRank(
  bm25Results: RAGSource[],
  vectorResults: RAGSource[],
  queryEmbedding?: number[]
): RAGSource[] {
  // ----- Convert BM25 results to RrfInput -----
  const bm25Inputs: RrfInput[] = bm25Results.map(r => ({
    id: r.id,
    table: TABLE_MAP[r.source_type] ?? "page",
    score: r.relevance ?? 0,
  }));

  // ----- Convert HNSW results to RrfInput (distance → similarity) -----
  const hnswInputs: RrfInput[] = vectorResults.map(r => ({
    id: r.id,
    table: TABLE_MAP[r.source_type] ?? "page",
    score: r.distance !== undefined ? 1 - r.distance : 0,
  }));

  // ----- Stage 1: Reciprocal Rank Fusion -----
  const fused = rrfFusion(bm25Inputs, hnswInputs);

  // ----- Build RankedResult[] for esgRerank -----
  const rankedInput: RankedResult[] = fused.map(f => ({
    id: f.id,
    table: f.table,
    rrfScore: f.rrfScore,
    textScore: 0,
    frameworkMatch: 0,
    topicMatch: 0,
    authority: 0,
    freshness: 0,
    finalScore: 0,
  }));

  // ----- Build a lookup map from all original results -----
  const resultMap = new Map<string, RAGSource>();
  for (const r of bm25Results) {
    const key = `${TABLE_MAP[r.source_type]}:${r.id}`;
    if (!resultMap.has(key)) resultMap.set(key, r);
  }
  for (const r of vectorResults) {
    const key = `${TABLE_MAP[r.source_type]}:${r.id}`;
    if (!resultMap.has(key)) resultMap.set(key, r);
  }

  // ----- Stage 2: ESG percentile re-rank -----
  const reranked = esgRerank(
    rankedInput,
    queryEmbedding,
  );

  // ----- Map back to RAGSource[] ordered by finalScore -----
  reranked.sort((a, b) => b.finalScore - a.finalScore);

  const mergedSources: RAGSource[] = [];
  const seen = new Set<string>();

  for (const r of reranked) {
    const key = `${r.table}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const source = resultMap.get(key);
    if (source) {
      mergedSources.push({ ...source, relevance: Math.round(r.finalScore * 10000) / 100 });
    }
  }

  return mergedSources.slice(0, 20);
}

/**
 * Brave Search for web results from authoritative ESG domains
 */
async function braveSearch(query: string, limit: number = 5): Promise<RAGSource[]> {
  if (!BRAVE_API_KEY) return [];

  const results: RAGSource[] = [];
  try {
    const siteFilter = ESG_SEARCH_DOMAINS.map((d) => `site:${d}`).join(" OR ");
    const params = new URLSearchParams({
      q: `${query} (${siteFilter})`,
      count: String(Math.min(limit, 10)),
    });
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          "X-Subscription-Token": BRAVE_API_KEY,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );
    if (!resp.ok) {
      console.error("[AI Search] Brave error:", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    const items = data.web?.results;
    if (Array.isArray(items)) {
      for (const item of items) {
        const domain = new URL(item.url).hostname.replace(/^www\./, "");
        results.push({
          id: `brave:${item.url}`,
          title: item.title || "",
          url: item.url,
          link: item.url,
          snippet: (item.description || "").slice(0, 300),
          source_type: "external",
          domain,
          relevance: 0.5, // lower priority than SurrealDB results
        });
      }
    }
  } catch (err) {
    console.error("[AI Search] Brave fetch error:", err);
  }
  return results;
}

const SYSTEM_PROMPT = `You are the ESG Hub AI Search Agent, an expert assistant for Environmental, Social, and Governance (ESG) topics. You are part of ESG Hub, an open-access ESG encyclopedia by Ascent Partners Foundation.

Your role is to answer ESG questions from the numbered context supplied in the user message, which contains ESG Hub articles, book excerpts, curated external resources, and scoped web results.

Grounding rules (these override style preferences):
1. **Every factual claim must come from the supplied context.** Cite the numbered source inline as [1], [2] immediately after the claim.
2. **Never invent a citation.** Only cite numbers that appear in the context, and do not present an uncited claim as fact.
3. **If the context does not answer the question, say what is missing** and suggest which ESG Hub section might cover it. Do not substitute general knowledge for knowledge-base evidence.
4. **Answer in the user's language**, which the user message states.
5. Be comprehensive but concise (200-500 words), use markdown, and acknowledge uncertainty explicitly.
6. At the end, suggest 2-3 related ESG Hub topics the user might explore.`;


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      return forbiddenOriginResponse();
    }

    const limit = checkRateLimit(req, { max: 10, windowMs: 60_000 });
    if (limit.rateLimited) {
      return rateLimitResponse(limit);
    }

    const body = await req.json();
    const { query, embedding, mode = "deep" } = body;
    const localeParam = typeof body?.locale === "string" ? body.locale : "en";
    const locale = ["en", "zh", "hk"].includes(localeParam) ? localeParam : "en";

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (query.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Query too long (max 2000 characters)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine API to use
    const apiKey = OPENROUTER_API_KEY || DEEPSEEK_API_KEY;
    const apiUrl = OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions";
    const model = OPENROUTER_API_KEY
      ? "deepseek/deepseek-chat-v3-0324"
      : "deepseek-chat";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Retrieve context from SurrealDB (BM25 + vector) + Brave Search
    const bm25Promise = bm25Search(query.trim(), mode === "quick" ? 5 : 8, locale);
    const vectorPromise =
      embedding && Array.isArray(embedding) && embedding.length === 384
        ? vectorSearch(embedding, mode === "quick" ? 5 : 8)
        : Promise.resolve([]);
    const bravePromise = mode === "deep"
      ? braveSearch(query.trim(), 5)
      : Promise.resolve([]);

    const [bm25Results, vectorResults, braveResults] = await Promise.all([
      bm25Promise,
      vectorPromise,
      bravePromise,
    ]);

    // Hybrid fusion: RRF + ESG re-rank (replaces mergeAndRank)
    const mergedSources = hybridFuseAndRank(
      bm25Results,
      vectorResults,
      embedding,
    );

    // Append Brave results that aren't already in the merged set
    const existingUrls = new Set(mergedSources.map(s => s.url).filter(Boolean));
    for (const br of braveResults) {
      if (!existingUrls.has(br.url) && mergedSources.length < 25) {
        mergedSources.push(br);
        existingUrls.add(br.url);
      }
    }
    const { text: ragContext, citations } = buildRAGContext(mergedSources);

    // Prepare sources for the client (without full snippets for bandwidth)
    const clientSources = mergedSources.map((s) => ({
      id: s.id,
      title: s.title.replace(/ \(Chunk \d+\)$/, ""),
      permalink: s.permalink,
      url: s.url,
      source_type: s.source_type,
      book_title: s.book_title,
      domain: s.domain,
      section: s.section,
      snippet: s.snippet.slice(0, 150),
      citation: citations.get(s.id),
    }));

    // Deduplicate by title, keeping the first (lowest) citation number so the
    // displayed order still matches the inline citations in the answer.
    const seenTitles = new Set<string>();
    const uniqueSources = clientSources
      .filter((s) => {
        if (seenTitles.has(s.title)) return false;
        seenTitles.add(s.title);
        return true;
      })
      .slice(0, 12);

    // Step 2: Stream AI response with RAG context
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send sources first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", data: uniqueSources })}\n\n`
          )
        );

        // No retrieval at all: do not ask the model to answer from memory and
        // present it as a knowledge-base answer.
        if (!ragContext) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "no_evidence" })}\n\n`)
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", grounded: false })}\n\n`)
          );
          controller.close();
          return;
        }

        const languageName = languageForLocale(locale);

        // Build the prompt
        const userPrompt = `Answer the question using only the numbered context below. Cite sources inline as [n]. If the context is insufficient, say what is missing instead of guessing.\n\n---\n${ragContext}\n---\n\nUser question (answer in ${languageName}): ${query.trim()}`;

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              max_tokens: 2048,
              temperature: 0.3,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[AI Search] LLM API error:", response.status, errorText);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", data: "AI service temporarily unavailable" })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done", partial: true })}\n\n`)
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", data: "No response stream" })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;

              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "chunk", data: content })}\n\n`
                    )
                  );
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done" })}\n\n`
            )
          );
        } catch (err) {
          console.error("[AI Search] Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", data: "An error occurred while generating the answer" })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", partial: true })}\n\n`)
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Search] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
