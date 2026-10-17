"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Page } from "@/lib/pages";
import { extractHeadings } from "@/lib/markdown";
import { PILLAR_STYLES, MAX_RELATED_PAGES } from "@/lib/constants";

interface PageToolsSidebarProps {
  page: Page;
  locale?: string;
}

interface RelatedPage {
  id: string;
  title: string;
  permalink: string;
  section: string;
}

interface BacklinkPage {
  id: string;
  title: string;
  permalink: string;
}

export default function PageToolsSidebar({ page, locale = "en" }: PageToolsSidebarProps) {
  const t = useTranslations("PageTools");
  const [relatedPages, setRelatedPages] = useState<RelatedPage[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState<string>("");

  // The related/backlinks routes resolve permalinks, record IDs and slugs.
  // A permalink survives record re-creation; the record ID does not.
  const pageIdentifier = page.permalink || page.id;

  const fetchCrossReferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLiveStatus(t("loadingRelated"));

    try {
      // Fetch related pages (automatic, max 15)
      const relatedRes = await fetch(
        `/api/v1/pages/${encodeURIComponent(pageIdentifier)}/related?limit=${MAX_RELATED_PAGES}`
      );

      let relatedData: RelatedPage[] = [];
      if (relatedRes.ok) {
        const data = await relatedRes.json();
        relatedData = data.data || [];
        setRelatedPages(relatedData);
      } else {
        throw new Error(`Related request failed: ${relatedRes.status}`);
      }

      // Fetch backlinks (show all)
      const backlinksRes = await fetch(
        `/api/v1/pages/${encodeURIComponent(pageIdentifier)}/backlinks`
      );

      let backlinksData: BacklinkPage[] = [];
      if (backlinksRes.ok) {
        const data = await backlinksRes.json();
        backlinksData = data.data || [];
        setBacklinks(backlinksData);
      } else {
        throw new Error(`Backlinks request failed: ${backlinksRes.status}`);
      }

      // Announce completion to screen readers
      const relatedCount = relatedData.length;
      const backlinkCount = backlinksData.length;
      setLiveStatus(
        t("contentLoaded", { topics: relatedCount, pages: backlinkCount })
      );
    } catch (err) {
      console.error("Error fetching cross-references:", err);
      const errorMessage = t("failedToLoad");
      setError(errorMessage);
      setLiveStatus(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [pageIdentifier, t]);

  useEffect(() => {
    if (pageIdentifier) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCrossReferences();
    }
  }, [pageIdentifier, fetchCrossReferences]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchCrossReferences();
  };

  const headings = extractHeadings(page.content);
  const standards = page.standards || [];
  const connectsTo = page.connects_to || [];

  return (
    <aside
      className="page-tools-sidebar"
      style={{
        borderLeft: "1px solid var(--color-border)",
        paddingLeft: "1.5rem",
        fontSize: "0.9rem",
      }}
      aria-label="Page tools and related content"
    >
      {/* Live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        {liveStatus}
      </div>

      {/* Contents Navigation */}
      {headings.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text)",
              marginBottom: "0.75rem",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "0.25rem",
            }}
          >
            {t("contents")}
          </h3>
          <nav aria-label="Page contents">
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {headings.map((heading) => (
                <li
                  key={heading.id}
                  style={{
                    marginLeft: heading.level === 3 ? "1rem" : 0,
                    marginBottom: "0.35rem",
                  }}
                >
                  <a
                    href={`#${heading.id}`}
                    style={{
                      color: "var(--color-link)",
                      textDecoration: "none",
                      fontSize: heading.level === 2 ? "0.9rem" : "0.85rem",
                      display: "block",
                    }}
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}

      {/* Cross-Pillar Connections - EXPLICITLY HIGHLIGHTED */}
      {connectsTo.length > 1 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text)",
              marginBottom: "0.75rem",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "0.25rem",
            }}
          >
            {t("crossPillarConnections")}
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            {connectsTo.map((pillar: string) => {
              const style = PILLAR_STYLES[pillar as keyof typeof PILLAR_STYLES];
              return (
                <Link
                  key={pillar}
                  href={style ? `/${locale}${style.href}` : `/${locale}/`}
                  className={`pillar-badge ${pillar.toLowerCase()}`}
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    background: style?.bg || "var(--color-bg-alt)",
                    color: style?.color || "var(--color-text)",
                  }}
                >
                  {style?.label || pillar}
                </Link>
              );
            })}
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            {t("crossPillarDesc")}
          </p>
        </section>
      )}

      {/* Applicable Standards - EVERY ARTICLE */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text)",
            marginBottom: "0.75rem",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "0.25rem",
          }}
        >
          {t("applicableStandards")}
        </h3>
        {standards.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {standards.map((standard: string) => (
              <li
                key={standard}
                style={{
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--color-border-light)",
                  fontSize: "0.85rem",
                }}
              >
                <Link
                  href={`/${locale}/standards/${standard.toLowerCase().replace(/[^\w]/g, "-")}`}
                  style={{
                    color: "var(--color-link)",
                    textDecoration: "none",
                  }}
                >
                  {standard}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            {t("noStandards")}
          </p>
        )}
      </section>

      {/* Related Topics - AUTOMATIC (Max 15) */}
      <section 
        style={{ marginBottom: "1.5rem" }}
        aria-busy={loading}
        aria-live="polite"
      >
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text)",
            marginBottom: "0.75rem",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "0.25rem",
          }}
        >
          {t("relatedTopics")}
          {!loading && relatedPages.length > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 400,
                color: "var(--color-text-muted)",
                marginLeft: "0.5rem",
              }}
            >
              {t("relatedCount", { count: relatedPages.length })}
            </span>
          )}
        </h3>
        
        {error ? (
          <div role="alert" aria-live="assertive">
            <p style={{ fontSize: "0.85rem", color: "var(--color-error)", marginBottom: "0.75rem" }}>
              {error}
            </p>
            <button
              onClick={handleRetry}
              disabled={loading}
              style={{
                fontSize: "0.85rem",
                padding: "0.4rem 0.75rem",
                background: "var(--color-primary)",
                color: "var(--apf-color-text-inverse)",
                border: "none",
                borderRadius: 0,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
              aria-label={t("retryLoading")}
            >
              {loading ? t("retrying") : retryCount > 0 ? t("tryAgainCount", { count: retryCount + 1 }) : t("tryAgain")}
            </button>
          </div>
        ) : loading ? (
          <div role="status" aria-label={t("loadingTopics")}>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              {t("loadingTopics")}
            </p>
          </div>
        ) : relatedPages.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {relatedPages.slice(0, MAX_RELATED_PAGES).map((related) => (
              <li
                key={related.id}
                style={{
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--color-border-light)",
                }}
              >
                <Link
                  href={`/${locale}${related.permalink}`}
                  style={{
                    color: "var(--color-link)",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    display: "block",
                  }}
                >
                  {related.title}
                </Link>
                {related.section && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      display: "block",
                      marginTop: "0.15rem",
                    }}
                  >
                    {related.section}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            {t("noRelatedTopics")}
          </p>
        )}
      </section>

      {/* Backlinks - SHOW ALL */}
      {backlinks.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text)",
              marginBottom: "0.75rem",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "0.25rem",
            }}
          >
            {t("whatLinksHere")}
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 400,
                color: "var(--color-text-muted)",
                marginLeft: "0.5rem",
              }}
            >
              ({backlinks.length})
            </span>
          </h3>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {backlinks.map((link) => (
              <li
                key={link.id}
                style={{
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--color-border-light)",
                }}
              >
                <Link
                  href={`/${locale}${link.permalink}`}
                  style={{
                    color: "var(--color-link)",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                  }}
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Page Actions */}
      <section>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text)",
            marginBottom: "0.75rem",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "0.25rem",
          }}
        >
          {t("pageTools")}
        </h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          <li style={{ marginBottom: "0.5rem" }}>
            <a
              href={`/api/v1/pages/${page.id}/pdf`}
              style={{
                color: "var(--color-link)",
                textDecoration: "none",
                fontSize: "0.85rem",
              }}
            >
              {t("downloadPdf")}
            </a>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <a
              href={`/api/v1/pages/${page.id}/cite`}
              style={{
                color: "var(--color-link)",
                textDecoration: "none",
                fontSize: "0.85rem",
              }}
            >
              {t("citeThisPage")}
            </a>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link
              href={`/${locale}/search?q=${encodeURIComponent(page.title)}`}
              style={{
                color: "var(--color-link)",
                textDecoration: "none",
                fontSize: "0.85rem",
              }}
            >
              {t("findSimilar")}
            </Link>
          </li>
          <li>
            <Link
              href={`/${locale}/developers/api`}
              style={{
                color: "var(--color-link)",
                textDecoration: "none",
                fontSize: "0.85rem",
              }}
            >
              {t("apiAccess")}
            </Link>
          </li>
        </ul>
      </section>
    </aside>
  );
}
