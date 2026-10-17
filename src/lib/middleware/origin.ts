/**
 * Origin checks for the public write/paid API routes.
 *
 * The API still serves non-browser clients (curl, MCP clients, agents) which
 * send no `Origin` header, so a missing header is allowed. A browser request is
 * only accepted when it originates from this deployment or a configured
 * first-party host — with `Access-Control-Allow-Origin: *` in place, without
 * this check any third-party page can spend our provider budget from a
 * visitor's browser.
 */

const DEFAULT_ALLOWED_HOSTS = ["esg-hub.ascent.partners", "localhost", "127.0.0.1"];

function allowedHosts(): string[] {
  const configured = process.env.ALLOWED_API_ORIGINS;
  if (!configured) return DEFAULT_ALLOWED_HOSTS;
  return [
    ...DEFAULT_ALLOWED_HOSTS,
    ...configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ];
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when the request has no Origin (non-browser client), or the Origin
 * belongs to this deployment, a configured host, or the deployment's own host.
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return true;
  }

  const originHost = hostOf(origin);
  if (!originHost) {
    return false;
  }

  const requestHost = hostOf(request.url);
  if (requestHost && originHost === requestHost) {
    return true;
  }

  return allowedHosts().includes(originHost);
}

export function forbiddenOriginResponse(): Response {
  return new Response(JSON.stringify({ error: "Origin not allowed" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
