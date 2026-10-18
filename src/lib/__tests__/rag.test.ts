import { describe, it, expect } from "vitest";
import { buildRAGContext, dedupeSources, languageForLocale, pageSnippet, type RagSource } from "@/lib/search/rag";

function src(over: Partial<RagSource> & Pick<RagSource, "id" | "source_type">): RagSource {
  return { title: "Title", snippet: "snippet", ...over };
}

describe("pageSnippet", () => {
  it("drops the leading h1 and markdown syntax", () => {
    expect(pageSnippet("# Heading\n\n**Bold** claim [link](x).", "fallback")).toBe(
      "Bold claim link x ."
    );
  });

  it("falls back when the body is empty", () => {
    expect(pageSnippet("   ", "fallback text")).toBe("fallback text");
  });

  it("truncates to 600 characters", () => {
    expect(pageSnippet("a".repeat(900), "")).toHaveLength(600);
  });
});

describe("buildRAGContext", () => {
  it("returns an empty context when nothing was retrieved", () => {
    const { text, citations } = buildRAGContext([]);
    expect(text).toBe("");
    expect(citations.size).toBe(0);
  });

  it("numbers pages, books, externals and web results in order", () => {
    const sources = [
      src({ id: "page:1", source_type: "page" }),
      src({ id: "page:2", source_type: "page" }),
      src({ id: "book_chunk:1", source_type: "book_chunk", book_title: "Book" }),
      src({ id: "external_resource:1", source_type: "external", domain: "oecd.org" }),
      src({ id: "brave:https://x", source_type: "external", url: "https://x" }),
    ];
    const { text, citations } = buildRAGContext(sources);

    expect(citations.get("page:1")).toBe(1);
    expect(citations.get("page:2")).toBe(2);
    expect(citations.get("book_chunk:1")).toBe(3);
    expect(citations.get("external_resource:1")).toBe(4);
    expect(citations.get("brave:https://x")).toBe(5);
    expect(text).toContain("[1] Title");
    expect(text).toContain("[5] Title");
  });

  it("does not list a web result as a curated external resource", () => {
    const { text } = buildRAGContext([
      src({ id: "brave:https://x", source_type: "external", url: "https://x", domain: "x" }),
    ]);
    expect(text).toContain("Web Search Results");
    expect(text).not.toContain("External Resources");
  });

  it("caps pages at eight so the prompt stays bounded", () => {
    const sources = Array.from({ length: 12 }, (_, i) =>
      src({ id: `page:${i}`, source_type: "page" })
    );
    const { citations } = buildRAGContext(sources);
    expect(citations.size).toBe(8);
    expect(citations.has("page:8")).toBe(false);
  });
});

describe("languageForLocale", () => {
  it("maps locales to answer languages", () => {
    expect(languageForLocale("en")).toBe("English");
    expect(languageForLocale("zh")).toBe("Simplified Chinese");
    expect(languageForLocale("hk")).toBe("Traditional Chinese (Hong Kong)");
    expect(languageForLocale("fr")).toBe("English");
  });
});

describe("dedupeSources", () => {
  it("collapses chunks of the same book", () => {
    const out = dedupeSources([
      src({ id: "book_chunk:1", source_type: "book_chunk", book_title: "Book A" }),
      src({ id: "book_chunk:2", source_type: "book_chunk", book_title: "Book A" }),
      src({ id: "book_chunk:3", source_type: "book_chunk", book_title: "Book B" }),
    ]);
    expect(out.map((s) => s.id)).toEqual(["book_chunk:1", "book_chunk:3"]);
  });

  it("keeps distinct pages with the same title", () => {
    const out = dedupeSources([
      src({ id: "page:1", source_type: "page", title: "Materiality" }),
      src({ id: "page:2", source_type: "page", title: "Materiality" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("keeps distinct external resources", () => {
    const out = dedupeSources([
      src({ id: "external_resource:1", source_type: "external" }),
      src({ id: "brave:https://x", source_type: "external", url: "https://x" }),
    ]);
    expect(out).toHaveLength(2);
  });
});
