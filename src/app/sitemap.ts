import { MetadataRoute } from "next";
import { getAllPages } from "@/lib/pages";
import { formatPermalink } from "@/lib/utils";

const BASE_URL = "https://esg-hub.ascent.partners";

// The sitemap is identical for every request until content changes; regenerating
// it on each hit made `lastmod` equal the request time and devalued the signal.
export const revalidate = 3600;

const LOCALES = ["en", "zh", "hk"] as const;

const LANGUAGE_TAG: Record<(typeof LOCALES)[number], string> = {
  en: "en-GB",
  zh: "zh-Hans",
  hk: "zh-Hant-HK",
};

const STATIC_PATHS = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/contents", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/books", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/videos", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/developers", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/developers/api", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/developers/mcp", priority: 0.5, changeFrequency: "monthly" as const },
];

function localizedUrl(locale: (typeof LOCALES)[number], path: string): string {
  if (locale === "en") return `${BASE_URL}${path}`;
  return `${BASE_URL}/${locale}${path === "/" ? "" : path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getAllPages();

  const latestUpdate = pages.reduce<Date | null>((latest, page) => {
    if (!page.updated_at) return latest;
    const updated = new Date(page.updated_at);
    if (Number.isNaN(updated.getTime())) return latest;
    return !latest || updated > latest ? updated : latest;
  }, null) ?? new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const route of STATIC_PATHS) {
    const languages = Object.fromEntries([
      ...LOCALES.map((locale) => [LANGUAGE_TAG[locale], localizedUrl(locale, route.path)]),
      ["x-default", localizedUrl("en", route.path)],
    ]);

    for (const locale of LOCALES) {
      entries.push({
        url: localizedUrl(locale, route.path),
        lastModified: latestUpdate,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }

  for (const page of pages) {
    if (page.redirect_to) continue;

    const path = formatPermalink(page.permalink);
    const lastModified = page.updated_at ? new Date(page.updated_at) : latestUpdate;
    const priority = page.section === "home" ? 1.0 : page.subsection ? 0.6 : 0.8;

    const languages = Object.fromEntries([
      ...LOCALES.map((locale) => [LANGUAGE_TAG[locale], localizedUrl(locale, path)]),
      ["x-default", localizedUrl("en", path)],
    ]);

    for (const locale of LOCALES) {
      entries.push({
        url: localizedUrl(locale, path),
        lastModified,
        changeFrequency: "monthly",
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
