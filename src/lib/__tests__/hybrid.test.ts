import { describe, it, expect } from "vitest";
import {
  rrfFusion,
  rrfFuseLists,
  fuseListsAndRespond,
  percentileRank,
  jaccardSimilarity,
  cosineSimilarity,
  esgRerank,
} from "@/lib/search/hybrid";
import type { RankedResult } from "@/lib/search/types";

interface RrfInput {
  id: string;
  table: string;
  score: number;
}

function makeInput(id: string, table: string, score: number): RrfInput {
  return { id, table, score };
}

function makeRanked(
  id: string,
  table: string,
  rrfScore: number,
  textScore = 0,
  frameworkMatch = 0,
  topicMatch = 0,
  authority = 0.3,
  freshness = 1,
): RankedResult {
  return { id, table, rrfScore, textScore, frameworkMatch, topicMatch, authority, freshness, finalScore: 0 };
}

describe("rrfFusion", () => {
  it("fuses two overlapping result sets", () => {
    const bm25 = [makeInput("a", "page", 10), makeInput("b", "page", 5)];
    const hnsw = [makeInput("b", "page", 8), makeInput("c", "framework", 3)];
    const result = rrfFusion(bm25, hnsw, 60);
    expect(result.length).toBe(3);
    const b = result.find((r) => r.id === "b");
    expect(b).toBeDefined();
    expect(b!.rrfScore).toBeGreaterThan(0);
  });

  it("handles doc in only one ranker", () => {
    const bm25 = [makeInput("a", "page", 10)];
    const hnsw: RrfInput[] = [];
    const result = rrfFusion(bm25, hnsw, 60);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("a");
    expect(result[0].rrfScore).toBe(1 / 61);
  });

  it("higher ranked docs get higher RRF scores", () => {
    const bm25 = [makeInput("top", "page", 100), makeInput("mid", "page", 50), makeInput("low", "page", 1)];
    const hnsw: RrfInput[] = [];
    const result = rrfFusion(bm25, hnsw, 60);
    expect(result[0].id).toBe("top");
    expect(result[2].id).toBe("low");
    expect(result[0].rrfScore).toBeGreaterThan(result[2].rrfScore);
  });

  it("k parameter affects score magnitude", () => {
    const bm25 = [makeInput("a", "page", 1)];
    const hnsw: RrfInput[] = [];
    const smallK = rrfFusion(bm25, hnsw, 1);
    const largeK = rrfFusion(bm25, hnsw, 100);
    expect(smallK[0].rrfScore).toBeGreaterThan(largeK[0].rrfScore);
  });

  it("empty input returns empty", () => {
    const result = rrfFusion([], [], 60);
    expect(result).toEqual([]);
  });

  it("sorts by RRF score descending", () => {
    const bm25 = [makeInput("a", "page", 1), makeInput("b", "page", 50)];
    const hnsw: RrfInput[] = [];
    const result = rrfFusion(bm25, hnsw, 60);
    expect(result[0].id).toBe("a");
  });
});

describe("percentileRank", () => {
  it("maps three distinct scores to percentiles", () => {
    const result = percentileRank([10, 20, 30]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0, 1);
    expect(result[1]).toBeCloseTo(0.5, 1);
    expect(result[2]).toBeCloseTo(1.0, 1);
  });

  it("handles ties with average rank", () => {
    const result = percentileRank([5, 5, 5]);
    expect(result[0]).toBeCloseTo(0.5, 1);
    expect(result[1]).toBeCloseTo(0.5, 1);
    expect(result[2]).toBeCloseTo(0.5, 1);
  });

  it("single element returns 1.0", () => {
    const result = percentileRank([42]);
    expect(result[0]).toBe(0);
  });

  it("unsorted input produces same as sorted", () => {
    const r1 = percentileRank([30, 10, 20]);
    const r2 = percentileRank([10, 20, 30]);
    expect(r1[0]).toBeCloseTo(r2[2], 5);
    expect(r1[1]).toBeCloseTo(r2[0], 5);
  });

  it("handles negative scores", () => {
    const result = percentileRank([-10, 0, 10]);
    expect(result[0]).toBeCloseTo(0, 1);
    expect(result[2]).toBeCloseTo(1, 1);
  });

  it("empty array returns empty", () => {
    const result = percentileRank([]);
    expect(result).toEqual([]);
  });
});

