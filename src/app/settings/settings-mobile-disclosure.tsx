"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type SettingsMobileDisclosureProps = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function SettingsMobileDisclosure({
  id,
  title,
  description,
  children,
  defaultOpen = false,
}: SettingsMobileDisclosureProps) {
  const generatedId = useId().replaceAll(":", "");
  const contentId = `${id ?? `settings-${generatedId}`}-content`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!id) return;

    const openHashTarget = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      });
    };

    openHashTarget();
    window.addEventListener("hashchange", openHashTarget);
    return () => window.removeEventListener("hashchange", openHashTarget);
  }, [id]);

  return (
    <section id={id} className="scroll-mt-28 lg:contents">
      <button
        type="button"
        className="ios-grouped-list ios-grouped-row focus-aaa flex min-h-14 w-full touch-manipulation items-center justify-between gap-3 px-4 py-2.5 text-left outline-none lg:hidden"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-5 tracking-normal">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <div id={contentId} className={`${open ? "block" : "hidden"} pt-2 lg:contents`}>
        {children}
      </div>
    </section>
  );
}
