import { describe, it, expect } from "vitest";
import { toWordBoundaryLiteral, wordBoundaryWhere } from "@/lib/search/query";

describe("toWordBoundaryLiteral", () => {
  it("lowercases and keeps words", () => {
    expect(toWordBoundaryLiteral("GRI Standards")).toBe("gri standards");
  });

  it("drops regex and SurrealQL metacharacters", () => {
    expect(toWordBoundaryLiteral("gri.*'; DROP TABLE page; --")).toBe("gri drop table page");
  });

  it("collapses whitespace", () => {
    expect(toWordBoundaryLiteral("  climate   risk  ")).toBe("climate risk");
  });

  it("returns an empty literal for punctuation-only input", () => {
    expect(toWordBoundaryLiteral("***")).toBe("");
  });

  it("keeps hyphens inside words", () => {
    expect(toWordBoundaryLiteral("Scope-3")).toBe("scope-3");
  });
});

describe("wordBoundaryWhere", () => {
  it("builds a case-insensitive boundary predicate", () => {
    expect(wordBoundaryWhere("name_en", "gri")).toBe("name_en ~ '(?i)\\bgri\\b'");
  });

  it("never returns a matchable predicate for an empty literal", () => {
    expect(wordBoundaryWhere("name_en", "")).toBe("false");
  });
});
