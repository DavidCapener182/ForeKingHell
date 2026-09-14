import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/brand";

export function PublicDocument({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen w-full bg-[#f5f1df] px-5 py-8 text-[#092619] sm:px-8 lg:px-[5vw] lg:py-12">
      <nav
        aria-label="Public page navigation"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#092619]/20 pb-6 text-sm font-semibold"
      >
        <Link href="/" className="mr-auto inline-flex min-h-11 items-center">
          {BRAND_NAME}
        </Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center">
          Privacy
        </Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center">
          Terms
        </Link>
        <Link href="/cookies" className="inline-flex min-h-11 items-center">
          Cookies
        </Link>
      </nav>
      <header className="grid min-w-0 gap-5 py-12 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <h1 className="min-w-0 break-words [font-family:var(--font-display-source)] text-[clamp(2.5rem,11vw,3rem)] font-bold uppercase leading-[.95] sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="self-end text-base leading-7 lg:text-lg">{description}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 [&>section]:rounded-xl [&>section]:border [&>section]:border-[#092619]/20 [&>section]:p-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_p]:text-base [&_p]:leading-7 [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
      <footer className="mt-12 flex flex-wrap gap-6 border-t border-[#092619]/20 pt-6 text-sm font-semibold">
        <Link href="/" className="inline-flex min-h-11 items-center">
          Back to the product
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center">
          Sign in or join
        </Link>
      </footer>
    </main>
  );
}
