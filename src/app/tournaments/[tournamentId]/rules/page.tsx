import { redirect } from "next/navigation";

type TournamentRulesRouteProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentRulesRoute({ params }: TournamentRulesRouteProps) {
  const { tournamentId } = await params;
  redirect(`/tournaments/${tournamentId}#rules`);
}
