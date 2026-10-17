import { describe, it, expect } from "vitest";
import { parseEmbedding, parseResultCount, parseSource } from "@/lib/search/validate";

describe("parseEmbedding", () => {
  it("accepts a 384-dimension numeric vector", () => {
    const vector = new Array(384).fill(0.1);
    expect(parseEmbedding(vector)).toHaveLength(384);
  });

  it("rejects non-arrays", () => {
    expect(parseEmbedding("[]")).toBeNull();
    expect(parseEmbedding(undefined)).toBeNull();
    expect(parseEmbedding({})).toBeNull();
  });

  it("rejects empty, short, and oversized vectors", () => {
    expect(parseEmbedding([])).toBeNull();
    expect(parseEmbedding([0.1, 0.2])).toBeNull();
    expect(parseEmbedding(new Array(5000).fill(0.1))).toBeNull();
  });

  it("rejects non-numeric elements", () => {
    const base = new Array(384).fill(0.1);
    expect(parseEmbedding([...base.slice(1), "0.2"])).toBeNull();
    expect(parseEmbedding([...base.slice(1), NaN])).toBeNull();
    expect(parseEmbedding([...base.slice(1), Infinity])).toBeNull();
  });
});

describe("parseResultCount", () => {
  it("defaults when absent", () => {
    expect(parseResultCount(undefined)).toBe(10);
    expect(parseResultCount(null)).toBe(10);
  });

  it("accepts an integer in range", () => {
    expect(parseResultCount(25)).toBe(25);
    expect(parseResultCount(50)).toBe(50);
  });

  it("rejects out-of-range and non-integer numbers", () => {
    expect(parseResultCount(0)).toBeNull();
    expect(parseResultCount(51)).toBeNull();
    expect(parseResultCount(3.5)).toBeNull();
  });

  it("rejects strings, including SQL-shaped payloads", () => {
    expect(parseResultCount("10")).toBeNull();
    expect(parseResultCount("10; SELECT * FROM page; --")).toBeNull();
  });
});

describe("parseSource", () => {
  it("keeps known values", () => {
    expect(parseSource("pages")).toBe("pages");
    expect(parseSource("external")).toBe("external");
  });

  it("defaults unknown values to all", () => {
    expect(parseSource("everything")).toBe("all");
    expect(parseSource("'; DROP")).toBe("all");
  });
});
