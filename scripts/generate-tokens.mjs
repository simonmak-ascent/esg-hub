#!/usr/bin/env node
/**
 * Generate the `--apf-*` custom-property layer from the vendored APF tokens.
 *
 * Sources: src/styles/tokens/tokens.v2.json (light)
 *          src/styles/tokens/tokens-dark.json (dark)
 * Output:  src/styles/tokens.generated.css (checked in; CI diffs it)
 *
 * Mirrors apf-website/client/src/lib/css-vars.ts, plus primitive scales
 * (font size / line height / space / radius / shadow / motion / breakpoint)
 * so app CSS can stay token-driven without importing JSON at runtime.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = join(ROOT, "src", "styles", "tokens");
const OUT = join(ROOT, "src", "styles", "tokens.generated.css");

const lightRoot = JSON.parse(readFileSync(join(TOKENS, "tokens.v2.json"), "utf8"));
const darkRoot = JSON.parse(readFileSync(join(TOKENS, "tokens-dark.json"), "utf8"));

/** Resolve a `{a.b.c}` reference against a token tree, recursively. */
function ref(value, root, fallback) {
  let out = value;
  for (let i = 0; i < 12 && typeof out === "string" && /\{[a-z0-9.]+\}/i.test(out); i += 1) {
    out = out.replace(/\{([a-z0-9.]+)\}/gi, (_, path) => {
      for (const tree of [root, fallback]) {
        if (!tree) continue;
        let node = tree;
        for (const key of path.split(".")) {
          node = node && typeof node === "object" ? node[key] : undefined;
        }
        if (typeof node === "string" || typeof node === "number") return String(node);
      }
      return "";
    });
  }
  return out;
}

const r = (v) => ref(v, lightRoot);
const rd = (v) => ref(v, darkRoot, lightRoot);

function project(resolve) {
  const p = (path) => resolve(`{${path}}`);
  return {
    brand: {
      forest: p("primitive.color.brand.forest"),
      green: p("primitive.color.brand.green"),
      sprout: p("primitive.color.brand.sprout"),
      deep: p("primitive.color.brand.deep"),
      pine: p("primitive.color.brand.pine"),
    },
    gold: p("primitive.color.shared.gold"),
    goldInk: p("primitive.color.shared.goldInk"),
    goldOnBrand: p("primitive.color.shared.goldOnBrand"),
    onGold: p("primitive.color.shared.onGold"),
    ink: p("primitive.color.shared.ink"),
    text: {
      primary: p("semantic.color.text.primary"),
      secondary: p("semantic.color.text.secondary"),
      tertiary: p("semantic.color.text.tertiary"),
      muted: p("semantic.color.text.muted"),
      inverse: p("semantic.color.text.inverse"),
      heading: p("semantic.color.text.heading"),
      link: p("semantic.color.text.link"),
      linkHover: p("semantic.color.text.linkHover"),
      accent: p("semantic.color.text.accent"),
    },
    surface: {
      page: p("semantic.color.surface.page"),
      raised: p("semantic.color.surface.raised"),
      inset: p("semantic.color.surface.inset"),
      footer: p("semantic.color.surface.footerBand"),
      hero: p("semantic.color.surface.heroBand"),
    },
    border: {
      subtle: p("semantic.color.border.subtle"),
      focus: p("semantic.color.border.focus"),
    },
    brandDark: p("semantic.color.brand.dark"),
    status: {
      success: p("semantic.color.status.success"),
      warning: p("semantic.color.status.warning"),
      danger: p("semantic.color.status.danger"),
      info: p("semantic.color.status.info"),
      successBg: p("primitive.color.status.successBg"),
      warningBg: p("primitive.color.status.warningBg"),
      dangerBg: p("primitive.color.status.dangerBg"),
      infoBg: p("primitive.color.status.infoBg"),
    },
  };
}

