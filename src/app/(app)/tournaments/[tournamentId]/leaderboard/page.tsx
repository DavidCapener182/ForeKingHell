import { redirect } from "next/navigation";

type TournamentLeaderboardRouteProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentLeaderboardRoute({
  params,
}: TournamentLeaderboardRouteProps) {
  const { tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}#standings`);
}
