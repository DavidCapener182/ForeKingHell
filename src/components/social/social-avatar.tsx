import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const className = cn(
    "shadow-sm ring-1 ring-slate-950/10",
    size === "sm" && "size-8 text-xs",
    size === "md" && "size-11 text-sm",
    size === "lg" && "size-16 text-lg",
  );
  const content = (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-[#111827] font-semibold tracking-normal text-white">
        {initials(displayName, username)}
      </AvatarFallback>
    </Avatar>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} className="shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}

export function initials(displayName: string, username?: string) {
  const source = displayName.trim() || username?.trim() || "FKH";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