function colorVars(c) {
  return {
    "--apf-color-brand-forest": c.brand.forest,
    "--apf-color-brand-green": c.brand.green,
    "--apf-color-brand-sprout": c.brand.sprout,
    "--apf-color-brand-deep": c.brand.deep,
    "--apf-color-brand-pine": c.brand.pine,
    "--apf-color-gold": c.gold,
    "--apf-color-gold-ink": c.goldInk,
    "--apf-color-gold-on-brand": c.goldOnBrand,
    "--apf-color-on-gold": c.onGold,
    "--apf-color-ink": c.ink,
    "--apf-color-text-primary": c.text.primary,
    "--apf-color-text-secondary": c.text.secondary,
    "--apf-color-text-tertiary": c.text.tertiary,
    "--apf-color-text-muted": c.text.muted,
    "--apf-color-text-inverse": c.text.inverse,
    "--apf-color-text-heading": c.text.heading,
    "--apf-color-text-link": c.text.link,
    "--apf-color-text-link-hover": c.text.linkHover,
    "--apf-color-text-accent": c.text.accent,
    "--apf-color-surface-page": c.surface.page,
    "--apf-color-surface-raised": c.surface.raised,
    "--apf-color-surface-inset": c.surface.inset,
    "--apf-color-surface-footer": c.surface.footer,
    "--apf-color-surface-hero": c.surface.hero,
    "--apf-color-border-subtle": c.border.subtle,
    "--apf-color-border-focus": c.border.focus,
    "--apf-color-brand-default": c.brand.green,
    "--apf-color-brand-dark": c.brandDark,
    "--apf-color-status-success": c.status.success,
    "--apf-color-status-warning": c.status.warning,
    "--apf-color-status-danger": c.status.danger,
    "--apf-color-status-info": c.status.info,
    "--apf-color-status-success-bg": c.status.successBg,
    "--apf-color-status-warning-bg": c.status.warningBg,
    "--apf-color-status-danger-bg": c.status.dangerBg,
    "--apf-color-status-info-bg": c.status.infoBg,
  };
}

const lightChart = lightRoot.primitive.color.chart;
function chartVars() {
  const out = {};
  lightChart.categorical.forEach((c, i) => (out[`--apf-color-chart-cat-${i + 1}`] = c));
  lightChart.sequential.forEach((c, i) => (out[`--apf-color-chart-seq-${i + 1}`] = c));
  lightChart.diverging.forEach((c, i) => (out[`--apf-color-chart-div-${i + 1}`] = c));
  out["--apf-color-chart-axis"] = lightChart.axis;
  out["--apf-color-chart-gridline"] = lightChart.gridline;
  out["--apf-color-chart-label"] = lightChart.label;
  return out;
}

const comp = lightRoot.component;
const primitive = lightRoot.primitive;

function layoutVars() {
  return {
    "--apf-size-hit": primitive.size.hit,
    "--apf-size-control": primitive.size.control,
    "--apf-size-icon-sm": primitive.size.iconSm,
    "--apf-size-icon-md": primitive.size.iconMd,
    "--apf-size-icon-lg": primitive.size.iconLg,
    "--apf-header-height": comp.header.height,
    "--apf-header-sticky-height": comp.header.stickyHeight,
    "--apf-header-mobile-height": comp.header.mobileHeight,
    "--apf-header-logo-height": comp.header.logoHeight,
    "--apf-footer-pad-top": comp.footer.padTop,
    "--apf-footer-pad-bottom": comp.footer.padBottom,
    "--apf-footer-max-width": comp.footer.maxWidth,
    "--apf-sidebar-width": comp.sidebar.width,
    "--apf-card-radius": r(comp.card.radius),
    "--apf-card-pad": r(comp.card.pad),
    "--apf-card-shadow": r(comp.card.shadow),
    "--apf-card-border": r(comp.card.border),
    "--apf-container-page": primitive.container.page,
    "--apf-container-content": primitive.container.content,
    "--apf-container-prose": primitive.container.prose,
    "--apf-container-narrow": primitive.container.narrow,
    "--apf-measure-prose": primitive.measure.prose,
    "--apf-measure-text": primitive.measure.text,
    "--apf-measure-hero": primitive.measure.hero,
    "--apf-duration-fast": r("{primitive.duration.fast}"),
    "--apf-duration-base": r("{primitive.duration.base}"),
    "--apf-duration-slow": r("{primitive.duration.slow}"),
    "--apf-easing-standard": r("{primitive.easing.standard}"),
    "--apf-easing-out": r("{primitive.easing.out}"),
    "--apf-z-header": String(primitive.zIndex.header),
    "--apf-z-dropdown": String(primitive.zIndex.dropdown),
    "--apf-z-overlay": String(primitive.zIndex.overlay),
  };
}

