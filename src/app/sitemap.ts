import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://garagesale.app";
  const supabase = createAdminClient();

  // Fetch all active listings
  const { data: listings } = await supabase
    .from("listings")
    .select("id, published_at")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(5000);

  const listingEntries: MetadataRoute.Sitemap = (listings ?? []).map(
    (listing) => ({
      url: `${baseUrl}/listing/${listing.id}`,
      lastModified: listing.published_at
        ? new Date(listing.published_at)
        : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }),
  );

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...listingEntries,
  ];
}
