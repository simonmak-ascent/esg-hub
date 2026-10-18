/**
 * Request-level error reporting.
 *
 * Next calls this for every uncaught error during rendering, route handling or
 * server actions. There is no SaaS error tracker in this project, so the event
 * is emitted as a single structured JSON line that Vercel's log drain can
 * index; `digest` matches the reference shown to the user by the error
 * boundaries.
 */
export async function onRequestError(
  err: Error & { digest?: string },
  request: { path: string; method: string },
  context: { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string }
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.error(
    JSON.stringify({
      event: "request_error",
      digest: err?.digest,
      message: err?.message ?? String(err),
      path: request?.path,
      method: request?.method,
      route: context?.routePath,
      route_type: context?.routeType,
      router: context?.routerKind,
      render_source: context?.renderSource,
      timestamp: new Date().toISOString(),
    })
  );
}
