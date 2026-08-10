import { redirect } from "next/navigation";

type TournamentRoundsRouteProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentRoundsRoute({ params }: TournamentRoundsRouteProps) {
  const { tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}?tab=submit`);
}
