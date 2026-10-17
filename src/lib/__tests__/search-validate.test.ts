import { describe, it, expect } from "vitest";
import { clampResultCount, parseEmbedding, parseSource } from "@/lib/search/validate";

describe("clampResultCount", () => {
  it("accepts a valid integer", () => {
    expect(clampResultCount(7)).toBe(7);
  });

  it("clamps to the maximum", () => {
    expect(clampResultCount(10_000)).toBe(50);
  });

  it("falls back for non-numeric input", () => {
    expect(clampResultCount("1,100|> [] ; DROP TABLE page; --")).toBe(10);
  });

  it("rejects numeric strings that contain SQL", () => {
    expect(clampResultCount("10; DELETE page")).toBe(10);
  });

  it("floors floats", () => {
    expect(clampResultCount(3.9)).toBe(3);
  });

  it("rejects zero, negatives, and non-finite values", () => {
    expect(clampResultCount(0)).toBe(10);
    expect(clampResultCount(-5)).toBe(10);
    expect(clampResultCount(Infinity)).toBe(10);
    expect(clampResultCount(NaN)).toBe(10);
  });
});

describe("parseEmbedding", () => {
  it("accepts a numeric vector", () => {
    expect(parseEmbedding([0.1, -0.2, 3])).toEqual([0.1, -0.2, 3]);
  });

  it("rejects non-arrays", () => {
    expect(parseEmbedding("[]")).toBeNull();
    expect(parseEmbedding(undefined)).toBeNull();
    expect(parseEmbedding({})).toBeNull();
  });

  it("rejects empty and oversized vectors", () => {
    expect(parseEmbedding([])).toBeNull();
    expect(parseEmbedding(new Array(5000).fill(0.1))).toBeNull();
  });

  it("rejects non-numeric elements", () => {
    expect(parseEmbedding([0.1, "0.2"])).toBeNull();
    expect(parseEmbedding([0.1, NaN])).toBeNull();
    expect(parseEmbedding([0.1, Infinity])).toBeNull();
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
