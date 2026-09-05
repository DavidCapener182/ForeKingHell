import Link from "next/link";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { MobileLargeTitle } from "@/components/app/mobile-screen";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { RouteNotFoundState } from "@/components/route-state";

export default async function SessionNotFound() {
  if ((await getRequestAppSurface()) !== "companion") return <RouteNotFoundState />;
  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-mobile-session-not-found>
        <MobileLargeTitle
          title="Session unavailable"
          detail="Open your golf history to find a saved session."
        />
        <Button asChild className="min-h-12">
          <Link href="/sessions">Open golf history</Link>
        </Button>
      </MobileAppShell>
    </PageShell>
  );
}
