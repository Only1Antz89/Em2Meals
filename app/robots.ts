import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/sign-in", "/sign-up", "/menu/preview", "/report-preview", "/wrapped/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