function scaleVars() {
  const out = {};
  for (const [k, v] of Object.entries(primitive.fontSize)) out[`--apf-font-size-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.lineHeight)) out[`--apf-line-height-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.fontWeight)) out[`--apf-font-weight-${k}`] = String(v);
  for (const [k, v] of Object.entries(primitive.letterSpacing)) out[`--apf-letter-spacing-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.space)) out[`--apf-space-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.radius)) out[`--apf-radius-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.shadow)) out[`--apf-shadow-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.borderWidth)) out[`--apf-border-width-${k}`] = v;
  for (const [k, v] of Object.entries(primitive.breakpoint)) out[`--apf-breakpoint-${k}`] = v;
  return out;
}

function neutralVars() {
  // Theme-invariant anchors for band text (APF rule: band text is always white).
  return {
    "--apf-color-neutral-white": primitive.color.neutral.white,
    "--apf-color-neutral-black": primitive.color.neutral.black,
  };
}

function editorialVars() {
  const e = lightRoot.overlay?.editorial;
  if (!e) return {};
  const v = (k) => r(e[k]);
  return {
    "--apf-editorial-font": v("font"),
    "--apf-editorial-headline-size": v("headlineSize"),
    "--apf-editorial-headline-line": v("headlineLine"),
    "--apf-editorial-deck-size": v("deckSize"),
    "--apf-editorial-deck-line": v("deckLine"),
    "--apf-editorial-byline-size": v("bylineSize"),
    "--apf-editorial-byline-line": v("bylineLine"),
    "--apf-editorial-body-size": v("bodySize"),
    "--apf-editorial-body-line": v("bodyLine"),
    "--apf-editorial-quote-size": v("quoteSize"),
    "--apf-editorial-quote-line": v("quoteLine"),
    "--apf-editorial-h2-size": v("h2Size"),
    "--apf-editorial-h2-line": v("h2Line"),
    "--apf-editorial-h3-size": v("h3Size"),
    "--apf-editorial-h3-line": v("h3Line"),
    "--apf-editorial-measure": v("measure"),
    "--apf-editorial-column": v("column"),
    "--apf-editorial-rhythm": v("rhythm"),
  };
}

function localeBlocks() {
  const overlay = lightRoot.overlay?.locale ?? {};
  const selectors = { zh: ":lang(zh)", hk: ":lang(zh-Hant-HK)" };
  return Object.entries(overlay)
    .map(([key, l]) => {
      const sel = selectors[key];
      if (!sel) return "";
      const vars = {
        "--apf-font-locale-sans": r(l.sans),
        "--apf-font-locale-serif": r(l.serif),
        "--apf-measure": r(l.measure),
        "letter-spacing": r(l.letterSpacing),
      };
      return block(`:root${sel}`, vars);
    })
    .join("");
}

function block(selector, vars) {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}\n`;
}

const lightVars = {
  ...colorVars(project(r)),
  ...chartVars(),
  ...layoutVars(),
  ...scaleVars(),
  ...neutralVars(),
  ...editorialVars(),
  "color-scheme": "light",
};

const darkVars = {
  ...colorVars(project(rd)),
  ...chartVars(),
  ...layoutVars(),
  ...scaleVars(),
  ...neutralVars(),
  ...editorialVars(),
  "color-scheme": "dark",
};

const banner = `/* AUTO-GENERATED by scripts/generate-tokens.mjs — do not edit.
 * Source: src/styles/tokens/{tokens.v2.json,tokens-dark.json}
 * Upstream: apf-website @ 1fa581d (2026-10-16)
 */\n\n`;

writeFileSync(
  OUT,
  banner +
    block(":root", lightVars) +
    block(':root[data-theme="dark"]', darkVars) +
    localeBlocks(),
  "utf8",
);

console.log(`Wrote ${OUT}`);
