import type { HybridSearchResponse, RankedResult, SearchResult } from "./types";

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function percentileRank(scores: number[]): number[] {
  const n = scores.length;
  if (n === 0) return [];

  const indexed = scores.map((score, idx) => ({ score, idx }));
  indexed.sort((a, b) => a.score - b.score);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j].score === indexed[i].score) {
      j++;
    }
    const avgRank = (i + j - 1) / 2;
    const pct = n > 1 ? avgRank / (n - 1) : 0;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].idx] = pct;
    }
    i = j;
  }
  return ranks;
}

// ---------------------------------------------------------------------------
// Stage 1: Reciprocal Rank Fusion
// ---------------------------------------------------------------------------

export interface RrfInput {
  id: string;
  table: string;
  score: number;
}

interface RrfOutput {
  id: string;
  table: string;
  rrfScore: number;
}

export function rrfFusion(
  bm25Results: RrfInput[],
  hnswResults: RrfInput[],
  k: number = 60
): RrfOutput[] {
  return rrfFuseLists([bm25Results, hnswResults], k);
}

/**
 * Fuse any number of ranked lists.
 *
 * Each list is ranked independently (rank = position within that list), so a
 * framework that is the best match in its own table is not pushed behind every
 * page result simply because pages are queried first.
 */
export function rrfFuseLists(lists: RrfInput[][], k: number = 60): RrfOutput[] {
  const docMap = new Map<string, RrfOutput>();

  for (const results of lists) {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      const key = `${r.table}:${r.id}`;
      const term = 1 / (k + i + 1);
      const existing = docMap.get(key);
      if (existing) {
        existing.rrfScore += term;
      } else {
        docMap.set(key, {
          id: r.id,
          table: r.table,
          rrfScore: term,
        });
      }
    }
  }

  const fused = Array.from(docMap.values());
  fused.sort((a, b) => b.rrfScore - a.rrfScore);
  return fused;
}

// ---------------------------------------------------------------------------
// Stage 2: ESG-aware percentile re-rank
// ---------------------------------------------------------------------------

const LAMBDA = Math.log(2) / 730; // 2-year half-life in days

export function esgRerank(
  fused: RankedResult[],
  queryEmbedding?: number[],
  knownFrameworks?: Set<string>,
  queryTokens?: string[],
  docAuthority?: Map<string, number>,
  docUpdatedAt?: Map<string, Date>,
  docEmbeddings?: Map<string, number[]>,
  docFacets?: Map<string, string[]>
): RankedResult[] {
  if (fused.length === 0) return [];

  // Percentile-rank RRF scores → textScore
  const rrfRaw = fused.map((d) => d.rrfScore);
  const textPcts = percentileRank(rrfRaw);

  // Compute raw topicMatch if embeddings are available
  let topicRaw: number[] | undefined;
  if (
    queryEmbedding &&
    docEmbeddings &&
    docEmbeddings.size > 0
  ) {
    topicRaw = fused.map((d) => {
      const emb = docEmbeddings.get(`${d.table}:${d.id}`);
      if (emb && emb.length === queryEmbedding.length) {
        return cosineSimilarity(queryEmbedding, emb);
      }
      return 0;
    });
  }

  // Percentile-rank topic scores
  let topicPcts: number[] | undefined;
  if (topicRaw) {
    const hasNonzero = topicRaw.some((v) => v > 0);
    topicPcts = hasNonzero ? percentileRank(topicRaw) : topicRaw.map(() => 0);
  }

  // Determine whether framework matching applies
  const hasFrameworkMatch =
    queryTokens !== undefined &&
    knownFrameworks !== undefined &&
    queryTokens.some((t) => knownFrameworks.has(t));

  const now = new Date();

  const reranked = fused.map((doc, idx) => {
    let weightText = 0.4;
    let weightFramework = 0.2;
    let weightTopic = 0.15;
    let weightAuthority = 0.15;
    const weightFreshness = 0.1;

    // --- frameworkMatch ---
    let frameworkMatch = 0;
    if (hasFrameworkMatch && queryTokens && docFacets) {
      const queryFrameworks = queryTokens.filter((t) =>
        knownFrameworks!.has(t)
      );
      const docFrameworks = docFacets.get(`${doc.table}:${doc.id}`) ?? [];
      frameworkMatch = jaccardSimilarity(queryFrameworks, docFrameworks);
    } else {
      // Redistribute framework weight to text
      weightText += weightFramework;
      weightFramework = 0;
    }

    // --- topicMatch ---
    const topicMatch =
      topicPcts !== undefined ? topicPcts[idx] : 0;
    if (topicPcts === undefined) {
      // Redistribute topic weight when embeddings not available
      weightText += weightTopic * 0.5;
      weightFramework += weightTopic * 0.3;
      weightAuthority += weightTopic * 0.2;
      weightTopic = 0;
    }

    // --- authority ---
    const authority =
      docAuthority?.get(`${doc.table}:${doc.id}`) ?? 0.3;

    // --- freshness ---
    let freshness = 0.3;
    const updatedAt = docUpdatedAt?.get(`${doc.table}:${doc.id}`);
    if (updatedAt) {
      const ageDays =
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      freshness = Math.exp(-LAMBDA * Math.max(0, ageDays));
    }

    const finalScore =
      weightText * textPcts[idx] +
      weightFramework * frameworkMatch +
      weightTopic * topicMatch +
      weightAuthority * authority +
      weightFreshness * freshness;

    return {
      ...doc,
      textScore: textPcts[idx],
      frameworkMatch,
      topicMatch,
      authority,
      freshness,
      finalScore,
    };
  });

  reranked.sort((a, b) => b.finalScore - a.finalScore);
  return reranked;
}

