/**
 * Markdown utility functions for ESG Hub
 * Shared utilities for parsing and processing markdown content
 */

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/**
 * Extract h2 and h3 headings from markdown content for table of contents
 * @param markdown - The markdown content to parse
 * @returns Array of heading objects with level, text, and id
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seenIds = new Set<string>();
  const lines = markdown.split("\n");
  
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      // Remove markdown formatting: bold, italic, code, and extract link text
      const text = match[2]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Replace [text](url) with text
        .replace(/[*_`\[\]]/g, "")  // Remove remaining formatting chars
        .trim();
      const baseId = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      
      let id = baseId;
      let counter = 1;
      while (seenIds.has(id)) {
        id = `${baseId}-${counter}`;
        counter++;
      }
      seenIds.add(id);
      headings.push({ level, text, id });
    }
  }
  
  return headings;
}

/**
 * Remove a leading level-1 heading from markdown content.
 *
 * Page titles are rendered by the article template, so a leading `# Heading`
 * (or `<h1>` block) in the stored body would produce a duplicate `<h1>` and
 * break the document outline. Only the very first heading is removed; headings
 * later in the body are left untouched.
 *
 * @param markdown - The markdown content
 * @returns The content without a leading level-1 heading
 */
export function stripLeadingH1(markdown: string): string {
  const atx = markdown.match(/^\s*#\s+.*(?:\r?\n|$)/);
  if (atx) {
    return markdown.slice(atx[0].length);
  }

  const html = markdown.match(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>(?:\r?\n)?/i);
  if (html) {
    return markdown.slice(html[0].length);
  }

  return markdown;
}

/**
 * Generate a URL-friendly ID from text
 * @param text - The text to convert
 * @returns URL-safe ID string
 */
export function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Get first paragraph from markdown content
 * @param markdown - The markdown content
 * @returns First paragraph or empty string
 */
export function getFirstParagraph(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-")) {
      return trimmed;
    }
  }
  return "";
}
