import { describe, it, expect } from "vitest";
import { parsePageIdentifier } from "@/lib/page-identifier";

describe("parsePageIdentifier", () => {
  it("accepts a record ID", () => {
    expect(parsePageIdentifier("page:7oie1mzody0jsxxhva4l")).toEqual({
      valid: true,
      value: "page:7oie1mzody0jsxxhva4l",
      kind: "record",
    });
  });

  it("accepts a permalink, encoded or not", () => {
    expect(parsePageIdentifier("climate-finance/physical-climate-risk")).toEqual({
      valid: true,
      value: "climate-finance/physical-climate-risk",
      kind: "path",
    });
    expect(parsePageIdentifier("climate-finance%2Fphysical-climate-risk")).toEqual({
      valid: true,
      value: "climate-finance/physical-climate-risk",
      kind: "path",
    });
  });

  it("accepts a bare slug and strips surrounding slashes", () => {
    expect(parsePageIdentifier("/environmental/")).toMatchObject({
      valid: true,
      value: "environmental",
      kind: "path",
    });
  });

  it("rejects empty input", () => {
    expect(parsePageIdentifier(undefined).valid).toBe(false);
    expect(parsePageIdentifier("").valid).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(parsePageIdentifier("../etc/passwd").valid).toBe(false);
    expect(parsePageIdentifier("a/../../b").valid).toBe(false);
  });

  it("rejects query characters and control input", () => {
    expect(parsePageIdentifier("environmental'").valid).toBe(false);
    expect(parsePageIdentifier("page:x; DROP TABLE page").valid).toBe(false);
    expect(parsePageIdentifier("a b").valid).toBe(false);
  });

  it("rejects over-long identifiers", () => {
    expect(parsePageIdentifier("a".repeat(501)).valid).toBe(false);
  });
});
