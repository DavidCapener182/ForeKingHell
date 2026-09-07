import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type TournamentRulesRouteProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function TournamentRulesRoute({
  params,
  searchParams,
}: TournamentRulesRouteProps) {
  const { tournamentId } = await params;
  redirect(
    canonicalRouteHref(`/tournaments/${encodeURIComponent(tournamentId)}`, await searchParams, {
      tab: "rules",
    }),
  );
}
