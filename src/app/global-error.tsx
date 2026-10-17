"use client";

import "@/app/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-body)",
            padding: "2rem",
            background: "var(--color-bg)",
            color: "var(--color-text)",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "480px" }}>
            <p
              className="section-label"
              style={{ marginBottom: "0.75rem", color: "var(--color-link)" }}
            >
              ESG Hub
            </p>
            <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem", borderBottom: "none" }}>
              Something went wrong
            </h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest ? (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "1.5rem",
                }}
              >
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              onClick={() => reset()}
              style={{
                padding: "0.75em 1.75em",
                background: "var(--apf-color-brand-forest)",
                color: "var(--apf-color-text-inverse)",
                border: "none",
                borderRadius: 0,
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.85rem",
                minHeight: "44px",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
