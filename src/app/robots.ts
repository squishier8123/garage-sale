import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://garagesale.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/seller/", "/api/", "/transaction/", "/checkout/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
