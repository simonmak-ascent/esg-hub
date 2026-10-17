import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import light from "@/styles/tokens/tokens.v2.json";
import dark from "@/styles/tokens/tokens-dark.json";

type Json = Record<string, unknown>;

function resolveRef(value: string, root: Json, fallback?: Json): string {
  let out = value;
  for (let i = 0; i < 12 && /\{[a-z0-9.]+\}/i.test(out); i += 1) {
    out = out.replace(/\{([a-z0-9.]+)\}/gi, (_, path: string) => {
      for (const tree of [root, fallback]) {
        if (!tree) continue;
        let node: unknown = tree;
        for (const key of path.split(".")) {
          node = node && typeof node === "object" ? (node as Json)[key] : undefined;
        }
        if (typeof node === "string" || typeof node === "number") return String(node);
      }
      return "";
    });
  }
  return out;
}

function get(root: Json, path: string, fallback?: Json): string {
  let node: unknown = root;
  for (const key of path.split(".")) {
    node = node && typeof node === "object" ? (node as Json)[key] : undefined;
  }
  return resolveRef(String(node ?? ""), root, fallback);
}

function keys(tree: unknown, prefix = ""): string[] {
  if (!tree || typeof tree !== "object") return [];
  return Object.entries(tree as Json).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? keys(v, path) : [path];
  });
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("APF design tokens", () => {
  const semanticColors = (tree: Json): Json => ((tree.semantic as Json).color as Json);

  it("resolves every semantic colour path in both themes", () => {
    const lightKeys = keys(semanticColors(light as Json));
    const darkKeys = keys(semanticColors(dark as Json));
    expect(darkKeys).toEqual(lightKeys);
    for (const key of lightKeys) {
      expect(get(light as Json, `semantic.color.${key}`)).toMatch(/^#|^rgb/);
      expect(get(dark as Json, `semantic.color.${key}`)).toMatch(/^#|^rgb/);
    }
  });

  it("keeps body text at AAA (>=7:1) on its page surface in both themes", () => {
    for (const [name, tree, fallback] of [
      ["light", light as Json, undefined],
      ["dark", dark as Json, light as Json],
    ] as const) {
      const page = get(tree, "semantic.color.surface.page", fallback);
      const primary = get(tree, "semantic.color.text.primary", fallback);
      const secondary = get(tree, "semantic.color.text.secondary", fallback);
      expect(contrast(primary, page), `${name} primary on page`).toBeGreaterThanOrEqual(7);
      expect(contrast(secondary, page), `${name} secondary on page`).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps links at AA (>=4.5:1) on the page surface", () => {
    for (const [name, tree, fallback] of [
      ["light", light as Json, undefined],
      ["dark", dark as Json, light as Json],
    ] as const) {
      const page = get(tree, "semantic.color.surface.page", fallback);
      const link = get(tree, "semantic.color.text.link", fallback);
      expect(contrast(link, page), `${name} link on page`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ships the generated --apf-* layer for both themes", () => {
    const css = readFileSync(join(process.cwd(), "src/styles/tokens.generated.css"), "utf8");
    expect(css).toContain("--apf-color-brand-forest");
    expect(css).toContain("--apf-color-brand-sprout");
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain("--apf-editorial-measure");
    expect(css).toContain("--apf-container-page");
  });

  it("does not leak a raw colour into the app layer", () => {
    const guard = readFileSync(join(process.cwd(), "scripts/token-guard.mjs"), "utf8");
    expect(guard).toContain("Token guard");
  });
});
