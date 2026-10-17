"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
}

export default function AIChatWidget() {
  const t = useTranslations("AIChat");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState<Record<number, boolean>>({});
  const [liveMessage, setLiveMessage] = useState<string>("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: prefersReducedMotion ? "auto" : "smooth" 
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Store previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Small delay to ensure panel is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Restore focus when chat closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      firstFocusableRef.current = focusableElements[0];
      lastFocusableRef.current = focusableElements[focusableElements.length - 1];
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableRef.current) {
          e.preventDefault();
          lastFocusableRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableRef.current) {
          e.preventDefault();
          firstFocusableRef.current?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    panel.addEventListener("keydown", handleTabKey);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      panel.removeEventListener("keydown", handleTabKey);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    
    // Announce to screen readers
    setLiveMessage(t("messageSent"));

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMessage = {
          role: "assistant" as const,
          content: data.message,
          reasoning: data.reasoning,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setLiveMessage(t("assistantResponded") + ": " + data.message.substring(0, 100) + (data.message.length > 100 ? "..." : ""));
      } else {
        const errorMessage = {
          role: "assistant" as const,
          content: data.error || t("errorOccurred"),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setLiveMessage(t("errorGettingResponse"));
      }
    } catch {
      const errorMessage = {
        role: "assistant" as const,
        content: t("networkError"),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLiveMessage(t("networkConnectionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleReasoning = (index: number) => {
    setShowReasoning((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        {liveMessage}
      </div>

      {/* Floating toggle button */}
      <button
        className="ai-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? t("closeChat") : t("openChat")}
        aria-expanded={isOpen}
        aria-controls="ai-chat-panel"
        title={t("askAi")}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div 
          ref={panelRef}
          id="ai-chat-panel"
          className="ai-chat-panel" 
          role="dialog" 
          aria-label={t("title")}
          aria-modal="true"
        >
          {/* Header */}
          <div className="ai-chat-header">
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              ESG Hub AI
            </span>
            <button
              onClick={closeChat}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                padding: "0.2em",
              }}
              aria-label={t("closeChatEscape")}
              title={t("closeChatEscape")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div 
            className="ai-chat-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("chatMessages")}
          >
            {messages.length === 0 && (
              <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0.5rem" }}>
                <div style={{ marginBottom: "0.5rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  {t("askMeAnything")}
                </div>
                <div style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                  {t("chatDescription")}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`ai-msg ai-msg-${msg.role}`}
                role={msg.role === "assistant" ? "article" : undefined}
                aria-label={msg.role === "assistant" ? t("assistantMessage") : t("yourMessage")}
              >
                <div className="ai-msg-bubble">
                  {msg.role === "assistant" ? (
                    <div style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p style={{ margin: "0.3em 0" }}>{children}</p>,
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-link)" }}>
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                          ul: ({ children }) => <ul style={{ paddingLeft: "1.2em", margin: "0.3em 0" }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ paddingLeft: "1.2em", margin: "0.3em 0" }}>{children}</ol>,
                          li: ({ children }) => <li style={{ margin: "0.15em 0" }}>{children}</li>,
                          code: ({ children }) => (
                            <code style={{ background: "var(--color-bg-secondary)", padding: "0.1em 0.3em", borderRadius: 0, fontSize: "0.88em" }}>
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.reasoning && (
                        <div style={{ marginTop: "0.4rem" }}>
                          <button
                            onClick={() => toggleReasoning(i)}
                            aria-expanded={showReasoning[i]}
                            aria-controls={`reasoning-${i}`}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-text-muted)",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-heading)",
                              padding: "0.15em 0",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.2rem",
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{
                                transform: showReasoning[i] ? "rotate(90deg)" : "rotate(0deg)",
                                transition: prefersReducedMotion ? "none" : "transform 0.15s",
                              }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            {showReasoning[i] ? t("hideReasoning") : t("showReasoning")}
                          </button>
                          {showReasoning[i] && (
                            <div
                              id={`reasoning-${i}`}
                              style={{
                                marginTop: "0.3rem",
                                padding: "0.5rem 0.6rem",
                                background: "var(--color-bg)",
                                borderRadius: 0,
                                fontSize: "0.78rem",
                                color: "var(--color-text-muted)",
                                lineHeight: 1.5,
                                maxHeight: "200px",
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {msg.reasoning}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem" }}>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div 
                className="ai-msg ai-msg-assistant"
                role="status"
                aria-live="polite"
              >
                <div className="ai-msg-bubble ai-msg-thinking">
                  <span className="visually-hidden">{t("assistantThinking")}</span>
                  <span aria-hidden="true">{t("thinkingDots")}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="ai-chat-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("messagePlaceholder")}
              disabled={loading}
              maxLength={2000}
              aria-label={t("messageInput")}
              aria-describedby="ai-chat-help"
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              aria-label={loading ? t("sending") : t("sendMessage")}
            >
              {loading ? "..." : t("send")}
            </button>
          </div>
          
          <div 
            id="ai-chat-help" 
            className="visually-hidden"
            style={{
              position: "absolute",
              left: "-10000px",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          >
            {t("typeAndEnter")}
          </div>
        </div>
      )}
    </>
  );
}
