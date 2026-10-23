import { defineRouting } from "next-intl/routing";

// Locales mirror the Ascent Partners site: en (default, no prefix), zh (/zh), hk (/hk).
export const routing = defineRouting({
  locales: ["en", "zh", "hk"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
  localeCookie: false,
});
