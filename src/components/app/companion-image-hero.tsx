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
  title,
  label,
  alt,
  className,
}: {
  variant: CompanionImageHeroVariant;
  title: string;
  label: string;
  alt: string;
  className?: string;
}) {
  const hero = heroByVariant[variant];

  return (
    <section
      data-companion-image-hero={variant}
      className={cn(
        "relative -mx-4 h-32 shrink-0 overflow-hidden rounded-none rounded-b-[1.5rem] border-x-0 border-b border-t-0 border-white/10 bg-black shadow-sm sm:-mx-6",
        className,
      )}
    >
      <Image
        src={hero.src}
        alt={alt}
        fill
        sizes="100vw"
        className={cn(
          "scale-[1.02] object-cover brightness-[0.62] saturate-[0.9]",
          hero.imageClassName,
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/30" />
      <div className="absolute inset-x-0 bottom-0 grid gap-1.5 p-4">
        <p
          data-companion-hero-glass
          className="w-fit max-w-full truncate rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/95 shadow-sm backdrop-blur-xl"
        >
          {label}
        </p>
        <h1 className="max-w-[19rem] text-2xl font-bold leading-none tracking-[-0.02em] text-white drop-shadow-sm">
          {title}
        </h1>
      </div>
    </section>
  );
}
