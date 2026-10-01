import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { getPageByPermalink, getPagesBySection, DB_ERROR } from "@/lib/pages";
import { extractHeadings } from "@/lib/markdown";
import { formatPermalink } from "@/lib/utils";
import { SITE_URL, HUB_PAGE_MAX_CONTENT_LENGTH, ARTICLE_MIN_CONTENT_LENGTH, TOC_MIN_CONTENT_LENGTH } from "@/lib/constants";
import MarkdownContent from "@/components/MarkdownContent";
import Breadcrumbs from "@/components/Breadcrumbs";
import TableOfContents from "@/components/TableOfContents";
import PageImage from "@/components/PageImage";
import OpenAlexResearch from "@/components/OpenAlexResearch";
import PageToolsSidebar from "@/components/PageToolsSidebar";
import Link from "next/link";
import DevelopersLanding from "@/components/developers/DevelopersLanding";
import ApiDocs from "@/components/developers/ApiDocs";
import McpDocs from "@/components/developers/McpDocs";

const SPECIAL_ROUTES: Record<string, { type: "redirect" | "component"; value: string }> = {
  "search": { type: "redirect", value: "/search" },
  "books": { type: "redirect", value: "/books" },
  "contents": { type: "redirect", value: "/contents" },
  "videos": { type: "redirect", value: "/videos" },
};

const DEVELOPER_ROUTES: Record<string, { component: React.ComponentType; title: string; description: string }> = {
  "developers": {
    component: DevelopersLanding,
    title: "Developers — ESG Hub",
    description: "Access the ESG Hub knowledge base programmatically via REST API or MCP server for AI agents.",
  },
  "developers/api": {
    component: ApiDocs,
    title: "REST API Documentation — ESG Hub",
    description: "Complete REST API reference for the ESG Hub knowledge base.",
  },
  "developers/mcp": {
    component: McpDocs,
    title: "MCP Server — ESG Hub",
    description: "Connect AI assistants to the ESG Hub knowledge base via the Model Context Protocol.",
  },
};

interface PageProps {
  params: Promise<{ locale: string; slug: string[] }>;
}

