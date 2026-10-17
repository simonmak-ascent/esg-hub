"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

export default function Footer() {
  const locale = useLocale();
  const t = useTranslations("Footer");

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <span style={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            ESG Hub
          </span>
          <span style={{ opacity: 0.8 }}> — {t("tagline")}</span>
        </div>

        <div className="footer-links">
          <Link href={`/${locale}/about`} className="footer-link">
            {t("about")}
          </Link>
          <Link href={`/${locale}/developers`} className="footer-link">
            {t("developers")}
          </Link>
          <a
            href="https://github.com/simonmak-ascent/esg-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            {t("github")}
          </a>
          <span className="footer-sep" aria-hidden="true">
            |
          </span>
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            {t("license")}
          </a>
          <span className="footer-sep" aria-hidden="true">
            |
          </span>
          <span className="footer-copy">{t("copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
