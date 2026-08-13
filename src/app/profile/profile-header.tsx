import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProfileHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Card className={cn("gap-0 overflow-hidden", className)}>{children}</Card>;
}