// ---------------------------------------------------------------------------
// Integration: fuse → rerank → paginate → respond
// ---------------------------------------------------------------------------

interface DocMeta {
  title: string;
  permalink?: string;
  url?: string;
  description?: string;
  section?: string;
  domain?: string;
  source_type?: "page" | "external";
}

export function fuseRerankAndRespond(
  bm25Results: RrfInput[],
  hnswResults: RrfInput[],
  params: {
    limit?: number;
    offset?: number;
    queryEmbedding?: number[];
    knownFrameworks?: Set<string>;
    queryTokens?: string[];
    docAuthority?: Map<string, number>;
    docUpdatedAt?: Map<string, Date>;
    docEmbeddings?: Map<string, number[]>;
    docFacets?: Map<string, string[]>;
    docMetadata?: Map<string, DocMeta>;
  }
): HybridSearchResponse {
  return fuseListsAndRespond([bm25Results, hnswResults], params);
}

/**
 * Fuse ranked lists, re-rank, deduplicate and paginate.
 *
 * `lists` are ranked independently — one list per table and per retriever.
 */
export function fuseListsAndRespond(
  lists: RrfInput[][],
  params: {
    limit?: number;
    offset?: number;
    queryEmbedding?: number[];
    knownFrameworks?: Set<string>;
    queryTokens?: string[];
    docAuthority?: Map<string, number>;
    docUpdatedAt?: Map<string, Date>;
    docEmbeddings?: Map<string, number[]>;
    docFacets?: Map<string, string[]>;
    docMetadata?: Map<string, DocMeta>;
  }
): HybridSearchResponse {
  const fused = rrfFuseLists(lists);

  const rankedInput: RankedResult[] = fused.map((f) => ({
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

  const reranked = esgRerank(
    rankedInput,
    params.queryEmbedding,
    params.knownFrameworks,
    params.queryTokens,
    params.docAuthority,
    params.docUpdatedAt,
    params.docEmbeddings,
    params.docFacets
  );

  // Collapse duplicate records (the same title in the same table, e.g. a
  // framework that was backfilled twice). The highest-scoring copy wins.
  const seenTitles = new Set<string>();
  const deduped = reranked.filter((r) => {
    const meta = params.docMetadata?.get(`${r.table}:${r.id}`);
    if (!meta?.title) return true;
    const key = `${r.table}:${meta.title.trim().toLowerCase()}`;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);
  const total = deduped.length;
  const page = deduped.slice(offset, offset + limit);

  const results: SearchResult[] = page.map((r) => {
    const meta = params.docMetadata?.get(`${r.table}:${r.id}`);
    return {
      id: r.id,
      table: r.table,
      title: meta?.title ?? "",
      permalink: meta?.permalink,
      url: meta?.url,
      description: meta?.description,
      section: meta?.section,
      domain: meta?.domain,
      relevance: Math.round(r.finalScore * 10000) / 100,
      source_type: meta?.source_type ?? "page",
    };
  });

  return {
    results,
    pagination: {
      total,
      offset,
      limit,
      has_more: offset + limit < total,
    },
    mode: "hybrid",
  };
}
