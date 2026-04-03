/**
 * Client-side image optimization before upload.
 * Resizes to max 2048px, compresses to JPEG 85%, fixes EXIF orientation.
 * Runs in the browser — uses Canvas API.
 */

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;
const TARGET_SIZE_BYTES = 500 * 1024; // 500KB target

interface OptimizeResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

export async function optimizeImage(file: File): Promise<OptimizeResult> {
  const originalSize = file.size;

  // Create an image bitmap (handles EXIF orientation automatically in modern browsers)
  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  // Calculate resize dimensions maintaining aspect ratio
  const { width, height } = calculateDimensions(origW, origH, MAX_DIMENSION);

  // Draw to canvas at target dimensions
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Compress to JPEG
  let quality = JPEG_QUALITY;
  let blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality,
  });

  // If still too large, reduce quality incrementally
  while (blob.size > TARGET_SIZE_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality,
    });
  }

  return {
    blob,
    width,
    height,
    originalSize,
    optimizedSize: blob.size,
  };
}

function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Validate file before optimization.
 * Returns null if valid, error message if invalid.
 */
export function validateImageFile(file: File): string | null {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];

  if (!allowedTypes.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, or HEIC.`;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`;
  }

  return null;
}

/**
 * Process multiple files for batch upload.
 * Returns optimized blobs with validation errors filtered out.
 */
export async function optimizeImages(
  files: File[],
  maxCount: number = 8,
): Promise<{
  results: { file: File; optimized: OptimizeResult }[];
  errors: { file: File; error: string }[];
}> {
  if (files.length > maxCount) {
    return {
      results: [],
      errors: [
        {
          file: files[0],
          error: `Too many files: ${files.length}. Maximum is ${maxCount}.`,
        },
      ],
    };
  }

  const results: { file: File; optimized: OptimizeResult }[] = [];
  const errors: { file: File; error: string }[] = [];

  for (const file of files) {
    const validationError = validateImageFile(file);
    if (validationError) {
      errors.push({ file, error: validationError });
      continue;
    }

    try {
      const optimized = await optimizeImage(file);
      results.push({ file, optimized });
    } catch (error) {
      errors.push({
        file,
        error: (error as Error).message || "Failed to optimize image",
      });
    }
  }

  return { results, errors };
}
