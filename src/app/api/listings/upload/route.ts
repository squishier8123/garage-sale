import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate: only sellers can upload
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Not authenticated");
        }

        // Verify seller role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile || profile.role !== "seller") {
          throw new Error("Only sellers can upload images");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: user.id,
            listingId: clientPayload ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Note: this callback won't fire on localhost
        // Production: store the blob URL in listing_images
        if (!tokenPayload) return;

        try {
          const payload = JSON.parse(tokenPayload) as {
            userId: string;
            listingId: string | null;
          };

          if (payload.listingId) {
            const { createAdminClient } = await import(
              "@/lib/supabase/admin"
            );
            const admin = createAdminClient();

            // Get current max position for this listing
            const { data: existing } = await admin
              .from("listing_images")
              .select("position")
              .eq("listing_id", payload.listingId)
              .order("position", { ascending: false })
              .limit(1);

            const nextPosition =
              existing && existing.length > 0 ? existing[0].position + 1 : 0;

            await admin.from("listing_images").insert({
              listing_id: payload.listingId,
              storage_path: blob.pathname,
              url: blob.url,
              position: nextPosition,
            });
          }
        } catch {
          // Log but don't fail — the blob is already stored
          console.error("Failed to save image metadata to database");
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
