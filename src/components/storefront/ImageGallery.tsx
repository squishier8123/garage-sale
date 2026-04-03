"use client";

import Image from "next/image";
import { useState } from "react";

interface GalleryImage {
  id: string;
  url: string;
  hero_url: string | null;
  position: number;
}

export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">No images</p>
      </div>
    );
  }

  const sorted = [...images].sort((a, b) => a.position - b.position);
  const activeImage = sorted[activeIndex];
  const displayUrl = activeImage.hero_url ?? activeImage.url;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <Image
          src={displayUrl}
          alt={`Image ${activeIndex + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={activeIndex === 0}
        />
      </div>

      {/* Thumbnails */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setActiveIndex(index)}
              className={`relative w-16 h-16 rounded-md overflow-hidden shrink-0 border-2 transition-colors ${
                index === activeIndex
                  ? "border-gray-900"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <Image
                src={image.url}
                alt={`Thumbnail ${index + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
