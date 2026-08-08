"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const achievementArtworkPath = "/assets/page-achievements-hero.webp";

export function AchievementArtwork({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={cn(
        "pointer-events-none relative hidden min-h-40 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 shadow-sm md:block",
        className,
      )}
      aria-hidden="true"
    >
      {!imageFailed ? (
        <>
          <Image
            src={achievementArtworkPath}
            alt=""
            fill
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            sizes="(min-width: 1280px) 420px, (min-width: 768px) 320px, 0px"
            className="object-cover opacity-95 saturate-[0.96]"
            onError={() => setImageFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/45 via-white/10 to-amber-50/10" />
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-slate-500">
          <ImageIcon className="size-10 opacity-40" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">Achievements artwork</p>
          <p className="text-xs">
            Drop your image at{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">
              public/assets/page-achievements-hero.webp
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
