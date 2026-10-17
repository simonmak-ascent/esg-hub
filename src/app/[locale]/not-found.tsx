"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const locale = useLocale();
  const t = useTranslations("Pages");
  
  return (
    <div
      className="content-wrapper"
      id="main-content"
      style={{
        textAlign: "center",
        padding: "3rem 1rem",
      }}
    >
      <h1 style={{ borderBottom: "none", fontSize: "2rem" }}>
        {t("notFound")}
      </h1>
      <p
        style={{
          fontSize: "1.05rem",
          color: "var(--color-text-secondary)",
          maxWidth: "480px",
          margin: "0.5rem auto 1.5rem",
          lineHeight: 1.6,
        }}
      >
        {t("notFoundDesc")}
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href={`/${locale}/`}
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            background: "var(--color-primary)",
            color: "var(--apf-color-text-inverse)",
            borderRadius: 0,
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          {t("goHome")}
        </Link>
        <Link
          href={`/${locale}/search`}
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            border: "1px solid var(--color-primary)",
            color: "var(--color-primary)",
            borderRadius: 0,
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          {t("searchEsg")}
        </Link>
      </div>
    </div>
  );
}
