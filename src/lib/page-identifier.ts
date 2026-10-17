/**
 * Page identifier handling shared by the related/backlinks routes.
 *
 * Three forms are accepted, matching what the API and MCP advertise:
 *   - a record ID: `page:abc123`
 *   - a permalink: `climate-finance/physical-climate-risk`
 *   - a bare slug: `physical-climate-risk`
 */

export type PageIdentifier =
  | { valid: true; value: string; kind: "record" | "path" }
  | { valid: false; error: string };

const RECORD_ID = /^page:[A-Za-z0-9_]+$/;
const PATH = /^[A-Za-z0-9\-_/]+$/;

export function parsePageIdentifier(raw: string | undefined): PageIdentifier {
  if (!raw || typeof raw !== "string") {
    return { valid: false, error: "Page identifier is required" };
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { valid: false, error: "Invalid page identifier encoding" };
  }

  if (decoded.length > 500) {
    return { valid: false, error: "Page identifier too long" };
  }

  if (RECORD_ID.test(decoded)) {
    return { valid: true, value: decoded, kind: "record" };
  }

  const path = decoded.replace(/^\/+|\/+$/g, "");
  if (!path || !PATH.test(path)) {
    return { valid: false, error: "Invalid page identifier format" };
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return { valid: false, error: "Invalid page identifier format" };
  }

  return { valid: true, value: path, kind: "path" };
}
