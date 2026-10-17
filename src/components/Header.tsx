"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { CONTENTS_MENU, QUICK_LINKS } from "@/data/sections";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

const CATEGORY_KEYS: Record<string, string> = {
  pillars: "esgPillars",
  standards: "standardsRegulations",
  finance: "financeInvestment",
  topics: "sustainabilityTopics",
  professional: "professionalDevelopment",
  resources: "resources",
};

const LINK_KEYS: Record<string, string> = {
  "/environmental": "environmental",
  "/social": "social",
  "/governance": "governance",
  "/standards": "standardsFrameworks",
  "/hk-apac": "regionalRegulations",
  "/ratings": "esgRatings",
  "/finance": "climateFinance",
  "/climate-finance": "climateFinance",
  "/biodiversity": "biodiversityNature",
  "/emerging-topics": "emergingTopics",
  "/sdg": "unSdgs",
  "/learning": "learningHub",
  "/practice": "practiceImplementation",
  "/learning/esg-fundamentals": "esgFundamentals",
  "/glossary": "glossary",
  "/books": "books",
  "/videos": "videos",
  "/developers": "developers",
  "/contents": "contents",
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const pathname = usePathname() || "/";
  const locale = useLocale();
  const t = useTranslations("Navigation");

  const translateKey = (key: string, fallback: string): string => {
    try {
      return t(key);
    } catch {
      return fallback;
    }
  };
  
  // Refs for focus management
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const contentsMenuRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const contentsToggleRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Get current page URL for display
  const getCurrentUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return `https://esg.video${pathname}`;
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getCurrentUrl());
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  // Close both menus
  const closeAllMenus = useCallback(() => {
    setMenuOpen(false);
    setContentsOpen(false);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) {
          e.preventDefault();
          setMenuOpen(false);
          mobileToggleRef.current?.focus();
        } else if (contentsOpen) {
          e.preventDefault();
          setContentsOpen(false);
          contentsToggleRef.current?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen, contentsOpen]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (!menuOpen || !mobileMenuRef.current) return;

    const menu = mobileMenuRef.current;
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    menu.addEventListener("keydown", handleTabKey);
    
    // Focus first element when menu opens
    const timer = setTimeout(() => {
      firstElement?.focus();
    }, 50);

    return () => {
      menu.removeEventListener("keydown", handleTabKey);
      clearTimeout(timer);
    };
  }, [menuOpen]);

  // Store previous focus when opening menus
  useEffect(() => {
    if (menuOpen || contentsOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [menuOpen, contentsOpen]);

  return (
    <header role="banner">
      <a href="#main-content" className="skip-link">
        {t("skipToMain")}
      </a>

      {/* Primary navigation bar */}
      <nav className="primary-nav" aria-label="Main navigation">
        <div className="nav-container">
          {/* Logo + site name */}
          <Link
            href="/"
            className="logo-link"
            aria-label="ESG Hub — Home"
          >
            <Image
              src="/esg-hub-logo.png"
              alt=""
              width={200}
              height={48}
              className="logo-image"
              aria-hidden="true"
            />
            <span className="logo-text">
              ESG Hub
            </span>
          </Link>

          {/* Contents Dropdown */}
          <div className="contents-dropdown-container">
            <button
              ref={contentsToggleRef}
              type="button"
              onClick={() => {
                setContentsOpen(!contentsOpen);
                setMenuOpen(false);
              }}
              aria-expanded={contentsOpen}
              aria-controls="contents-menu"
              aria-haspopup="true"
              className="nav-button contents-button"
            >
              {t("contents")}
              <span className="dropdown-arrow" aria-hidden="true">
                {contentsOpen ? "▲" : "▼"}
              </span>
            </button>

            {contentsOpen && (
              <div
                ref={contentsMenuRef}
                id="contents-menu"
                className="contents-dropdown"
                role="menu"
                aria-label="Site contents"
              >
                {/* Current Page URL Display */}
                <div className="url-display">
                  <div className="url-label">{t("currentPageUrl")}</div>
                  <div className="url-value">
                    {getCurrentUrl()}
                  </div>
                  <button 
                    onClick={copyUrlToClipboard}
                    className="url-copy-button"
                    aria-label={t("copyUrlToClipboard")}
                  >
                    {copiedUrl ? t("copyUrlCopied") : t("copyUrl")}
                  </button>
                </div>

                <div className="contents-grid">
                  {Object.entries(CONTENTS_MENU).map(([key, category]) => (
                    <div key={key} role="group" aria-label={category.title}>
                      <h3 className="category-heading">
                        {translateKey(CATEGORY_KEYS[key], category.title)}
                      </h3>
                      <ul className="category-list" role="menu">
                        {category.links.map((link) => (
                          <li key={link.href} className="category-item" role="none">
                            <Link
                              href={`/${locale}${link.href}`}
                              onClick={() => setContentsOpen(false)}
                              role="menuitem"
                              className={`category-link ${isActive(link.href) ? 'active' : ''}`}
                            >
                              {LINK_KEYS[link.href] ? translateKey(LINK_KEYS[link.href], link.label) : link.label}
                            </Link>
                            {link.description && (
                              <span className="category-description">
                                {link.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                
                <div className="quick-links-footer">
                  {QUICK_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={`/${locale}${link.href}`}
                      onClick={() => setContentsOpen(false)}
                      className="quick-link"
                    >
                      {LINK_KEYS[link.href] ? translateKey(LINK_KEYS[link.href], link.label) : link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links - Desktop */}
          <div className="quick-links">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link
              href={`/${locale}/developers`}
              className={`quick-link-nav ${isActive("/developers") ? 'active' : ''}`}
            >
              {t("developers")}
            </Link>
            <Link
              href={`/${locale}/glossary`}
              className={`quick-link-nav ${isActive("/glossary") ? 'active' : ''}`}
            >
              {t("glossary")}
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            ref={mobileToggleRef}
            type="button"
            className="mobile-menu-toggle"
            onClick={() => {
              setMenuOpen(!menuOpen);
              setContentsOpen(false);
            }}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-haspopup="true"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
          >
            {menuOpen ? t("closeMenu") : t("menu")}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          className="mobile-menu"
          role="dialog"
          aria-label="Mobile navigation"
          aria-modal="true"
        >
          {/* Current Page URL Display - Mobile */}
          <div className="url-display-mobile">
            <div className="url-label">{t("currentPageUrl")}</div>
            <div className="url-value">
              {getCurrentUrl()}
            </div>
            <button 
              onClick={copyUrlToClipboard}
              className="url-copy-button"
              aria-label={t("copyUrlToClipboard")}
            >
              {copiedUrl ? t("copyUrlCopied") : t("copyUrl")}
            </button>
          </div>

          {Object.entries(CONTENTS_MENU).map(([key, category]) => (
            <div key={key} className="mobile-category">
              <div className="mobile-category-heading">
                {translateKey(CATEGORY_KEYS[key], category.title)}
              </div>
              {category.links.map((link) => (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  onClick={() => setMenuOpen(false)}
                  className="mobile-link"
                >
                  {LINK_KEYS[link.href] ? translateKey(LINK_KEYS[link.href], link.label) : link.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="mobile-quick-links">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                onClick={() => setMenuOpen(false)}
                className="mobile-quick-link"
              >
                {LINK_KEYS[link.href] ? translateKey(LINK_KEYS[link.href], link.label) : link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(contentsOpen || menuOpen) && (
        <div
          className="overlay"
          onClick={closeAllMenus}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
