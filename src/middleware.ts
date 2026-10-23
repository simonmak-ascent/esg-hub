import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const isVideoDomain =
    hostname === "esg.video" ||
    hostname === "www.esg.video" ||
    hostname.endsWith(".esg.video");

  if (
    isVideoDomain &&
    !request.nextUrl.pathname.startsWith("/videos")
  ) {
    const url = new URL("https://esg-hub.ascent.partners/videos");
    return NextResponse.redirect(url, 308);
  }

  const response = intlMiddleware(request);

  // next-intl rewrites "/" to an absolute URL built from the incoming request
  // (e.g. http://localhost:3210/en). Behind the ALB + Caddy that absolute form
  // is treated as an external self-proxy, which loops over http and fails with
  // EPROTO over https. A relative rewrite is applied internally instead.
  const rewrite = response.headers.get("x-middleware-rewrite");
  if (rewrite) {
    const target = new URL(rewrite);
    response.headers.set(
      "x-middleware-rewrite",
      `${target.pathname}${target.search}`
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|images|.*\\..*).*)"],
};
