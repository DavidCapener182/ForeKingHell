import Image from "next/image";

import { BRAND_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
};

export function BrandMark({
  className,
  imageClassName,
  priority = false,
  sizes = "40px",
}: BrandMarkProps) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)} aria-hidden="true">
      <Image
        src={BRAND_LOGO_SRC}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-contain", imageClassName)}
      />
    </span>
  );
}
