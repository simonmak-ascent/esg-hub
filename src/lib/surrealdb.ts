import { Surreal } from "surrealdb";

// Credentials are sourced exclusively from environment variables.
// Set SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, and SURREAL_DATABASE in
// your deployment environment. SURREAL_NAMESPACE is hardcoded to "esg_hub".
//
// Auth model: SurrealDB Cloud namespace/database users cannot authenticate with
// HTTP Basic auth (that is root-scope only). We sign in with the JSON-RPC
// `signin` method at namespace scope, cache the returned Bearer token (~1h TTL),
// and send it on every query. A single re-signin is attempted on 401.
//
// NOTE: Access env vars inside functions, not at module level, for Vercel compatibility

let dbInstance: Surreal | null = null;

function getEnvVars() {
  // SURREAL_NAMESPACE is hardcoded as the project default ("esg_hub") so that
  // a shell-level SURREAL_NAMESPACE from another project (e.g. "valuation")
  // can never shadow it. All other credentials remain env-var driven.
  // .trim() guards against trailing newlines from how secrets were stored
  // (e.g. `echo "value" | gh secret set` appends a newline to the value).
  return {
    endpoint: (process.env.SURREAL_URL || "").trim(),
    username: (process.env.SURREAL_USERNAME || "").trim(),
    password: (process.env.SURREAL_PASSWORD || "").trim(),
    namespace: "esg_hub",
    database: (process.env.SURREAL_DATABASE || "").trim(),
  };
}

// ── Namespace-scoped auth token cache ───────────────────────────────────────

type AuthToken = { token: string; expiresAt: number };
let tokenCache: AuthToken | null = null;

/** Sign in at namespace scope and cache the Bearer token (~55 min of a 1h TTL). */
async function signin(): Promise<string> {
  const env = getEnvVars();
  const res = await fetch(`${env.endpoint}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      id: 1,
      method: "signin",
      params: [{ user: env.username, pass: env.password, NS: env.namespace }],
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as
    | { result?: unknown; error?: { message?: string } }
    | null;
  if (!res.ok || !body || body.error || typeof body.result !== "string") {
    console.error(
      `[SurrealDB] signin failed (HTTP ${res.status}) — ns=${env.namespace}`
    );
    throw new Error(`SurrealDB signin failed (HTTP ${res.status})`);
  }
  tokenCache = { token: body.result, expiresAt: Date.now() + 55 * 60 * 1000 };
  return body.result;
}

async function getAuthToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  return signin();
}

/**
 * POST one JSON-RPC request with a namespace Bearer token. Retries once with a
 * fresh token on 401 (expired/rotated token).
 */
async function rpcRequest(reqBody: unknown): Promise<{
  ok: boolean;
  status: number;
  body: { result?: unknown; error?: { message?: string } } | null;
}> {
  const env = getEnvVars();
  const send = (token: string) =>
    fetch(`${env.endpoint}/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "surreal-ns": env.namespace,
        "surreal-db": env.database,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reqBody),
      cache: "no-store",
    });

  let res = await send(await getAuthToken());
  if (res.status === 401) {
    tokenCache = null;
    res = await send(await getAuthToken());
  }
  const body = (await res.json().catch(() => null)) as
    | { result?: unknown; error?: { message?: string } }
    | null;
  return { ok: res.ok, status: res.status, body };
}

export async function getDb(): Promise<Surreal> {
  if (dbInstance) {
    return dbInstance;
  }

  const env = getEnvVars();
  const db = new Surreal();

  await db.connect(env.endpoint, {
    namespace: env.namespace,
    database: env.database,
    authentication: {
      username: env.username,
      password: env.password,
    },
  });

  dbInstance = db;
  return db;
}

/**
 * Sanitize a string value for safe use in SurrealQL queries.
 * Escapes single quotes and backslashes to prevent injection.
 */
export function sanitize(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/[\x00-\x1f]/g, ""); // Strip control characters
}

/**
 * Validate and sanitize a numeric parameter
 */
export function sanitizeInt(value: string | null, defaultVal: number, min: number, max: number): number {
  if (!value) return defaultVal;
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultVal;
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate that a string matches a safe alphanumeric pattern (for section/pillar names)
 */
export function isAlphanumericDash(value: string): boolean {
  return /^[a-zA-Z0-9\-_ &]+$/.test(value);
}

/**
 * Execute a raw SurrealQL query via HTTP using JSON-RPC (more reliable for server-side use in Next.js).
 * Supports optional variables for parameterized queries.
 */
export async function queryHttp<T = unknown>(
  query: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  const env = getEnvVars();
  const params: unknown[] = vars && Object.keys(vars).length > 0 ? [query, vars] : [query];
  const { ok, status, body: resBody } = await rpcRequest({ id: 1, method: "query", params });

  if (!ok) {
    console.error(`[SurrealDB] HTTP ${status} — ns=${env.namespace} db=${env.database}`);
    throw new Error(`Database query failed (HTTP ${status})`);
  }

  // Handle JSON-RPC response format
  if (resBody?.error) {
    console.error("[SurrealDB] RPC error:", JSON.stringify(resBody.error));
    throw new Error(`Database query returned an error: ${resBody.error.message}`);
  }

  // RPC response: { result: [...], status: "OK", time: "..." }
  const rpcResult = resBody?.result;
  if (!Array.isArray(rpcResult) || rpcResult.length === 0) {
    console.error("[SurrealDB] Unexpected response format:", JSON.stringify(resBody).slice(0, 500));
    throw new Error("Database returned an unexpected response format");
  }

  // Return the result from the last statement
  const last = rpcResult[rpcResult.length - 1] as { status?: string; result?: unknown };
  if (last?.status !== "OK") {
    console.error("[SurrealDB] Query error:", JSON.stringify(last));
    throw new Error("Database query returned an error");
  }

  return Array.isArray(last.result) ? (last.result as T[]) : [];
}

/**
 * Execute multiple statements and return all results using JSON-RPC
 */
export async function queryHttpAll<T = unknown>(
  query: string
): Promise<
  Array<{ result: T[]; status: string; time: string }>
> {
  const { ok, status, body: resBody } = await rpcRequest({
    id: 1,
    method: "query",
    params: [query],
  });

  if (!ok) {
    console.error(`[SurrealDB] HTTP ${status}`);
    throw new Error(`Database query failed (HTTP ${status})`);
  }

  if (resBody?.error) {
    console.error("[SurrealDB] RPC error:", JSON.stringify(resBody.error));
    throw new Error(`Database query returned an error: ${resBody.error.message}`);
  }

  // Return the result array directly
  return (resBody?.result as Array<{ result: T[]; status: string; time: string }>) || [];
}
