"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

// Keep English for all locales - ESG terminology is standardized internationally
const QUICK_QUERIES = [
  "IFRS S2 climate disclosures",
  "Scope 3 emissions",
  "GRI Standards",
  "TNFD framework",
  "Hong Kong ESG reporting",
  "Carbon credits",
];

export default function HomeSearchBox() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Search");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/${locale}/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleQuickQuery = (q: string) => {
    router.push(`/${locale}/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} role="search" style={{ maxWidth: "640px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            border: "2px solid var(--apf-color-gold)",
            borderRadius: 0,
            background: "var(--color-bg-elevated)",
            overflow: "hidden",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: "var(--apf-shadow-lg)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--apf-color-brand-green)";
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--apf-shadow-xl)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--apf-color-gold)";
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--apf-shadow-lg)";
          }}
        >
          {/* Search icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: "1rem",
              color: "var(--color-text-muted)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            aria-label="Search ESG Hub"
            style={{
              flex: 1,
              padding: "0.75em 0.7em",
              border: "none",
              background: "transparent",
              fontFamily: "var(--font-body)",
              fontSize: "0.95rem",
              color: "var(--color-text)",
              outline: "none",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "0.6em 1.2em",
              background: "var(--color-primary)",
              color: "var(--apf-color-text-inverse)",
              border: "none",
              borderRadius: 0,
              fontFamily: "var(--font-heading)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {t("searchButton")}
          </button>
        </div>
      </form>

      {/* Quick query chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.4rem",
          marginTop: "0.9rem",
        }}
      >
        {QUICK_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleQuickQuery(q)}
            style={{
              padding: "0.3em 0.65em",
              fontSize: "0.78rem",
              fontFamily: "var(--font-heading)",
              fontWeight: 500,
              color: "var(--apf-color-neutral-white)",
              background: "transparent",
              border: "1px solid color-mix(in srgb, var(--apf-color-neutral-white) 50%, transparent)",
              borderRadius: 0,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
