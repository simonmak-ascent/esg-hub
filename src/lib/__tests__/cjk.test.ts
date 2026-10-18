import { describe, it, expect } from "vitest";
import { cjkContainsWhere, cjkRelevance, cjkTerms } from "@/lib/search/cjk";

describe("cjkTerms", () => {
  it("strips question words and returns Han n-grams", () => {
    const terms = cjkTerms("什么是双重重要性？");
    expect(terms).toContain("重要性");
    expect(terms).toContain("双重");
    expect(terms).not.toContain("什么是");
  });

  it("keeps a short term whole", () => {
    expect(cjkTerms("可持续", 4)).toEqual(["可持续"]);
  });

  it("keeps Latin words", () => {
    expect(cjkTerms("Scope 3 排放")).toContain("scope");
  });

  it("removes quotes and statement separators", () => {
    const terms = cjkTerms("'; DROP TABLE page; -- 气候");
    expect(terms.join("")).not.toContain("'");
    expect(terms.join("")).not.toContain(";");
  });

  it("caps the term count", () => {
    expect(cjkTerms("企业可持续发展报告披露要求", 5)).toHaveLength(5);
  });
});

describe("cjkContainsWhere", () => {
  it("builds an OR across columns and terms", () => {
    expect(cjkContainsWhere(["title_zh", "content_zh"], ["双重"])).toBe(
      "title_zh CONTAINS '双重' OR content_zh CONTAINS '双重'"
    );
  });

  it("is never matchable without terms", () => {
    expect(cjkContainsWhere(["title_zh"], [])).toBe("false");
  });
});

describe("cjkRelevance", () => {
  it("ranks a title match above a body match", () => {
    expect(cjkRelevance("双重重要性", ["双重"])).toBe(10);
    expect(cjkRelevance("其他页面", ["双重"])).toBe(1);
    expect(cjkRelevance(null, ["双重"])).toBe(1);
  });
});
