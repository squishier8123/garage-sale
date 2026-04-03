import { put } from "@vercel/blob";

const PIXELAPI_ENDPOINT =
  "https://api.pixelapi.dev/v1/image/remove-background";

interface RemoveBgResult {
  hero_url: string;
  original_url: string;
}

/**
 * Remove background from an image using PixelAPI.
 * Stores the result in Vercel Blob and returns the hero URL.
 *
 * @param imageUrl - Public URL of the source image (Vercel Blob)
 * @param listingId - Listing ID for organizing the blob path
 * @returns Hero URL (bg-removed PNG) or null if service unavailable
 */
export async function removeBackground(
  imageUrl: string,
  listingId: string,
): Promise<RemoveBgResult | null> {
  const apiKey = process.env.PIXELAPI_API_KEY;
  if (!apiKey) {
    return null; // PixelAPI not configured — use original as hero
  }

  try {
    // Fetch the source image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch source image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();

    // Send to PixelAPI
    const form = new FormData();
    form.append("image", imageBlob, "image.jpg");

    const response = await fetch(PIXELAPI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PixelAPI error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { output_url?: string };
    if (!data.output_url) {
      throw new Error("PixelAPI returned no output_url");
    }

    // Download the bg-removed image
    const heroResponse = await fetch(data.output_url);
    if (!heroResponse.ok) {
      throw new Error("Failed to download bg-removed image");
    }
    const heroBlob = await heroResponse.blob();

    // Store in Vercel Blob
    const heroPath = `listings/${listingId}/hero.png`;
    const { url: heroUrl } = await put(heroPath, heroBlob, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });

    return {
      hero_url: heroUrl,
      original_url: imageUrl,
    };
  } catch (error) {
    console.error("Background removal failed:", error);
    return null; // Fallback: use original photo as hero
  }
}
