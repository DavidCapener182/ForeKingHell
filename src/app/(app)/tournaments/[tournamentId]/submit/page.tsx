import { redirect } from "next/navigation";

type TournamentSubmitRouteProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentSubmitRoute({ params }: TournamentSubmitRouteProps) {
  const { tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}?tab=submit`);
}
