import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /search serves user-specific result pages with no standalone content;
        // keep it out of the index.
        disallow: ["/api/", "/search"],
      },
    ],
    sitemap: "https://esg-hub.ascent.partners/sitemap.xml",
  };
}
