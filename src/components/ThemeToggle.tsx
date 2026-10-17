"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "apf-theme";
const LEGACY_KEY = "apg-theme";
const EVENT = "apf-theme-change";

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const readTheme = (): "dark" | "light" =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
const serverTheme = (): "dark" | "light" => "light";

/** Dark/light switch — APF tokens (data-theme + localStorage["apf-theme"]). */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
      localStorage.removeItem(LEGACY_KEY);
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
        background: "transparent",
        border: "1px solid var(--header-line)",
        borderRadius: 0,
        cursor: "pointer",
        color: "var(--header-ink)",
        fontSize: "1rem",
      }}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
