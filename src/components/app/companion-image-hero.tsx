import Image from "next/image";

import { cn } from "@/lib/utils";

type CompanionImageHeroVariant = "today" | "practice" | "play" | "sessions";

const heroByVariant: Record<CompanionImageHeroVariant, { src: string; imageClassName: string }> = {
  today: {
    src: "/assets/companion/today-hero.avif",
    imageClassName: "object-[50%_57%]",
  },
  practice: {
    src: "/assets/companion/practice-hero.avif",
    imageClassName: "object-[58%_58%]",
  },
  play: {
    src: "/assets/generated/course-twin-premium-desktop.webp",
    imageClassName: "object-[50%_52%]",
  },
  sessions: {
    src: "/assets/companion/sessions-hero.avif",
    imageClassName: "object-[50%_45%]",
  },
};

export function CompanionImageHero({
  variant,
  label,
  alt,
  className,
}: {
  variant: CompanionImageHeroVariant;
  label: string;
  alt: string;
  className?: string;
}) {
  const hero = heroByVariant[variant];

  return (
    <section
      data-companion-image-hero={variant}
      className={cn(
        "relative h-20 overflow-hidden rounded-[1.25rem] border border-white/10 bg-black shadow-sm min-[376px]:h-24 min-[430px]:h-28",
        className,
      )}
    >
      <Image
        src={hero.src}
        alt={alt}
        fill
        priority
        unoptimized
        sizes="calc(100vw - 2rem)"
        className={cn("object-cover", hero.imageClassName)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
      <p className="absolute bottom-2.5 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
        {label}
      </p>
    </section>
  );
}
