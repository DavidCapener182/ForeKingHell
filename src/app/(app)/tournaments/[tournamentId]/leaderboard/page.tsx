import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type TournamentLeaderboardRouteProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function TournamentLeaderboardRoute({
  params,
  searchParams,
}: TournamentLeaderboardRouteProps) {
  const { tournamentId } = await params;
  redirect(
    canonicalRouteHref(`/tournaments/${encodeURIComponent(tournamentId)}`, await searchParams, {
      tab: "board",
    }),
  );
}
