"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

export default function Footer() {
  const locale = useLocale();
  const t = useTranslations("Footer");
  
  return (
    <footer 
      className="site-footer" 
      role="contentinfo"
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "1rem 1.5rem",
        marginTop: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: "var(--wide-max-width)",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
        }}
      >
        <div>
          <span style={{ fontWeight: 600 }}>ESG Hub</span> — {t("tagline")}
        </div>
        
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link 
            href={`/${locale}/about`} 
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            {t("about")}
          </Link>
          <Link 
            href={`/${locale}/developers`} 
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            {t("developers")}
          </Link>
          <a
            href="https://github.com/simonmak-ascent/esg-hub"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            {t("github")}
          </a>
          <span>|</span>
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            {t("license")}
          </a>
          <span>|</span>
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
