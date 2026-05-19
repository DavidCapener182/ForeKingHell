"use client";

import Image from "next/image";
import { useState } from "react";

import { courseLogoRoutePath } from "@/lib/course-images";
import { cn } from "@/lib/utils";

export function CourseLogoArtwork({
  courseName,
  country,
  alt,
  className,
  imageClassName,
  logoLookupEnabled = true,
  priority = false,
  sizes = "(min-width: 1024px) 320px, 100vw",
}: {
  courseName: string | null | undefined;
  country?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  logoLookupEnabled?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSrc = courseLogoRoutePath({ name: courseName, country });
  const shouldTryLogo = logoLookupEnabled && logoSrc && !logoFailed;
  const imageSrc = shouldTryLogo ? logoSrc : "/assets/page-course-records-honours.webp";

  return (
    <div
      data-media-container
      className={cn(
        "pointer-events-none relative hidden aspect-[16/9] min-h-0 overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F8FAF7] md:block",
        className,
      )}
        aria-hidden={alt === ""}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        unoptimized={Boolean(shouldTryLogo)}
        onError={shouldTryLogo ? () => setLogoFailed(true) : undefined}
        className={cn(
          shouldTryLogo
            ? "object-contain px-5 py-4 drop-shadow-sm"
            : "object-cover opacity-85 saturate-[0.92] origin-center object-[50%_50%] scale-[1.45]",
          imageClassName,
        )}
      />
      {!shouldTryLogo ? (
        <div className="absolute inset-0 bg-gradient-to-br from-white/58 via-amber-50/18 to-emerald-950/12" />
      ) : null}
      <div className="absolute inset-x-4 bottom-3 h-px bg-gradient-to-r from-transparent via-[#C7972B]/45 to-transparent" />
    </div>
  );
}
