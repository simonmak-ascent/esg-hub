/**
 * Pipeline Fetcher — HTTP ingestion with retries, conditional requests, and checksums.
 *
 * Dependencies: none (Node.js built-ins only).
 */

import crypto from "node:crypto";
import { url as nodeUrl } from "node:url";

const CONNECT_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const BASE_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 10_000;
const JITTER_MAX_MS = 1000;

// ---------------------------------------------------------------------------
// AbortController helper compatible with Node 18+
// ---------------------------------------------------------------------------
const maybeAbortSignal = (timeoutMs) => {
  try {
    return AbortSignal.timeout(timeoutMs);
  } catch {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), timeoutMs);
    return ctrl.signal;
  }
};

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------
function backoffMs(attempt) {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
  return Math.min(base + jitter, MAX_BACKOFF_MS);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header) {
  if (!header) return null;
  const num = Number(header);
  if (Number.isFinite(num)) return num * 1000; // seconds → ms
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

// ---------------------------------------------------------------------------
// Body reader with size cap
// ---------------------------------------------------------------------------
async function readBody(res, signal) {
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new Error(
      `Content-Length ${contentLength} exceeds limit of ${MAX_BODY_BYTES} bytes`
    );
  }
  const reader = res.body?.getReader();
  if (!reader) return "";

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      reader.cancel();
      throw new Error(`Response body exceeds limit of ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(value);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with retry logic, conditional request support, and size limits.
 *
 * @param {string} url
 * @param {{ etag?: string, lastModified?: string, timeout?: number }} [options]
 * @returns {Promise<{
 *   status: number,
 *   headers: Record<string,string>,
 *   body?: string,
 *   url: string,
 *   notModified?: boolean,
 *   error?: string,
 * }>}
 */
export async function fetchSource(url, options = {}) {
  const requestHeaders = {
    "User-Agent": "ESG-Hub-KM/1.0 (https://github.com/simonmak-ascent/esg-hub)",
    Accept: "text/html, application/json, text/*, */*;q=0.8",
  };
  if (options.etag) {
    requestHeaders["If-None-Match"] = options.etag;
  }
  if (options.lastModified) {
    requestHeaders["If-Modified-Since"] = options.lastModified;
  }

  const connectTimeout = options.timeout ?? CONNECT_TIMEOUT_MS;
  const readTimeout = options.timeout ? options.timeout * 3 : READ_TIMEOUT_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const connectSignal = maybeAbortSignal(connectTimeout);
      const readSignal = maybeAbortSignal(readTimeout);

      // Combine both timeouts — race to first abort
      const combined = AbortSignal.any
        ? AbortSignal.any([connectSignal, readSignal])
        : connectSignal; // fallback: use connectSignal; read cap via body reader

      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: requestHeaders,
        signal: combined,
      });

      const resHeaders = {};
      res.headers.forEach((v, k) => {
        resHeaders[k.toLowerCase()] = v;
      });

      // 304 Not Modified
      if (res.status === 304) {
        return { status: 304, headers: resHeaders, url: res.url, notModified: true };
      }

      // 429 Too Many Requests
      if (res.status === 429) {
        const retryAfter = parseRetryAfter(resHeaders["retry-after"]);
        if (retryAfter && attempt < MAX_RETRIES) {
          console.warn(
            `[fetchSource] 429 on ${url}, Retry-After=${retryAfter}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await delay(Math.min(retryAfter, 30_000));
          continue;
        }
        return { status: 429, headers: resHeaders, url: res.url, error: "Rate limited" };
      }

      // 5xx — retryable
      if (res.status >= 500 && res.status < 600 && attempt < MAX_RETRIES) {
        const wait = backoffMs(attempt);
        console.warn(
          `[fetchSource] ${res.status} on ${url}, backing off ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await delay(wait);
        continue;
      }

      // 4xx (non-429) — no retry
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return {
          status: res.status,
          headers: resHeaders,
          url: res.url,
          error: `HTTP ${res.status}`,
        };
      }

      // Success — read body
      const body = await readBody(res, combined);
      return {
        status: res.status,
        headers: resHeaders,
        body,
        url: res.url,
      };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = backoffMs(attempt);
        console.warn(
          `[fetchSource] error on ${url}: ${err.message}, retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await delay(wait);
        continue;
      }
      console.error(`[fetchSource] exhausted retries on ${url}: ${err.message}`);
      return { status: 0, headers: {}, url, error: err.message };
    }
  }

  return { status: 0, headers: {}, url, error: "Unknown error" };
}

/**
 * Compute SHA-256 hex digest of a string.
 *
 * @param {string} text
 * @returns {string} hex-encoded SHA-256 hash
 */
export function computeChecksum(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Normalize a URL for deduplication — strips trailing slashes, query params,
 * and fragments.
 *
 * @param {string} url
 * @returns {string} canonical URL
 */
export function normalizeUrl(url) {
  try {
    const parsed = new nodeUrl.URL(url);
    parsed.search = "";
    parsed.hash = "";
    // Remove trailing slash (preserve root "/")
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    // If URL parsing fails, do best-effort manual cleanup
    let clean = url.split("#")[0].split("?")[0];
    if (clean.length > 1 && clean.endsWith("/")) {
      clean = clean.slice(0, -1);
    }
    return clean;
  }
}
