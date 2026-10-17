import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { stripLeadingH1 } from "@/lib/markdown";

function stripFullPageHtml(html: string): string {
  let result = html;
  result = result.replace(/<html[^>]*>/gi, "");
  result = result.replace(/<\/html>/gi, "");
  result = result.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  result = result.replace(/<\/head>/gi, "");
  result = result.replace(/<body[^>]*>/gi, "");
  result = result.replace(/<\/body>/gi, "");
  result = result.replace(/<!DOCTYPE[^>]*>/gi, "");
  return result;
}

/**
 * Sanitisation schema for knowledge-base content.
 *
 * Stored bodies are markdown with occasional HTML blocks (infoboxes, tables,
 * figures). They originate from scraped pages and the LLM ingestion pipeline,
 * so `rehype-raw` is always paired with `rehype-sanitize`: no scripts, event
 * handlers, `javascript:` URLs, or embedded frames survive.
 */
export const contentSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "aside",
    "figure",
    "figcaption",
    "details",
    "summary",
    "mark",
    "small",
    "picture",
    "source",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "title",
      "dir",
      "lang",
    ],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    td: [...(defaultSchema.attributes?.td ?? []), "colSpan", "rowSpan", "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "colSpan", "rowSpan", "align", "scope"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "loading"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
    src: ["http", "https"],
  },
};

export default function MarkdownContent({ content }: { content: string }) {
  const sanitizedContent = stripLeadingH1(stripFullPageHtml(content));

  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, contentSchema],
          rehypeSlug,
        ]}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}
