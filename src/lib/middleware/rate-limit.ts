const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 50;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Maximum requests allowed per window. Defaults to 50. */
  max?: number;
  /** Window length in milliseconds. Defaults to 5 minutes. */
  windowMs?: number;
}

export interface RateLimitResult {
  rateLimited: boolean;
  remaining: number;
  /** Seconds until the window resets, suitable for a Retry-After header. */
  retryAfter: number;
}

const store = new Map<string, Bucket>();

function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Cloudflare
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  return "unknown";
}

export function checkRateLimit(
  request: Request,
  options: RateLimitOptions = {}
): RateLimitResult {
  const max = options.max ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const ip = extractIp(request);
  const now = Date.now();

  let bucket = store.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(ip, bucket);
  }

  bucket.count++;

  const rateLimited = bucket.count > max;
  const remaining = Math.max(0, max - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return { rateLimited, remaining, retryAfter };
}

/**
 * Drain the in-memory store. Test-only: the module keeps state between tests.
 */
export function resetRateLimitStore(): void {
  store.clear();
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests", retry_after: result.retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of store) {
      if (now > bucket.resetAt) {
        store.delete(ip);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
