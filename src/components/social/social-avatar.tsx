import Link from "next/link";

import { cn } from "@/lib/utils";

export function SocialAvatar({
  displayName,
  username,
  avatarUrl,
  size = "md",
  href,
}: {
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  href?: string;
}) {
  const content = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="font-semibold tracking-normal">{initials(displayName, username)}</span>
  );
  const className = cn(
    "grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/80 bg-[#111827] text-white shadow-sm ring-1 ring-slate-950/10",
    size === "sm" && "size-8 text-xs",
    size === "md" && "size-11 text-sm",
    size === "lg" && "size-16 text-lg",
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function initials(displayName: string, username?: string) {
  const source = displayName.trim() || username?.trim() || "FKH";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
