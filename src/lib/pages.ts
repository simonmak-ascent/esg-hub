import { queryHttp } from "./surrealdb";

export interface Page {
  id: string;
  slug: string;
  title: string;
  title_zh?: string | null;
  title_hi?: string | null;
  description: string | null;
  description_zh?: string | null;
  description_hi?: string | null;
  keywords: string | null;
  pillar: string | null;
  parent: string | null;
  permalink: string;
  layout: string;
  content: string;
  content_zh?: string | null;
  content_hi?: string | null;
  redirect_to: string | null;
  section: string | null;
  subsection: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  // Cross-reference fields
  standards?: string[];
  related_pages?: string[];
  connects_to?: string[];
  backlinks?: string[];
}

/**
 * Localized page with resolved translations
 */
export interface LocalizedPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  keywords: string | null;
  pillar: string | null;
  parent: string | null;
  permalink: string;
  layout: string;
  content: string;
  redirect_to: string | null;
  section: string | null;
  subsection: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  standards?: string[];
  related_pages?: string[];
  connects_to?: string[];
  backlinks?: string[];
}

/**
 * Check if database is configured
 * Exported for use in page components
 */
export function isDbConfigured(): boolean {
  const hasEndpoint = !!process.env.SURREAL_URL;
  const hasUsername = !!process.env.SURREAL_USERNAME;
  const hasPassword = !!process.env.SURREAL_PASSWORD;
  // SURREAL_NAMESPACE is hardcoded in surrealdb.ts ("esg_hub") — always present
  const hasDatabase = !!process.env.SURREAL_DATABASE;

  if (!hasEndpoint || !hasUsername || !hasPassword || !hasDatabase) {
    console.error("[pages] DB misconfigured — missing env vars:", {
      SURREAL_URL: hasEndpoint ? "set" : "MISSING",
      SURREAL_USERNAME: hasUsername ? "set" : "MISSING",
      SURREAL_PASSWORD: hasPassword ? "set" : "MISSING",
      SURREAL_NAMESPACE: "esg_hub (hardcoded)",
      SURREAL_DATABASE: hasDatabase ? process.env.SURREAL_DATABASE : "MISSING",
    });
  }

  return hasEndpoint && hasUsername && hasPassword && hasDatabase;
}

/**
 * Resolve localized content from a page
 */
export function localizePage(page: Page, locale: string): LocalizedPage {
  const isZh = locale === "zh";
  const isHi = locale === "hi";
  
  return {
    ...page,
    title: isZh && page.title_zh ? page.title_zh : (isHi && page.title_hi ? page.title_hi : page.title),
    description: isZh && page.description_zh ? page.description_zh : (isHi && page.description_hi ? page.description_hi : page.description),
    content: isZh && page.content_zh ? page.content_zh : (isHi && page.content_hi ? page.content_hi : page.content),
  };
}

/** Sentinel value returned when the database is unreachable or misconfigured. */
export const DB_ERROR = "db_error" as const;
export type DbError = typeof DB_ERROR;

/**
 * Get a page by its permalink with optional locale for localization.
 * Returns:
 *   - Page | LocalizedPage  — page found successfully
 *   - null                  — page not found (DB responded, no record matched)
 *   - DB_ERROR              — DB is unconfigured or threw an error
 */
export async function getPageByPermalink(
  permalink: string,
  locale?: string
): Promise<Page | LocalizedPage | null | DbError> {
  // Signal DB_ERROR if environment is not configured
  if (!isDbConfigured()) {
    console.log("[pages] Database not configured, returning db_error for:", permalink);
    return DB_ERROR;
  }

  // Normalize: ensure leading and trailing slashes
  let normalized = permalink;
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  if (!normalized.endsWith("/")) normalized += "/";

  try {
    const results = await queryHttp<Page>(
      `SELECT * FROM page WHERE permalink = $permalink LIMIT 1;`,
      { permalink: normalized }
    );

    if (results.length === 0) return null;
    
    const page = results[0];
    
    // If locale is specified, return localized page
    if (locale && locale !== "en") {
      return localizePage(page, locale);
    }
    
    return page;
  } catch (error) {
    console.error("[pages] Error fetching page:", error);
    console.error("[pages] Error details:", {
      permalink: normalized,
      endpoint: process.env.SURREAL_URL?.substring(0, 30) + "...",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return DB_ERROR;
  }
}

/**
 * Get all pages in a section with optional localization
 */
export async function getPagesBySection(section: string, locale?: string): Promise<LocalizedPage[]> {
  if (!isDbConfigured()) {
    console.log("[pages] Database not configured, returning empty array for section:", section);
    return [];
  }

  try {
    const pages = await queryHttp<Page>(
      `SELECT * FROM page WHERE section = $section ORDER BY title ASC;`,
      { section }
    );
    
    if (locale && locale !== "en") {
      return pages.map(page => localizePage(page, locale));
    }
    return pages as LocalizedPage[];
  } catch (error) {
    console.error("[pages] Error fetching pages by section:", error);
    return [];
  }
}

/**
 * Get all pages (for sitemap generation)
 */
export async function getAllPages(): Promise<Page[]> {
  if (!isDbConfigured()) {
    console.log("[pages] Database not configured, returning empty array for all pages");
    return [];
  }

  try {
    return queryHttp<Page>(
      `SELECT id, slug, title, permalink, section, subsection, pillar, parent, redirect_to, updated_at FROM page ORDER BY section ASC, title ASC;`
    );
  } catch (error) {
    console.error("[pages] Error fetching all pages:", error);
    return [];
  }
}

/**
 * Search pages by query with optional localization
 */
export async function searchPages(query: string, locale?: string): Promise<LocalizedPage[]> {
  if (!isDbConfigured()) {
    console.log("[pages] Database not configured, returning empty array for search");
    return [];
  }

  try {
    const pages = await queryHttp<Page>(
      `SELECT *, search::score(0) + search::score(1) AS relevance FROM page WHERE title @0@ $query OR content @1@ $query ORDER BY relevance DESC LIMIT 50;`,
      { query }
    );
    
    if (locale && locale !== "en") {
      return pages.map(page => localizePage(page, locale));
    }
    return pages as LocalizedPage[];
  } catch (error) {
    console.error("[pages] Error searching pages:", error);
    return [];
  }
}

/**
 * Get child pages of a parent section with optional localization
 */
export async function getChildPages(
  section: string,
  subsection?: string,
  locale?: string
): Promise<LocalizedPage[]> {
  if (!isDbConfigured()) {
    console.log("[pages] Database not configured, returning empty array for child pages");
    return [];
  }

  try {
    let pages: Page[];
    if (subsection) {
      pages = await queryHttp<Page>(
        `SELECT * FROM page WHERE section = $section AND subsection = $subsection AND slug != $subsection ORDER BY title ASC;`,
        { section, subsection }
      );
    } else {
      pages = await queryHttp<Page>(
        `SELECT * FROM page WHERE section = $section AND subsection IS NONE ORDER BY title ASC;`,
        { section }
      );
    }
    
    if (locale && locale !== "en") {
      return pages.map(page => localizePage(page, locale));
    }
    return pages as LocalizedPage[];
  } catch (error) {
    console.error("[pages] Error fetching child pages:", error);
    return [];
  }
}
