"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

const FEATURE_ICONS = [
  // globe
  <svg key="globe" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>,
  // file
  <svg key="file" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>,
  // star
  <svg key="star" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>,
  // search
  <svg key="search" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>,
];

const FEATURE_KEYS: Array<{ title: keyof ReturnType<typeof useTranslations<"Developers">>; desc: keyof ReturnType<typeof useTranslations<"Developers">> }> = [
  { title: "articles" as never, desc: "articlesDesc" as never },
  { title: "resources" as never, desc: "resourcesDesc" as never },
  { title: "sections" as never, desc: "sectionsDesc" as never },
  { title: "dualSearch" as never, desc: "dualSearchDesc" as never },
];

const STAT_KEYS = [
  { label: "esgArticlesLabel" as const, value: "307" },
  { label: "externalResourcesLabel" as const, value: "244" },
  { label: "sectionsLabel" as const, value: "12+" },
  { label: "sourceDomainsLabel" as const, value: "46" },
  { label: "searchModesLabel" as const, value: "2" },
  { label: "apiEndpoints" as const, value: "6" },
];

export default function DevelopersLanding() {
  const locale = useLocale();
  const t = useTranslations("Developers");

  const features = FEATURE_KEYS.map((f, i) => ({
    icon: FEATURE_ICONS[i],
    title: t(f.title as never),
    description: t(f.desc as never),
  }));

  return (
    <>
      <header
        data-hero
        style={{
          position: "relative",
          height: "180px",
          overflow: "hidden",
          background: "var(--apf-color-brand-forest)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/tool-esg-hub.jpg"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--apf-color-brand-forest) 92%, transparent) 0%, color-mix(in srgb, var(--apf-color-brand-forest) 45%, transparent) 45%, transparent 100%)",
          }}
        />
        <h1
          style={{
            position: "absolute",
            insetInline: 0,
            bottom: 0,
            margin: 0,
            paddingBottom: "1rem",
            color: "var(--apf-color-text-inverse)",
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(1.75rem, 5vw, 3.25rem)",
            fontWeight: 900,
            lineHeight: 1.05,
          }}
        >
          <span className="content-wrapper" style={{ display: "block" }}>ESG Hub</span>
        </h1>
        <span
          style={{
            position: "absolute",
            insetInlineEnd: "1.25rem",
            bottom: "1rem",
            color: "rgba(255,255,255,0.9)",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          REST API + MCP
        </span>
      </header>
      <div className="content-wrapper">
        <article>
        <p
          style={{
            fontSize: "1.05rem",
            color: "var(--color-text-secondary)",
            marginBottom: "2rem",
            lineHeight: 1.65,
            maxWidth: "720px",
          }}
        >
          {t("heroDesc")}
        </p>

        {/* Feature Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "1rem",
                background: "var(--color-bg-secondary)",
                borderRadius: 0,
                border: "1px solid var(--color-border)",
              }}
            >
              <div style={{ color: "var(--color-primary)", flexShrink: 0 }}>
                {feature.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Integration Options */}
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>{t("chooseIntegration")}</h2>

        {/* REST API vs MCP Comparison */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2.5rem",
          }}
        >
          {/* REST API Card */}
          <Link
            href={`/${locale}/developers/api`}
            style={{
              display: "block",
              padding: "1.5rem",
              border: "1px solid var(--color-border)",
              borderRadius: 0,
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
            }}
            className="topic-card"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  fontSize: "1.25rem",
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 0,
                  backgroundColor: "var(--color-accent-bg)",
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                }}
                role="img"
                aria-label="API"
              >
                {"{ }"}
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontFamily: "var(--font-heading)" }}>
                  {t("restApi")}
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {t("httpJson")}
                </span>
              </div>
            </div>
            <p style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>
              {t("restCardDesc")}
            </p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {t("restFeatures").split(" | ").map((badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    background: "var(--color-bg-alt)",
                    borderRadius: 0,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </Link>

          {/* MCP Server Card */}
          <Link
            href={`/${locale}/developers/mcp`}
            style={{
              display: "block",
              padding: "1.5rem",
              border: "1px solid var(--color-border)",
              borderRadius: 0,
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
            }}
            className="topic-card"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  fontSize: "1.25rem",
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 0,
                  backgroundColor: "var(--color-accent-bg)",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                }}
                role="img"
                aria-label="MCP"
              >
                AI
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontFamily: "var(--font-heading)" }}>
                  {t("mcpServer")}
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {t("mcpProtocol")}
                </span>
              </div>
            </div>
            <p style={{ fontSize: "0.92rem", color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>
              {t("mcpCardDesc")}
            </p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {t("mcpFeatures").split(" | ").map((badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    background: "var(--color-bg-alt)",
                    borderRadius: 0,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </Link>
        </div>

        {/* When to Use Which */}
        <div
          style={{
            marginBottom: "2.5rem",
            padding: "1.5rem",
            background: "var(--color-bg-secondary)",
            borderRadius: 0,
            border: "1px solid var(--color-border)",
          }}
        >
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", marginTop: 0 }}>
            {t("whichToUse")}
          </h3>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              fontSize: "0.9rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
            }}
          >
            <div>{t("restBestFor")}</div>
            <div>{t("mcpBestFor")}</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>{t("knowledgeBase")}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "1rem",
            }}
          >
            {STAT_KEYS.map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  border: "1px solid var(--color-border)",
                  borderRadius: 0,
                  backgroundColor: "var(--color-surface)",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-heading)",
                    color: "var(--color-accent)",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--color-text-muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  {t(stat.label as never)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
    </>
  );
}
