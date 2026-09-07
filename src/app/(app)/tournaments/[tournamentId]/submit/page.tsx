import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type TournamentSubmitRouteProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function TournamentSubmitRoute({
  params,
  searchParams,
}: TournamentSubmitRouteProps) {
  const { tournamentId } = await params;
  redirect(
    canonicalRouteHref(`/tournaments/${encodeURIComponent(tournamentId)}`, await searchParams, {
      tab: "submit",
    }),
  );
}
