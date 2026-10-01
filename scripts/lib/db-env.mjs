/**
 * Shared DB environment + auth for scripts/*.mjs (specs/dev-env-automation, D5).
 *
 * The namespace is hardcoded to "esg_hub" — SURREAL_NAMESPACE from the shell
 * is intentionally ignored because other projects export their own value
 * (e.g. "valuation"), which previously made scripts target the wrong database.
 * Override only with ESG_HUB_NS_OVERRIDE=<namespace> (prints a loud warning).
 *
 * Auth: SurrealDB Cloud namespace/database users cannot use HTTP Basic auth
 * (root-scope only). We sign in with the JSON-RPC `signin` method at namespace
 * scope, cache the Bearer token (~1h TTL), and send it on every request via
 * `getAuthHeaders()` / `querySurreal()` / `querySurrealAll()`.
 */

export function getNamespace() {
  const override = process.env.ESG_HUB_NS_OVERRIDE;
  if (override) {
    console.warn(`\n⚠️  ESG_HUB_NS_OVERRIDE active: targeting namespace "${override}" instead of "esg_hub"\n`);
    return override;
  }
  return "esg_hub";
}

export function getDbEnv() {
  return {
    endpoint: (process.env.SURREAL_URL || "").trim(),
    username: (process.env.SURREAL_USERNAME || "").trim(),
    password: (process.env.SURREAL_PASSWORD || "").trim(),
    database: (process.env.SURREAL_DATABASE || "").trim(),
    namespace: getNamespace(),
  };
}

let tokenCache = null;

/** Sign in at namespace scope and cache the Bearer token (~55 min of a 1h TTL). */
export async function getToken(env = getDbEnv()) {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  if (!env.endpoint) {
    throw new Error("SURREAL_URL is not set");
  }
  const res = await fetch(`${env.endpoint}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      id: 1,
      method: "signin",
      params: [{ user: env.username, pass: env.password, NS: env.namespace }],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error || typeof body.result !== "string") {
    throw new Error(`SurrealDB signin failed (HTTP ${res.status})`);
  }
  tokenCache = { token: body.result, expiresAt: Date.now() + 55 * 60 * 1000 };
  return body.result;
}

/** Headers for SurrealDB JSON-RPC/SQL requests (Bearer + namespace/database). */
export async function getAuthHeaders(env = getDbEnv()) {
  const token = await getToken(env);
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "surreal-ns": env.namespace,
    "surreal-db": env.database,
    Authorization: `Bearer ${token}`,
  };
}

/** Run one SurrealQL statement; returns the last statement's result array. */
export async function querySurreal(sql, vars, env = getDbEnv()) {
  const headers = await getAuthHeaders(env);
  const params = vars && Object.keys(vars).length > 0 ? [sql, vars] : [sql];
  const res = await fetch(`${env.endpoint}/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: 1, method: "query", params }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(`SurrealDB query failed (HTTP ${res.status})`);
  }
  const arr = body.result;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const last = arr[arr.length - 1];
  if (last?.status !== "OK") {
    throw new Error("SurrealDB query returned an error");
  }
  return Array.isArray(last.result) ? last.result : [];
}

/** Run SurrealQL statements; returns the full statement-result array (like the /sql endpoint). */
export async function querySurrealAll(sql, env = getDbEnv()) {
  const headers = await getAuthHeaders(env);
  const res = await fetch(`${env.endpoint}/rpc`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: 1, method: "query", params: [sql] }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(`SurrealDB query failed (HTTP ${res.status})`);
  }
  return body.result || [];
}
