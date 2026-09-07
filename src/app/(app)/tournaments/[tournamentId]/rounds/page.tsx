import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type TournamentRoundsRouteProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function TournamentRoundsRoute({
  params,
  searchParams,
}: TournamentRoundsRouteProps) {
  const { tournamentId } = await params;
  redirect(
    canonicalRouteHref(`/tournaments/${encodeURIComponent(tournamentId)}`, await searchParams, {
      tab: "submit",
    }),
  );
}
