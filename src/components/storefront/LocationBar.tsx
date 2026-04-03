"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

export function LocationBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [locationError, setLocationError] = useState<string | null>(null);

  const currentRadius = Number(searchParams.get("radius") ?? 25);
  const hasLocation = searchParams.has("lat") && searchParams.has("lng");

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("lat", position.coords.latitude.toFixed(6));
          params.set("lng", position.coords.longitude.toFixed(6));
          params.delete("offset");
          router.push(`/?${params.toString()}`);
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable it in your browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information unavailable.");
            break;
          default:
            setLocationError("Unable to get your location.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [router, searchParams, startTransition]);

  const handleRadiusChange = useCallback(
    (radius: number) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("radius", String(radius));
        params.delete("offset");
        router.push(`/?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleUseMyLocation}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
        {hasLocation ? "Update Location" : "Use My Location"}
      </button>

      <div className="flex items-center gap-1.5">
        {RADIUS_OPTIONS.map((radius) => (
          <button
            key={radius}
            onClick={() => handleRadiusChange(radius)}
            className={`px-2.5 py-1 text-sm rounded-full border transition-colors ${
              currentRadius === radius
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {radius} mi
          </button>
        ))}
      </div>

      {isPending && (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      )}

      {locationError && (
        <p className="w-full text-xs text-red-600 mt-1">{locationError}</p>
      )}
    </div>
  );
}
