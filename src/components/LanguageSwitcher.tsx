"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "hk", label: "繁體", flag: "🇭🇰" },
];
const LOCALE_CODES = ["en", "zh", "hk"];

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale = LOCALE_CODES.includes(pathname?.split("/")[1] || "") ? (pathname?.split("/")[1] as string) : "en";
  const currentLang = languages.find((l) => l.code === currentLocale) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (locale: string) => {
    // Locale-prefixed routing is "as-needed": en has no prefix, zh/hk do.
    const segments = (pathname || "/").split("/").filter(Boolean);
    const rest = LOCALE_CODES.includes(segments[0]) ? segments.slice(1) : segments;
    const newPath = locale === "en" ? `/${rest.join("/")}` : `/${locale}${rest.length ? "/" + rest.join("/") : ""}`;
    router.push(newPath || "/");
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.4em 0.7em",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.85rem",
          color: "var(--color-text)",
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.label}</span>
        <span style={{ fontSize: "0.7rem" }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.25rem",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            minWidth: "120px",
            overflow: "hidden",
          }}
          role="menu"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.6em 0.9em",
                background: lang.code === currentLocale ? "var(--color-bg-alt)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                color: "var(--color-text)",
                textAlign: "left",
              }}
              role="menuitem"
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