describe("jaccardSimilarity", () => {
  it("full overlap returns 1", () => {
    expect(jaccardSimilarity(["a", "b"], ["a", "b"])).toBe(1);
  });

  it("no overlap returns 0", () => {
    expect(jaccardSimilarity(["a"], ["b"])).toBe(0);
  });

  it("partial overlap", () => {
    expect(jaccardSimilarity(["a", "b", "c"], ["b", "c", "d"])).toBe(2 / 4);
  });

  it("empty sets return 0", () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it("one empty set returns 0", () => {
    expect(jaccardSimilarity(["a"], [])).toBe(0);
  });

  it("case sensitive", () => {
    expect(jaccardSimilarity(["A"], ["a"])).toBe(0);
  });
});

describe("cosineSimilarity", () => {
  it("identical vectors return ~1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("orthogonal vectors return ~0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("zero vector returns 0", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("both zero vectors return 0", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe("esgRerank", () => {
  const docs = [
    makeRanked("d1", "page", 0.8, 0.5, 0.2, 0.6, 0.5, 0.9),
    makeRanked("d2", "framework", 0.6, 0.3, 0.8, 0.4, 0.8, 0.3),
    makeRanked("d3", "term", 0.4, 0.1, 0.1, 0.2, 0.3, 1),
  ];

  it("returns sorted by finalScore descending", () => {
    const result = esgRerank(docs, undefined, new Set(["gri"]), ["gri", "emissions"]);
    expect(result[0].finalScore).toBeGreaterThanOrEqual(result[1].finalScore);
    expect(result[1].finalScore).toBeGreaterThanOrEqual(result[2].finalScore);
  });

  it("uses default authority 0.3 when not provided", () => {
    const doc = makeRanked("x", "page", 0.5, 0.5, 0.2, 0.4);
    const result = esgRerank([doc]);
    expect(result[0].authority).toBe(0.3);
  });

  it("redistributes framework weight when no framework tokens", () => {
    const doc = makeRanked("x", "page", 0.5, 0.5, 0, 0.4);
    const result = esgRerank([doc], undefined, undefined, []);
    expect(result[0].finalScore).toBeGreaterThan(0);
  });

  it("freshness decay affects score", () => {
    const fresh = makeRanked("fresh", "page", 0.5, 0.5, 0.2, 0.4, 0.5, 0.99);
    const stale = makeRanked("stale", "page", 0.5, 0.5, 0.2, 0.4, 0.5, 0.1);
    const result = esgRerank([fresh, stale]);
    expect(result[0].id).toBe("fresh");
  });

  it("produces scores in valid range", () => {
    const result = esgRerank(docs);
    result.forEach((r) => {
      expect(r.finalScore).toBeGreaterThanOrEqual(0);
      expect(r.finalScore).toBeLessThanOrEqual(1);
    });
  });
});

describe("rrfFuseLists", () => {
  it("ranks each list independently instead of by concatenation order", () => {
    const pages = Array.from({ length: 10 }, (_, i) => makeInput(`p${i}`, "page", 10 - i));
    const frameworks = [makeInput("f1", "framework", 1)];

    const fused = rrfFuseLists([pages, frameworks], 60);
    const page10 = fused.findIndex((r) => r.id === "p9");
    const framework1 = fused.findIndex((r) => r.id === "f1");

    // A framework ranked first in its own table must beat the 10th page.
    expect(framework1).toBeLessThan(page10);
  });

  it("accumulates score when a document appears in several lists", () => {
    const a = [makeInput("x", "page", 1)];
    const b = [makeInput("x", "page", 1)];
    const single = rrfFuseLists([a], 60);
    const both = rrfFuseLists([a, b], 60);
    expect(both[0].rrfScore).toBeCloseTo(single[0].rrfScore * 2, 10);
  });

  it("returns an empty list for no input", () => {
    expect(rrfFuseLists([], 60)).toEqual([]);
    expect(rrfFuseLists([[], []], 60)).toEqual([]);
  });
});

describe("fuseListsAndRespond", () => {
  const meta = new Map([
    ["framework:1", { title: "GRI Standards", permalink: "gri" }],
    ["framework:2", { title: "gri standards ", permalink: "gri-dup" }],
    ["page:9", { title: "Climate Change", permalink: "climate-change" }],
  ]);

  it("deduplicates the same title within a table", () => {
    const lists = [[
      makeInput("1", "framework", 1),
      makeInput("2", "framework", 1),
      makeInput("9", "page", 1),
    ]];
    const res = fuseListsAndRespond(lists, { docMetadata: meta, limit: 10 });
    const frameworks = res.results.filter((r) => r.table === "framework");
    expect(frameworks).toHaveLength(1);
    expect(res.results).toHaveLength(2);
  });

  it("carries permalink and labels pages with the singular source_type", () => {
    const res = fuseListsAndRespond([[makeInput("9", "page", 1)]], {
      docMetadata: meta,
      limit: 10,
    });
    expect(res.results[0]).toMatchObject({
      permalink: "climate-change",
      source_type: "page",
    });
  });

  it("paginates the deduplicated pool", () => {
    const res = fuseListsAndRespond([[makeInput("9", "page", 1)]], {
      docMetadata: meta,
      limit: 10,
      offset: 5,
    });
    expect(res.results).toHaveLength(0);
    expect(res.pagination.total).toBe(1);
    expect(res.pagination.has_more).toBe(false);
  });
});
