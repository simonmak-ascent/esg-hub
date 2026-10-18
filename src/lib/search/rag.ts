/**
 * Retrieval-augmented generation context building.
 *
 * Kept out of the route so the citation numbering can be unit-tested: the
 * number assigned to a source here is the number the UI shows against the
 * source card, so an off-by-one is a visible accuracy bug.
 */

export interface RagSource {
  id: string;
  title: string;
  snippet: string;
  source_type: "page" | "book_chunk" | "external";
  permalink?: string;
  url?: string;
  book_title?: string;
  domain?: string;
  section?: string;
}

export interface RagContext {
  text: string;
  citations: Map<string, number>;
}

/**
 * Build a compact context snippet from an article body.
 *
 * The stored description is often template copy ("… — ESG Hub comprehensive
 * reference"), so the lede of the body is a far better grounding signal.
 */
export function pageSnippet(content: string, fallback: string): string {
  const cleaned = content
    .replace(/^\s*#\s+.*$/m, " ")
    .replace(/[#>*_`\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 600);
}

/**
 * Collapse duplicate *display* entries before numbering.
 *
 * Book chunks share a title, so numbering the raw list produced citations
 * (`[7]`, `[8]`) that had no card in the UI. Distinct pages and distinct
 * external URLs are kept; only chunks of the same book collapse.
 */
export function dedupeSources(sources: RagSource[]): RagSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key =
      source.source_type === "book_chunk"
        ? `book:${source.book_title ?? source.id}`
        : `${source.source_type}:${source.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Number every context block so the model can cite `[n]` and the UI can show
 * the same number. Brave web results are cited separately and are never
 * double-counted as curated external resources.
 */
export function buildRAGContext(sources: RagSource[]): RagContext {
  const parts: string[] = [];
  const citations = new Map<string, number>();
  let n = 0;

  const cite = (source: RagSource): string => {
    n += 1;
    citations.set(source.id, n);
    return `[${n}]`;
  };

  const pages = sources.filter((s) => s.source_type === "page").slice(0, 8);
  if (pages.length > 0) {
    parts.push("## ESG Hub Articles\n");
    for (const p of pages) {
      parts.push(`${cite(p)} ${p.title}${p.section ? ` [${p.section}]` : ""}\n${p.snippet}\n`);
    }
  }

  const bookChunks = sources.filter((s) => s.source_type === "book_chunk").slice(0, 6);
  if (bookChunks.length > 0) {
    parts.push("\n## Book Excerpts\n");
    for (const c of bookChunks) {
      parts.push(`${cite(c)} From "${c.book_title}"\n${c.snippet}\n`);
    }
  }

  const externals = sources
    .filter((s) => s.source_type === "external" && !s.id.startsWith("brave:"))
    .slice(0, 4);
  if (externals.length > 0) {
    parts.push("\n## External Resources\n");
    for (const e of externals) {
      parts.push(
        `${cite(e)} ${e.title} (${e.domain || "external"})\n${e.snippet}${e.url ? `\nSource: ${e.url}` : ""}\n`
      );
    }
  }

  const webResults = sources.filter((s) => s.id.startsWith("brave:")).slice(0, 5);
  if (webResults.length > 0) {
    parts.push("\n## Web Search Results (from authoritative ESG sources)\n");
    for (const w of webResults) {
      parts.push(`${cite(w)} ${w.title} (${w.domain})\n${w.snippet}\nURL: ${w.url}\n`);
    }
  }

  return { text: parts.join("\n"), citations };
}

/** Human-readable language name for the answer instruction. */
export function languageForLocale(locale: string): string {
  if (locale === "zh") return "Simplified Chinese";
  if (locale === "hk") return "Traditional Chinese (Hong Kong)";
  return "English";
}
