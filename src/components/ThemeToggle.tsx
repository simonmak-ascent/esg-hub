"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "apg-theme";
const EVENT = "apg-theme-change";

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const readTheme = (): "dark" | "light" =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
const serverTheme = (): "dark" | "light" => "dark";

/** Dark/light switch — APG parity (data-theme + localStorage["apg-theme"]). */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.75rem",
        height: "2.75rem",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        cursor: "pointer",
        color: "var(--color-text)",
        fontSize: "0.95rem",
      }}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
