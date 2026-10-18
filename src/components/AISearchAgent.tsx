"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";

/* ── Types ── */
interface Source {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  source_type: "page" | "book_chunk" | "external";
  book_title?: string;
  domain?: string;
  section?: string;
  snippet?: string;
  citation?: number;
}

interface QuickResult {
  id: string;
  title: string;
  permalink?: string;
  url?: string;
  snippet: string;
  source_type: "page" | "book" | "external";
  section?: string;
  domain?: string;
  relevance: number;
}

/* ── Suggested queries ── */
const SUGGESTIONS = [
  "What is IFRS S2 and how does it relate to TCFD?",
  "How do I calculate Scope 3 emissions?",
  "What are the GRI Universal Standards?",
  "Explain the TNFD LEAP framework",
  "What ESG reporting is required in Hong Kong?",
  "How do carbon credits work?",
];

/* ── Source icon by type ── */
function SourceIcon({ type }: { type: string }) {
  if (type === "page") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-section-env)" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  if (type === "book_chunk") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-section-learning)" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-section-social)" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Quick Result Card ── */
function QuickResultCard({ result }: { result: QuickResult }) {
  const isExternal = result.source_type === "external";
  const href = isExternal
    ? result.url || "#"
    : result.permalink?.replace(/\/$/, "") || "/";

  return (
    <a
      href={href}
      className="search-result"
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      style={{ display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
        <SourceIcon type={isExternal ? "external" : "page"} />
        <span style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: "0.92rem",
          color: "var(--color-link)",
        }}>
          {result.title}
        </span>
        {isExternal && (
          <span style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            padding: "0.1em 0.4em",
            borderRadius: 0,
            background: "var(--color-bg-secondary)",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            {result.domain || "External"}
          </span>
        )}
        {result.section && !isExternal && (
          <span style={{
            fontSize: "0.72rem",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}>
            {result.section}
          </span>
        )}
      </div>
      {result.snippet && (
        <div style={{
          fontSize: "0.84rem",
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
          marginLeft: "1.15rem",
        }}>
          {result.snippet.length > 180 ? result.snippet.slice(0, 180) + "..." : result.snippet}
        </div>
      )}
    </a>
  );
}

/* ── Main Component ── */
export default function AISearchAgent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AISearch");
  const tSearch = useTranslations("Search");
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [quickResults, setQuickResults] = useState<QuickResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEvidence, setNoEvidence] = useState(false);
  const [partialAnswer, setPartialAnswer] = useState(false);
  const [activeMode, setActiveMode] = useState<"ai" | "quick">("ai");

  // Embedding state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractorRef = useRef<any>(null);
  const loadingModelRef = useRef(false);
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load embedding model lazily
  const loadModel = useCallback(async () => {
    if (extractorRef.current || loadingModelRef.current) return;
    loadingModelRef.current = true;
    setEmbeddingStatus("Loading AI model...");

    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;

      // Quantised weights: roughly a quarter of the fp32 download. If the
      // repository has no quantised artifact, fall back to the default weights
      // rather than losing semantic search entirely.
      let extractor;
      try {
        extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dtype: "q8" as any,
          device: "wasm",
        });
      } catch {
        console.warn("Quantised embedding model unavailable; using default weights");
        extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
          device: "wasm",
        });
      }
      extractorRef.current = extractor;
      setEmbeddingReady(true);
      setEmbeddingStatus("");
    } catch (err) {
      console.error("Failed to load embedding model:", err);
      setEmbeddingStatus("");
      loadingModelRef.current = false;
    }
  }, []);

  // Deliberately not preloaded: the model used to download 2 s after mount on
  // every /search visit (~133 MB at fp32) even when no search was run. It now
  // loads on the first semantic search; `generateEmbedding` waits for it and the
  // status line explains the delay.

  const generateEmbedding = async (text: string): Promise<number[] | null> => {
    if (!extractorRef.current) {
      if (!loadingModelRef.current) {
        await loadModel();
      } else {
        let attempts = 0;
        while (!extractorRef.current && attempts < 30) {
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }
      }
    }
    if (!extractorRef.current) return null;

    try {
      const truncated = text.slice(0, 2000).replace(/\n/g, " ").replace(/\r/g, "");
      const result = await extractorRef.current(truncated, {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(result.data as Float32Array);
    } catch {
      return null;
    }
  };

  /* ── AI Search (streaming) ── */
  const handleAISearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    // Cancel any ongoing search
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setHasSearched(true);
    setAiAnswer("");
    setSources([]);
    setError(null);
    setActiveMode("ai");

    // Update URL
    router.replace(`/${locale}/search?q=${encodeURIComponent(q)}`, { scroll: false });

    try {
      // Generate embedding in parallel (non-blocking)
      const embeddingPromise = generateEmbedding(q);

      // Start the AI search request
      const embedding = await embeddingPromise;

      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          embedding: embedding || undefined,
          mode: "deep",
          locale,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            if (json.type === "sources") {
              setSources(json.data || []);
            } else if (json.type === "chunk") {
              setAiAnswer((prev) => prev + json.data);
            } else if (json.type === "no_evidence") {
              setNoEvidence(true);
            } else if (json.type === "done") {
              if (json.partial) setPartialAnswer(true);
            } else if (json.type === "error") {
              setError(json.data || "An error occurred");
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[AI Search] Error:", err);
        setError("Failed to get AI answer. Showing quick results instead.");
        // Fallback to quick search
        // eslint-disable-next-line react-hooks/immutability
        handleQuickSearch(q);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-search on initial load if query is present
  useEffect(() => {
    if (initialQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleAISearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Quick Search (instant, no AI) ── */
  const handleQuickSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    setActiveMode("quick");
    setHasSearched(true);

    router.replace(`/${locale}/search?q=${encodeURIComponent(q)}&mode=quick`, { scroll: false });

    try {
      const res = await fetch(`/api/quick-search?q=${encodeURIComponent(q)}&limit=15&locale=${locale}`);
      const data = await res.json();
      setQuickResults(data.results || []);
    } catch {
      setQuickResults([]);
    }
  };

  /* ── Form submit ── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeMode === "quick") {
      handleQuickSearch(query);
    } else {
      handleAISearch(query);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleAISearch(suggestion);
  };

  return (
    <div className="content-wrapper" style={{ maxWidth: "var(--wide-max-width)" }}>
      {/* ── Hero Search Box ── */}
      <div style={{
        textAlign: "center",
        padding: hasSearched ? "1.5rem 0 1rem" : "3rem 0 2rem",
        transition: "padding 0.3s ease",
      }}>
        {!hasSearched && (
          <>
            <h1 style={{
              fontFamily: "var(--font-heading)",
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginTop: 0,
              marginBottom: "0.3rem",
              borderBottom: "none",
              paddingBottom: 0,
            }}>
              {t("title")}
            </h1>
            <p style={{
              fontSize: "1rem",
              color: "var(--color-text-secondary)",
              marginBottom: "1.5rem",
              maxWidth: "600px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}>
              {t("description")}
            </p>
          </>
        )}

        {/* Search form */}
        <form onSubmit={handleSubmit} role="search" style={{
          maxWidth: "720px",
          margin: "0 auto",
        }}>
          <div style={{
            display: "flex",
            border: "2px solid var(--color-border)",
            borderRadius: "28px",
            background: "var(--color-bg-alt)",
            overflow: "hidden",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(58,143,113,0.25)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
            }}
          >
            {/* Search icon */}
            <div style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: "1rem",
              color: "var(--color-text-muted)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tSearch("placeholder")}
              aria-label={tSearch("searchButton")}
              style={{
                flex: 1,
                padding: "0.85em 0.75em",
                border: "none",
                background: "transparent",
                fontFamily: "var(--font-body)",
                fontSize: "1rem",
                color: "var(--color-text)",
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              style={{
                padding: "0.7em 1.4em",
                background: isSearching ? "var(--color-primary-muted)" : "var(--color-primary)",
                color: "var(--apf-color-text-inverse)",
                border: "none",
                borderRadius: "0 26px 26px 0",
                fontFamily: "var(--font-heading)",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: isSearching ? "wait" : "pointer",
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {isSearching ? (
                <>
                  <span className="search-spinner" />
                  {t("thinking")}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  {tSearch("searchButton")}
                </>
              )}
            </button>
          </div>

          {/* Mode toggle */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "0.75rem",
            alignItems: "center",
          }}>
            <button
              type="button"
              onClick={() => {
                setActiveMode("ai");
                if (query.trim() && hasSearched) handleAISearch(query);
              }}
              style={{
                padding: "0.3em 0.8em",
                fontFamily: "var(--font-heading)",
                fontSize: "0.78rem",
                fontWeight: activeMode === "ai" ? 600 : 400,
                border: `1px solid ${activeMode === "ai" ? "var(--color-primary)" : "var(--color-border)"}`,
                borderRadius: 0,
                cursor: "pointer",
                background: activeMode === "ai" ? "rgba(58,143,113,0.15)" : "transparent",
                color: activeMode === "ai" ? "var(--color-primary-hover)" : "var(--color-text-muted)",
                transition: "all 0.15s",
              }}
            >
              <span style={{ marginRight: "0.3em" }}>⚡</span> {t("aiAnswer")}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("quick");
                if (query.trim()) handleQuickSearch(query);
              }}
              style={{
                padding: "0.3em 0.8em",
                fontFamily: "var(--font-heading)",
                fontSize: "0.78rem",
                fontWeight: activeMode === "quick" ? 600 : 400,
                border: `1px solid ${activeMode === "quick" ? "var(--color-primary)" : "var(--color-border)"}`,
                borderRadius: 0,
                cursor: "pointer",
                background: activeMode === "quick" ? "rgba(58,143,113,0.15)" : "transparent",
                color: activeMode === "quick" ? "var(--color-primary-hover)" : "var(--color-text-muted)",
                transition: "all 0.15s",
              }}
            >
              <span style={{ marginRight: "0.3em" }}>🔍</span> {t("quickSearch")}
            </button>
            {embeddingReady && (
              <span style={{
                fontSize: "0.7rem",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}>
                {t("vectorSearchActive")}
              </span>
            )}
            {embeddingStatus && (
              <span style={{
                fontSize: "0.7rem",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}>
                {embeddingStatus}
              </span>
            )}
          </div>
        </form>

        {/* Suggestions (only when no search has been made) */}
        {!hasSearched && (
          <div style={{
            marginTop: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.5rem",
            maxWidth: "700px",
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  padding: "0.4em 0.8em",
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 500,
                  color: "var(--color-link)",
                  background: "var(--color-bg-alt)",
                  border: "1px solid var(--color-border-light)",
                  borderRadius: 0,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseOver={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--color-primary)";
                  (e.target as HTMLElement).style.background = "var(--color-bg-secondary)";
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--color-border-light)";
                  (e.target as HTMLElement).style.background = "var(--color-bg-alt)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Answer Section ── */}
      {hasSearched && activeMode === "ai" && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {/* AI Answer Card */}
          {(aiAnswer || isSearching) && (
            <div style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border-light)",
              borderRadius: 0,
              padding: "1.5rem",
              marginBottom: "1.5rem",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid var(--color-border-light)",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--color-text)",
                }}>
                  {t("aiAnswer")}
                </span>
                {isSearching && (
                  <span style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    fontStyle: "italic",
                    marginLeft: "auto",
                  }}>
                    {aiAnswer ? t("generating") : t("searchingKnowledgeBase")}
                  </span>
                )}
                {!isSearching && aiAnswer && (
                  <span style={{
                    fontSize: "0.72rem",
                    color: "var(--color-text-muted)",
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t("poweredBy")}
                  </span>
                )}
              </div>

              {/* Streaming answer */}
              <div
                className="prose"
                aria-live="polite"
                aria-busy={isSearching}
                style={{
                  fontSize: "0.92rem",
                  lineHeight: 1.7,
                  color: "var(--color-text)",
                }}
              >
                {aiAnswer ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p style={{ margin: "0.5em 0" }}>{children}</p>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-link)" }}>
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => <strong style={{ fontWeight: 600, color: "var(--color-text)" }}>{children}</strong>,
                      h3: ({ children }) => <h3 style={{ fontSize: "1rem", marginTop: "1em", marginBottom: "0.3em", borderBottom: "none" }}>{children}</h3>,
                      h4: ({ children }) => <h4 style={{ fontSize: "0.95rem", marginTop: "0.8em", marginBottom: "0.2em" }}>{children}</h4>,
                      ul: ({ children }) => <ul style={{ paddingLeft: "1.4em", margin: "0.4em 0" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: "1.4em", margin: "0.4em 0" }}>{children}</ol>,
                      li: ({ children }) => <li style={{ margin: "0.2em 0" }}>{children}</li>,
                      code: ({ children }) => (
                        <code style={{ background: "var(--color-bg-secondary)", padding: "0.1em 0.3em", borderRadius: 0, fontSize: "0.88em" }}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {aiAnswer}
                  </ReactMarkdown>
                ) : isSearching ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--color-text-muted)",
                    padding: "1rem 0",
                  }}>
                    <span className="search-spinner" />
                    <span>{t("searchingAcross")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 0,
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.88rem",
              color: "var(--color-transgressed)",
            }}>
              {error}
            </div>
          )}

          {/* No knowledge-base evidence */}
          {noEvidence && !isSearching && (
            <div
              role="status"
              style={{
                background: "var(--color-bg-alt)",
                border: "1px solid var(--color-border-light)",
                borderRadius: 0,
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.88rem",
                color: "var(--color-text-secondary)",
              }}
            >
              {t("noEvidence")}
            </div>
          )}

          {/* Interrupted answer */}
          {partialAnswer && !isSearching && (
            <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
              {t("partialAnswer")}
            </p>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--color-text)",
                borderBottom: "none",
                marginTop: "0.5rem",
                marginBottom: "0.75rem",
              }}>
                {t("sources", { count: sources.length })}
                {sources.some(s => s.id?.startsWith?.('brave:')) && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                    {t("inclWebResults")}
                  </span>
                )}
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "0.6rem",
              }}>
                {sources.map((source) => {
                  const href = source.source_type === "page"
                    ? source.permalink?.replace(/\/$/, "") || "/"
                    : source.source_type === "external"
                    ? source.url || "#"
                    : null;
                  const isExternal = source.source_type === "external";

                  const content = (
                    <div style={{
                      background: "var(--color-bg-alt)",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: 0,
                      padding: "0.7rem 0.9rem",
                      transition: "border-color 0.15s",
                      cursor: href ? "pointer" : "default",
                      height: "100%",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
                        <SourceIcon type={source.source_type} />
                        {typeof source.citation === "number" && (
                          <span style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--color-text-muted)",
                          }}>
                            [{source.citation}]
                          </span>
                        )}
                        <span style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: "0.84rem",
                          color: href ? "var(--color-link)" : "var(--color-text)",
                          lineHeight: 1.3,
                        }}>
                          {source.title}
                        </span>
                      </div>
                      <div style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}>
                        {source.source_type === "page" && source.section && (
                          <span>{source.section}</span>
                        )}
                        {source.source_type === "book_chunk" && source.book_title && (
                          <span>📖 {source.book_title}</span>
                        )}
                        {source.source_type === "external" && source.domain && (
                          <span style={{
                            ...(source.id?.startsWith?.('brave:') ? {
                              background: 'rgba(66,133,244,0.12)',
                              padding: '0.05em 0.35em',
                              borderRadius: '3px',
                              color: 'var(--color-link)',
                            } : {})
                          }}>
                            {source.id?.startsWith?.('brave:') ? '🌐 ' : ''}{source.domain}
                          </span>
                        )}
                      </div>
                      {source.snippet && (
                        <div style={{
                          fontSize: "0.78rem",
                          color: "var(--color-text-secondary)",
                          marginTop: "0.25rem",
                          lineHeight: 1.45,
                        }}>
                          {source.snippet}
                        </div>
                      )}
                    </div>
                  );

                  if (href) {
                    return (
                      <a
                        key={source.id}
                        href={href}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        {content}
                      </a>
                    );
                  }
                  return <div key={source.id}>{content}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Search Results ── */}
      {hasSearched && activeMode === "quick" && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.88rem",
            color: "var(--color-text-muted)",
            marginBottom: "1rem",
          }}>
            {quickResults.length === 0
              ? t("noResultsFor", { query })
              : t("resultsFor", { count: quickResults.length, query })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {quickResults.map((result) => (
              <QuickResultCard key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state info ── */}
      {!hasSearched && (
        <div style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "0 1rem",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}>
            <div style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border-light)",
              borderRadius: 0,
              padding: "1rem 1.2rem",
            }}>
              <div style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "var(--color-primary-hover)",
                marginBottom: "0.3rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {t("aiPowered")}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {t("aiPoweredDesc")}
              </div>
            </div>

            <div style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border-light)",
              borderRadius: 0,
              padding: "1rem 1.2rem",
            }}>
              <div style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "var(--color-section-learning)",
                marginBottom: "0.3rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                {t("multiModalRag")}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {t("multiModalRagDesc")}
              </div>
            </div>

            <div style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border-light)",
              borderRadius: 0,
              padding: "1rem 1.2rem",
            }}>
              <div style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "var(--color-section-social)",
                marginBottom: "0.3rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                {t("esgBooks")}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {t("booksDesc")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spinner CSS */}
      <style jsx global>{`
        .search-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: var(--apf-color-text-inverse);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
