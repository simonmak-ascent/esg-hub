import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownContent from "@/components/MarkdownContent";
import { isAllowedOrigin } from "@/lib/middleware/origin";

function render(markdown: string): string {
  return renderToStaticMarkup(<MarkdownContent content={markdown} />);
}

describe("MarkdownContent sanitisation", () => {
  it("strips script elements", () => {
    const html = render('Hello\n\n<script>alert("xss")</script>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("strips event handlers from raw HTML", () => {
    const html = render('<img src="https://example.com/a.png" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("keeps ordinary markdown links and drops javascript: hrefs", () => {
    const safe = render("[GRI](https://globalreporting.org)");
    expect(safe).toContain('href="https://globalreporting.org"');

    const unsafe = render("[click](javascript:alert(1))");
    expect(unsafe).not.toContain("javascript:");
  });

  it("keeps an infobox HTML block with its class", () => {
    const html = render('<aside class="infobox"><p>Fact</p></aside>');
    expect(html).toContain("<aside");
    expect(html).toContain('class="infobox"');
  });

  it("renders exactly one h1 when the body repeats the page title", () => {
    const html = render("# Environmental (E)\n\n## About\nBody");
    expect(html.match(/<h1/g) ?? []).toHaveLength(0);
    expect(html).toContain("<h2");
  });
});

describe("isAllowedOrigin", () => {
  const req = (url: string, origin?: string) =>
    new Request(url, { headers: origin ? { origin } : {} });

  it("allows non-browser clients without an Origin header", () => {
    expect(isAllowedOrigin(req("https://esg-hub.ascent.partners/api/ai-chat"))).toBe(true);
  });

  it("allows the deployment's own origin", () => {
    expect(
      isAllowedOrigin(req("https://esg-hub.ascent.partners/api/ai-chat", "https://esg-hub.ascent.partners"))
    ).toBe(true);
  });

  it("rejects a third-party origin", () => {
    expect(isAllowedOrigin(req("https://esg-hub.ascent.partners/api/ai-chat", "https://evil.example"))).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isAllowedOrigin(req("https://esg-hub.ascent.partners/api/ai-chat", "not a url"))).toBe(false);
  });
});
