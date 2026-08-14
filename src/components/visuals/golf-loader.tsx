import Image from "next/image";

import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function GolfLoader({
  label = `Loading ${BRAND_NAME}`,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "premium-card mx-auto grid max-w-sm place-items-center gap-4 p-6 text-center",
        className,
      )}
    >
      <div data-loader-art className="relative h-32 w-full max-w-[260px]" aria-hidden="true">
        <Image
          src="/assets/loader-golfer.png"
          alt=""
          fill
          priority
          sizes="260px"
          className="object-contain drop-shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">Preparing your golf data.</p>
      </div>
    </div>
  );
}
