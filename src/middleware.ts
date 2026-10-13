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

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|images|.*\\..*).*)"],
};
