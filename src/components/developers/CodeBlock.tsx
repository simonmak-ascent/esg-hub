"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "var(--apf-color-status-warning)",
  typescript: "var(--apf-color-brand-green)",
  python: "var(--apf-color-brand-forest)",
  bash: "var(--apf-color-status-success)",
  curl: "var(--apf-color-brand-deep)",
  json: "var(--apf-color-text-secondary)",
  html: "var(--apf-color-status-danger)",
  css: "var(--apf-color-brand-deep)",
  yaml: "var(--apf-color-status-danger)",
  shell: "var(--apf-color-status-success)",
  default: "var(--apf-color-brand-green)",
};

function getLanguageColor(lang: string): string {
  return LANGUAGE_COLORS[lang.toLowerCase()] || LANGUAGE_COLORS.default;
}

interface CodeBlockProps {
  children: string;
  title?: string;
  language?: string;
}

export function CodeBlock({ children, title, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const langColor = getLanguageColor(language);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="code-block">
      <div className="code-block-header">
        <div className="code-block-info">
          {title && <span className="code-block-filename">{title}</span>}
          <span
            className="code-block-language"
            style={{ backgroundColor: `color-mix(in srgb, ${langColor} 18%, transparent)`, color: langColor }}
          >
            {language}
          </span>
        </div>
        <button
          className="code-block-copy"
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy code"}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
      </div>
      <pre className={`code-block-pre language-${language}`}>
        <code className={`language-${language}`}>{children}</code>
      </pre>
    </div>
  );
}

interface TabbedCodeBlockProps {
  tabs: {
    label: string;
    language: string;
    code: string;
  }[];
  title?: string;
}

export function TabbedCodeBlock({ tabs }: TabbedCodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code.trim());
  }, []);

  return (
    <div className="tabbed-code-block">
      <div className="tabbed-code-header">
        <div className="tabbed-code-tabs">
          {tabs.map((tab, index) => (
            <button
              key={index}
              className={`tabbed-code-tab ${index === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          className="tabbed-code-copy"
          onClick={() => handleCopy(tabs[activeTab].code)}
          aria-label="Copy code"
          title="Copy code"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <pre className={`tabbed-code-pre language-${tabs[activeTab].language}`}>
        <code>{tabs[activeTab].code}</code>
      </pre>
    </div>
  );
}

interface SidebarNavItem {
  id: string;
  label: string;
  href?: string;
  children?: SidebarNavItem[];
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  activeId: string;
}

export function SidebarNav({ items, activeId }: SidebarNavProps) {
  return (
    <nav className="docs-sidebar" aria-label="Documentation navigation">
      <ul className="docs-sidebar-list">
        {items.map((item) => (
          <li key={item.id} className="docs-sidebar-item">
            {item.href ? (
              <Link
                href={item.href as string}
                className={`docs-sidebar-link ${activeId === item.id ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ) : (
              <span className="docs-sidebar-label">{item.label}</span>
            )}
            {item.children && (
              <ul className="docs-sidebar-sublist">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={(child.href || "#") as string}
                      className={`docs-sidebar-sublink ${activeId === child.id ? "active" : ""}`}
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface CalloutProps {
  type?: "info" | "warning" | "success" | "error";
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  const icons = {
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    ),
  };

  return (
    <div className={`callout callout-${type}`}>
      <div className="callout-icon">{icons[type]}</div>
      <div className="callout-content">
        {title && <strong className="callout-title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
