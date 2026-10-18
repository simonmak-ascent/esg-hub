"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";

/**
 * Route-level error boundary for localized pages.
 *
 * Before this existed, a render error replaced the entire document with
 * `global-error` — losing the header, footer, locale and theme — and the
 * failure was invisible to any log drain. The digest is surfaced so a user
 * report can be matched to a server log line.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Pages");
  const tTools = useTranslations("PageTools");
  const locale = useLocale();

  useEffect(() => {
    console.error("[ui] route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div
      role="alert"
      className="content-wrapper"
      style={{ textAlign: "center", padding: "3rem 1rem" }}
    >
      <h1 style={{ borderBottom: "none", fontSize: "1.8rem" }}>
        {t("somethingWrong")}
      </h1>
      <p
        style={{
          fontSize: "1rem",
          color: "var(--color-text-secondary)",
          maxWidth: "480px",
          margin: "1rem auto",
          lineHeight: 1.6,
        }}
      >
        {t("unexpectedError")}
      </p>

      {error.digest && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
            marginBottom: "1rem",
          }}
        >
          Reference: {error.digest}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={reset}
          style={{
            display: "inline-block",
            padding: "0.6em 1.5em",
            background: "var(--color-primary)",
            color: "var(--apf-color-text-inverse)",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.92rem",
          }}
        >
          {tTools("tryAgain")}
        </button>
        <Link
          href={`/${locale}`}
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
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
