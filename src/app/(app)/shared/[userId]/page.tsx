import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getSharedAccountData } from "@/lib/shared-account-data";
import { SharedSessionLedger } from "@/app/shared/shared-session-ledger";
export const dynamic = "force-dynamic";
const numbers = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
export default async function SharedAccountPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await getSharedAccountData(userId);
  if (!data) notFound();
  const name = data.profile.name ?? data.profile.email ?? "ForeKingHell player";
  const facts = [
    [
      "Longest driver total",
      data.longestDriveYd === null ? "Not available" : `${numbers.format(data.longestDriveYd)} yd`,
      "Best eligible driver total distance across this account’s recorded shots.",
    ],
    [
      "Sessions",
      numbers.format(data.sessionCount),
      "All recorded session types; latest 20 listed below.",
    ],
    [
      "Eligible shots",
      numbers.format(data.shotCount),
      "Recorded shots that pass the existing evidence eligibility rules.",
    ],
    [
      "Shots in 30 days",
      numbers.format(data.recentShotCount),
      "Eligible shots dated within the last 30 days.",
    ],
    [
      "Active clubs",
      numbers.format(data.activeClubCount),
      "Currently active entries in this account’s bag.",
    ],
    [
      "Most used club",
      data.topClub?.clubType ?? "Not available",
      data.topClub
        ? `${numbers.format(data.topClub.count)} eligible shots across recorded history.`
        : "No eligible shot sample available.",
    ],
  ];
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <PageHeader
          title={name}
          description={`${data.accessRole} access · Read-only shared account overview. You remain signed in to your own account.`}
          actions={
            <Button asChild variant="outline">
              <Link href="/settings?section=sharing" prefetch={false}>
                Account access
              </Link>
            </Button>
          }
        />
        <p className="rounded-xl border p-4 text-sm">
          Viewing this player’s permitted account summary. This page does not edit their data,
          including when your role is editor.
        </p>
        <dl
          aria-label="Shared player summary"
          className="grid divide-y rounded-xl border sm:grid-cols-2 xl:grid-cols-3"
        >
          {facts.map(([label, value, detail]) => (
            <div key={label} className="min-w-0 p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</dd>
              <dd className="mt-2 text-sm text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
        <SharedSessionLedger
          rows={data.recentRounds.map((row) => ({ ...row, date: row.date.toISOString() }))}
          total={data.sessionCount}
        />
      </div>
    </PageShell>
  );
}