function buildPermalink(slugParts: string[]): string {
  return `/${slugParts.join("/")}/`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const slugPath = slug.join("/");

  const devRoute = DEVELOPER_ROUTES[slugPath];
  if (devRoute) {
    return { title: devRoute.title, description: devRoute.description };
  }

  const specialRoute = SPECIAL_ROUTES[slugPath];
  if (specialRoute && specialRoute.type === "redirect") {
    return { title: "Redirecting..." };
  }

  const permalink = buildPermalink(slug);
  const page = await getPageByPermalink(permalink, locale);

  if (page === DB_ERROR) {
    return { title: "Service Temporarily Unavailable — ESG Hub" };
  }
  if (!page) {
    return { title: "Page Not Found — ESG Hub" };
  }

  const pageTitle = page.title;
  const pageDescription = page.description || `${page.title} — ESG Hub by Ascent Partners Foundation`;
  const canonicalUrl = `${SITE_URL}/${locale}${formatPermalink(permalink)}`;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: page.keywords || undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${pageTitle} — ESG Hub`,
      description: pageDescription,
      url: canonicalUrl,
      siteName: "ESG Hub",
      type: "article",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary",
      title: `${pageTitle} — ESG Hub`,
      description: pageDescription,
    },
  };
}

export default async function ContentPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "DynamicPage" });
  const tPages = await getTranslations({ locale, namespace: "Pages" });
  const tPillars = await getTranslations({ locale, namespace: "Pillars" });
  const tSectionLabels = await getTranslations({ locale, namespace: "SectionLabels" });
  
  const slugPath = slug.join("/");

  const devRoute = DEVELOPER_ROUTES[slugPath];
  if (devRoute) {
    const Component = devRoute.component;
    return <Component />;
  }

  const specialRoute = SPECIAL_ROUTES[slugPath];
  if (specialRoute) {
    if (specialRoute.type === "redirect") {
      redirect(`/${locale}${specialRoute.value}`);
    }
  }

  const permalink = buildPermalink(slug);
  const page = await getPageByPermalink(permalink, locale);

  if (page === DB_ERROR) {
    return (
      <div className="content-wrapper" id="main-content" style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <h1 style={{ borderBottom: "none", fontSize: "1.8rem" }}>
          {tPages("contentUnavailable")}
        </h1>
        <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", maxWidth: "480px", margin: "1rem auto", lineHeight: 1.6 }}>
          {tPages("technicalDifficulties")}
        </p>
        <Link
          href={`/${locale}/`}
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            background: "var(--color-primary)",
            color: "#fff",
            borderRadius: "4px",
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          {tPages("goHome")}
        </Link>
      </div>
    );
  }

  if (!page) {
    notFound();
  }

  if (page.redirect_to) {
    const redirectTarget = page.redirect_to.startsWith("/") 
      ? `/${locale}${page.redirect_to}`
      : page.redirect_to;
    redirect(redirectTarget);
  }

  const isHubPage =
    page.slug === "index" ||
    page.slug === page.section ||
    slug.length === 1 ||
    page.content.trim().length < HUB_PAGE_MAX_CONTENT_LENGTH;

  let childPages: Awaited<ReturnType<typeof getPagesBySection>> = [];
  if (page.section) {
    childPages = await getPagesBySection(page.section, locale);
    childPages = childPages.filter(
      (p) => p.permalink !== page.permalink && !p.redirect_to
    );
  }

  const headings = extractHeadings(page.content);
  const showToc = headings.length >= 3 && page.content.trim().length > TOC_MIN_CONTENT_LENGTH;

  const showImage = !isHubPage && page.content.trim().length > ARTICLE_MIN_CONTENT_LENGTH;

  return (
    <div id="main-content" className="layout-container">
      <Breadcrumbs permalink={page.permalink} title={page.title} locale={locale} />
      
      <div className="layout-article">
        <article className="content-wrapper">
          {page.connects_to && page.connects_to.length > 1 && (
            <div className="cross-pillar-banner">
              <span className="cross-pillar-label">
                {t("crossPillarArticle")}
              </span>
              {page.connects_to.map((pillar, i) => (
                <span key={pillar}>
                  {i > 0 && " + "}
                  <Link
                    href={pillar === "E" ? `/${locale}/environmental` : pillar === "S" ? `/${locale}/social` : `/${locale}/governance`}
                    className={`cross-pillar-link ${pillar.toLowerCase()}`}
                  >
                    {pillar === "E" && tPillars("environmental")}
                    {pillar === "S" && tPillars("social")}
                    {pillar === "G" && tPillars("governance")}
                  </Link>
                </span>
              ))}
            </div>
          )}

          <h1>{page.title}</h1>

          {page.description && (
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--color-text-secondary)",
                marginBottom: "0.8rem",
                lineHeight: 1.6,
              }}
            >
              {page.description}
            </p>
          )}

          <div className="page-meta">
            {page.section && (
              <span className="page-meta-item">
                <span style={{ fontWeight: 600 }}>{t("section")}</span>{" "}
                <Link
                  href={`/${locale}/${page.section}`}
                  style={{ color: "var(--color-link)", textDecoration: "none" }}
                >
                {(() => {
                  const fallback = page.section.charAt(0).toUpperCase() + page.section.slice(1);
                  try {
                    return tSectionLabels.has(page.section) ? tSectionLabels(page.section) : fallback;
                  } catch {
                    return fallback;
                  }
                })()}
              </Link>
            </span>
          )}
            {page.keywords && (
              <span className="page-meta-item">
                <span style={{ fontWeight: 600 }}>{t("topics")}</span>{" "}
                {page.keywords}
              </span>
            )}
          </div>
        </article>

        {showImage && (
          <PageImage
            section={page.section}
            title={page.title}
            keywords={page.keywords}
          />
        )}

        {/* Inline TOC: visible only on mobile/tablet — on desktop the sidebar TOC takes over */}
        {showToc && (
          <div className="toc-inline-mobile">
            <TableOfContents headings={headings} />
          </div>
        )}

        {page.content && page.content.trim().length > 0 && (
          <MarkdownContent content={page.content} />
        )}

        {!isHubPage && page.content.trim().length > 300 && (
          <OpenAlexResearch title={page.title} keywords={page.keywords} />
        )}

        {childPages.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2>{t("topicsInSection")}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "0.7rem",
                marginTop: "0.8rem",
              }}
            >
              {childPages.map((child) => (
                <Link
                  key={child.permalink}
                  href={`/${locale}${formatPermalink(child.permalink) || "/"}`}
                  className="topic-card"
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "var(--color-link)",
                    }}
                  >
                    {child.title}
                  </div>
                  {child.description && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-muted)",
                        marginTop: "0.2rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {child.description.length > 120
                        ? child.description.substring(0, 120) + "..."
                        : child.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {!isHubPage && childPages.length > 0 && (
          <div className="related-pages">
            <h2>{t("relatedPages")}</h2>
            <ul style={{ paddingLeft: "1.4em", margin: "0.5rem 0" }}>
              {childPages.slice(0, 8).map((child) => (
                <li key={child.permalink} style={{ margin: "0.25rem 0" }}>
                  <Link
                    href={`/${locale}${formatPermalink(child.permalink) || "/"}`}
                    style={{ fontSize: "0.9rem" }}
                  >
                    {child.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <PageToolsSidebar page={page} locale={locale} />
    </div>
  );
}
