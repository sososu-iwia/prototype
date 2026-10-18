export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { origin } from "../lib/metadata";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/kk/admin", "/ru/admin", "/en/admin"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
