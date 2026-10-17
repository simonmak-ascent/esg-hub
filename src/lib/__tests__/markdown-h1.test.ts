import { describe, it, expect } from "vitest";
import { stripLeadingH1 } from "@/lib/markdown";

describe("stripLeadingH1", () => {
  it("removes a leading ATX h1 and keeps the body", () => {
    const input = "# Environmental (E)\n\n**Framework**: Planetary Boundaries\n";
    expect(stripLeadingH1(input)).toBe("\n**Framework**: Planetary Boundaries\n");
  });

  it("removes an h1 preceded by blank lines", () => {
    expect(stripLeadingH1("\n\n# Title\nBody")).toBe("Body");
  });

  it("removes a leading raw HTML h1", () => {
    expect(stripLeadingH1('<h1 id="x">Title</h1>\nBody')).toBe("Body");
  });

  it("leaves h2 headings untouched", () => {
    const input = "## Overview\nBody";
    expect(stripLeadingH1(input)).toBe(input);
  });

  it("only removes the first h1 when several exist", () => {
    const input = "# One\n\nText\n\n# Two\n";
    expect(stripLeadingH1(input)).toBe("\nText\n\n# Two\n");
  });

  it("leaves content without a leading heading unchanged", () => {
    const input = "Intro paragraph\n\n# Later title\n";
    expect(stripLeadingH1(input)).toBe(input);
  });

  it("does not treat a heading marker inside a sentence as a heading", () => {
    const input = "Issue # 12\n";
    expect(stripLeadingH1(input)).toBe(input);
  });
});
