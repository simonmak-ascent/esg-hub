"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

interface SearchResult {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  description?: string;
  section?: string;
  source_domain?: string;
  relevance?: number;
  distance?: number;
  source_type: "page" | "external";
}

function ResultCard({ result, locale, tExternal, tSimilarity }: { result: SearchResult; locale: string; tExternal: string; tSimilarity: (percent: string) => string }) {
  const isExternal = result.source_type === "external";
  const href = isExternal
    ? result.url || "#"
    : result.permalink ? `/${locale}${result.permalink.replace(/\/$/, "")}` : `/${locale}/`;

  return (
    <a
      href={href}
      className="search-result"
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      style={{ display: "block" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.2rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "1rem",
            color: "var(--color-link)",
          }}
        >
          {result.title}
        </span>
        {isExternal && (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "0.1em 0.45em",
              borderRadius: 0,
              background: "var(--color-bg-secondary)",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}
          >
            {tExternal}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {result.section && (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.78rem",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {result.section}
          </span>
        )}
        {result.source_domain && (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.78rem",
              color: "var(--color-text-muted)",
            }}
          >
            {result.source_domain}
          </span>
        )}
        {result.distance !== undefined && (
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            {tSimilarity(((1 - result.distance) * 100).toFixed(0))}
          </span>
        )}
      </div>

      {result.description && (
        <div
          style={{
            fontSize: "0.88rem",
            color: "var(--color-text-secondary)",
            marginTop: "0.25rem",
            lineHeight: 1.5,
          }}
        >
          {result.description.length > 200
            ? result.description.substring(0, 200) + "..."
            : result.description}
        </div>
      )}
    </a>
  );
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Search");
  const initialQuery = searchParams?.get("q") || "";
  const initialMode = searchParams?.get("mode") === "semantic" ? "semantic" : "keyword";

  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<"keyword" | "semantic">(initialMode);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<string>("");
  const [embeddingReady, setEmbeddingReady] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractorRef = useRef<any>(null);
  const loadingModelRef = useRef(false);

  // Load the embedding model lazily when semantic mode is selected
  const loadModel = useCallback(async () => {
    if (extractorRef.current || loadingModelRef.current) return;
    loadingModelRef.current = true;
    setEmbeddingStatus("Loading AI model (first time may take 10-15s)...");

    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;

      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/bge-small-en-v1.5",
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dtype: "fp32" as any,
          device: "wasm",
        }
      );
      extractorRef.current = extractor;
      setEmbeddingReady(true);
      setEmbeddingStatus("");
    } catch (err) {
      console.error("Failed to load embedding model:", err);
      setEmbeddingStatus("Failed to load AI model. Falling back to keyword search.");
      loadingModelRef.current = false;
    }
  }, []);

  // Pre-load model when semantic mode is selected
  useEffect(() => {
    if (mode === "semantic" && !extractorRef.current && !loadingModelRef.current) {
      loadModel();
    }
  }, [mode, loadModel]);

  const generateEmbedding = async (text: string): Promise<number[]> => {
    // If model isn't loaded yet, wait for it
    if (!extractorRef.current) {
      if (!loadingModelRef.current) {
        await loadModel();
      } else {
        // Model is currently loading, wait for it
        let attempts = 0;
        while (!extractorRef.current && attempts < 60) {
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }
      }
    }
    if (!extractorRef.current) {
      throw new Error("Embedding model not available");
    }

    const truncated = text.slice(0, 2000).replace(/\n/g, " ").replace(/\r/g, "");
    const result = await extractorRef.current(truncated, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(result.data as Float32Array);
  };

  const handleSearch = async (searchQuery: string, searchMode: "keyword" | "semantic") => {
    const q = searchQuery.trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);

    // Update URL
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("mode", searchMode);
    router.replace(`/${locale}/search?${params.toString()}`, { scroll: false });

    try {
      if (searchMode === "semantic") {
        try {
          setEmbeddingStatus(t("generatingEmbedding"));
          const embedding = await generateEmbedding(q);
          setEmbeddingStatus(t("searching"));

          const res = await fetch("/api/semantic-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embedding, k: 20, locale }),
          });
          const data = await res.json();
          setResults(data.results || []);
          setEmbeddingStatus("");
        } catch {
          // Fallback to keyword search
          setEmbeddingStatus(t("aiSearchUnavailable"));
          const res = await fetch(`/api/keyword-search?q=${encodeURIComponent(q)}&locale=${locale}`);
          const data = await res.json();
          setResults(data.results || []);
          setTimeout(() => setEmbeddingStatus(""), 3000);
        }
      } else {
        const res = await fetch(`/api/keyword-search?q=${encodeURIComponent(q)}&locale=${locale}`);
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-search on initial load if query is present
  useEffect(() => {
    if (initialQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSearch(initialQuery, initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query, mode);
  };

  const handleModeChange = (newMode: "keyword" | "semantic") => {
    setMode(newMode);
    if (query.trim()) {
      handleSearch(query, newMode);
    }
  };

  const pageResults = results.filter((r) => r.source_type === "page");
  const externalResults = results.filter((r) => r.source_type === "external");

  return (
    <div className="content-wrapper" id="main-content">
      <h1 style={{ borderBottom: "none", marginBottom: "0.5rem" }}>
        {t("searchButton")}
      </h1>

      <form onSubmit={handleSubmit} role="search" style={{ marginBottom: "1.5rem" }}>
        <label
          htmlFor="search-input"
          style={{
            display: "block",
            fontFamily: "var(--font-heading)",
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginBottom: "0.4rem",
          }}
        >
          {t("searchDescription")}
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("trySearching")}
            aria-label={t("searchButton")}
            style={{
              flex: 1,
              padding: "0.6em 0.8em",
              border: "1px solid var(--color-border)",
              borderRadius: 0,
              fontFamily: "var(--font-heading)",
              fontSize: "1rem",
              color: "var(--color-text)",
              background: "var(--color-bg)",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.6em 1.2em",
              background: "var(--color-primary)",
              color: "var(--apf-color-text-inverse)",
              border: "none",
              borderRadius: 0,
              fontFamily: "var(--font-heading)",
              fontSize: "0.92rem",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t("searching") : t("searchButton")}
          </button>
        </div>

        {/* Search mode toggle */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.82rem",
              color: "var(--color-text-muted)",
              fontWeight: 500,
            }}
          >
            {t("searchMode")}
          </span>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--color-border)",
              borderRadius: 0,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => handleModeChange("keyword")}
              style={{
                padding: "0.3em 0.8em",
                fontFamily: "var(--font-heading)",
                fontSize: "0.82rem",
                fontWeight: mode === "keyword" ? 700 : 400,
                border: "none",
                cursor: "pointer",
                background:
                  mode === "keyword" ? "var(--color-primary)" : "var(--color-bg)",
                color: mode === "keyword" ? "var(--apf-color-text-inverse)" : "var(--color-text-secondary)",
              }}
              aria-pressed={mode === "keyword"}
            >
              {t("keywordSearch")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("semantic")}
              style={{
                padding: "0.3em 0.8em",
                fontFamily: "var(--font-heading)",
                fontSize: "0.82rem",
                fontWeight: mode === "semantic" ? 700 : 400,
                border: "none",
                borderLeft: "1px solid var(--color-border)",
                cursor: "pointer",
                background:
                  mode === "semantic" ? "var(--color-primary)" : "var(--color-bg)",
                color:
                  mode === "semantic" ? "var(--apf-color-text-inverse)" : "var(--color-text-secondary)",
              }}
              aria-pressed={mode === "semantic"}
            >
              {t("semanticSearch")}
            </button>
          </div>
          {mode === "semantic" && (
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}
            >
              {embeddingStatus ||
                (embeddingReady
                  ? t("aiModelReady")
                  : t("semanticDescription"))}
            </span>
          )}
        </div>
      </form>

      {/* Results */}
      {searched && (
        <div aria-live="polite">
          {loading ? (
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.88rem",
                color: "var(--color-text-muted)",
                marginBottom: "1rem",
              }}
            >
              {t("searching")}
            </p>
          ) : (
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.88rem",
                color: "var(--color-text-muted)",
                marginBottom: "1rem",
              }}
            >
              {results.length === 0
                ? t("noResults", { query })
                : t("resultsCount", { count: results.length, query })}
            </p>
          )}

          {/* ESG Hub pages */}
          {pageResults.length > 0 && (
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  borderBottom: "none",
                  marginTop: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                {t("articles", { count: pageResults.length })}
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                {pageResults.map((result) => (
                  <ResultCard key={result.id} result={result} locale={locale} tExternal={t("external")} tSimilarity={(pct) => t("similarity", { percent: pct })} />
                ))}
              </div>
            </div>
          )}

          {/* External resources */}
          {externalResults.length > 0 && (
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  borderBottom: "none",
                  marginTop: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                {t("resources", { count: externalResults.length })}
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.82rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                {t("resourcesDescription")}
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                {externalResults.map((result) => (
                  <ResultCard key={result.id} result={result} locale={locale} tExternal={t("external")} tSimilarity={(pct) => t("similarity", { percent: pct })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem 0",
            color: "var(--color-text-muted)",
          }}
        >
          <p style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>
            {t("searchDescription")}
          </p>
          <p style={{ fontSize: "0.88rem", marginBottom: "1rem" }}>
            {t("trySearching")}
          </p>
          <div
            style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border-light)",
              borderRadius: 0,
              padding: "1.2rem 1.5rem",
              maxWidth: "600px",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "0.95rem",
                fontWeight: 700,
                marginTop: 0,
                marginBottom: "0.5rem",
              }}
            >
              {t("searchModes")}
            </h3>
            <div style={{ fontSize: "0.88rem", lineHeight: 1.65 }}>
              <p style={{ margin: "0.4em 0" }}>
                <strong style={{ fontFamily: "var(--font-heading)" }}>
                  {t("keywordSearch")}:
                </strong>{" "}
                {t("keywordModeDesc")}
              </p>
              <p style={{ margin: "0.4em 0" }}>
                <strong style={{ fontFamily: "var(--font-heading)" }}>
                  {t("semanticSearch")}:
                </strong>{" "}
                {t("semanticModeDesc")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
