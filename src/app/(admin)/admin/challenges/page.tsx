import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Flag, ListChecks, Target, Trophy } from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  AdminMetric,
  AdminNav,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  StatusBadge,
} from "@/app/admin/admin-components";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminChallengesData } from "@/lib/admin";

export const dynamic = "force-dynamic";

const adminChallengeColumns: DesktopWorkbenchColumn[] = [
  { id: "challenge", label: "Challenge", locked: true },
  { id: "owner", label: "Owner" },
  { id: "status", label: "Status" },
  { id: "participation", label: "Participation" },
  { id: "ends", label: "Ends" },
  { id: "action", label: "Action", locked: true },
];

const adminChallengeSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Open challenge boards",
    href: "/admin/challenges",
    detail: "Monitor live challenge participation and attempts.",
  },
  {
    title: "Moderation follow-up",
    href: "/admin/moderation",
    detail: "Review safety records before promoting a board.",
  },
  {
    title: "Public challenge centre",
    href: "/challenges",
    detail: "Open the participant-facing challenge workspace.",
  },
];

type AdminChallengesPageProps = {
  searchParams?: Promise<{
    sort?: string;
    dir?: string;
  }>;
};

type AdminChallengesData = Awaited<ReturnType<typeof getAdminChallengesData>>;
type AdminChallengeBoard = AdminChallengesData["challenges"][number];
type AdminChallengeSortMetric = "challenge" | "owner" | "status" | "participation" | "ends";
type AdminChallengeSortDirection = "asc" | "desc";
type AdminChallengeSortState = {
  metric: AdminChallengeSortMetric;
  dir: AdminChallengeSortDirection;
};

const adminChallengeSortLabels: Record<AdminChallengeSortMetric, string> = {
  challenge: "Challenge",
  owner: "Owner",
  status: "Status",
  participation: "Participation",
  ends: "Ends",
};

const adminChallengeSortDefaultDirections: Record<
  AdminChallengeSortMetric,
  AdminChallengeSortDirection
> = {
  challenge: "asc",
  owner: "asc",
  status: "asc",
  participation: "desc",
  ends: "asc",
};

export default async function AdminChallengesPage({ searchParams }: AdminChallengesPageProps) {
  const params = await searchParams;
  const sortState = parseAdminChallengeSort(params?.sort, params?.dir);
  const data = await getAdminChallengesData();
  const sortedChallenges = sortAdminChallenges(data.challenges, sortState);
  const openChallenges = data.challenges.filter((challenge) => challenge.status === "open");
  const totalEntries = data.challenges.reduce((sum, challenge) => sum + challenge.entryCount, 0);
  const totalAttempts = data.challenges.reduce((sum, challenge) => sum + challenge.attemptCount, 0);

  return (
    <PageShell>
      <MobileRouteHeader title="Platform" group="platform" activeKey="admin" />
      <AdminNav active="/admin/challenges" />

      <DesktopWorkbenchLayout scope="admin-challenges">
        <AdminPageHeader
          eyebrow="Admin challenges"
          title="Challenges and tournaments"
          description="Monitor challenge templates, active boards, participation, attempts and calculated results."
          tone="amber"
        />

        <section className="grid gap-3 md:grid-cols-4">
          <AdminMetric
            icon={ListChecks}
            label="Templates"
            value={data.templates.length}
            detail="Challenge formats"
          />
          <AdminMetric
            icon={Trophy}
            label="Challenges"
            value={data.challenges.length}
            detail={`${openChallenges.length} open`}
          />
          <AdminMetric
            icon={Flag}
            label="Entries"
            value={totalEntries}
            detail="Joined participants"
          />
          <AdminMetric
            icon={Target}
            label="Attempts"
            value={totalAttempts}
            detail="Submitted scores"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <AdminSection
            title="Templates"
            description="Seeded formats available to public and private challenges."
          >
            <div className="grid gap-2">
              {data.templates.map((template) => (
                <div key={template.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {template.description ?? "No description"}
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {label(template.challengeType)}
                  </p>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection
            title="Challenge boards"
            description="Open the public challenge page for creation and participant-facing operations."
            action={
              <Button asChild variant="outline">
                <Link href="/challenges">Open challenges</Link>
              </Button>
            }
          >
            <div>
              <DesktopTableWorkbenchControls
                viewKey="admin-challenges"
                scope="admin-challenges"
                currentViewLabel="Admin challenge boards"
                resultLabel={`${data.challenges.length.toLocaleString("en-GB")} boards`}
                columns={adminChallengeColumns}
                suggestedViews={adminChallengeSuggestedViews}
                exportTableId="admin-challenges"
                exportFileName="forekinghell-admin-challenges-view.csv"
                className="mb-3"
              />
              <DataTableFrame
                mainTable
                mainTableLabel="Challenge boards table"
                stickyFirstColumn
                className="overflow-x-auto"
              >
                <table
                  className="w-full min-w-[860px] text-left text-sm"
                  data-workbench-scope="admin-challenges"
                  data-workbench-export-table="admin-challenges"
                  aria-describedby="admin-challenges-table-summary"
                >
                  <caption id="admin-challenges-table-summary" className="sr-only">
                    Admin challenge boards with owner, status, participation, end date and action.
                  </caption>
                  <thead className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <tr>
                      <SortableAdminChallengeHead
                        columnId="challenge"
                        metric="challenge"
                        sortState={sortState}
                        className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      />
                      <SortableAdminChallengeHead
                        columnId="owner"
                        metric="owner"
                        sortState={sortState}
                      />
                      <SortableAdminChallengeHead
                        columnId="status"
                        metric="status"
                        sortState={sortState}
                      />
                      <SortableAdminChallengeHead
                        columnId="participation"
                        metric="participation"
                        sortState={sortState}
                      />
                      <SortableAdminChallengeHead
                        columnId="ends"
                        metric="ends"
                        sortState={sortState}
                      />
                      <th data-column="action" className="px-3 py-2 font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedChallenges.map((challenge) => (
                      <tr
                        key={challenge.id}
                        tabIndex={0}
                        className="focus-aaa border-b outline-none last:border-b-0"
                      >
                        <td
                          data-column="challenge"
                          className="sticky left-0 z-10 bg-white px-3 py-3 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          <p className="font-medium">{challenge.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {challenge.templateName}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{label(challenge.visibility)}</Badge>
                          </div>
                        </td>
                        <td data-column="owner" className="px-3 py-3">
                          <p className="font-medium">{challenge.creatorDisplayName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {challenge.creatorEmail ?? "No email"}
                          </p>
                        </td>
                        <td data-column="status" className="px-3 py-3">
                          <StatusBadge status={challenge.status} />
                        </td>
                        <td data-column="participation" className="px-3 py-3 text-muted-foreground">
                          {challenge.entryCount} entries · {challenge.attemptCount} attempts ·{" "}
                          {challenge.resultCount} results
                        </td>
                        <td data-column="ends" className="px-3 py-3 text-xs text-muted-foreground">
                          {formatDateTime(challenge.endsAt)}
                        </td>
                        <td data-column="action" className="px-3 py-3">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/challenges/${challenge.id}`}>Open</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableFrame>
            </div>
          </AdminSection>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SortableAdminChallengeHead({
  className,
  columnId,
  metric,
  sortState,
}: {
  className?: string;
  columnId: string;
  metric: AdminChallengeSortMetric;
  sortState: AdminChallengeSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <th
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminChallengeSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminChallengeHeadLink metric={metric} sortState={sortState} />
    </th>
  );
}

function SortableAdminChallengeHeadLink({
  metric,
  sortState,
}: {
  metric: AdminChallengeSortMetric;
  sortState: AdminChallengeSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: AdminChallengeSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : adminChallengeSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = adminChallengeSortLabels[metric];

  return (
    <a
      href={`/admin/challenges?sort=${metric}&dir=${nextDir}`}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin challenges by ${label}, ${adminChallengeSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </a>
  );
}

function sortAdminChallenges(
  challenges: AdminChallengeBoard[],
  sortState: AdminChallengeSortState,
) {
  return [...challenges].sort((left, right) => {
    const result = compareAdminChallengeValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareAdminChallengeStrings(left.title, right.title, "asc");
  });
}

function compareAdminChallengeValues(
  left: AdminChallengeBoard,
  right: AdminChallengeBoard,
  sortState: AdminChallengeSortState,
) {
  switch (sortState.metric) {
    case "challenge":
      return compareAdminChallengeStrings(left.title, right.title, sortState.dir);
    case "owner":
      return compareAdminChallengeStrings(
        left.creatorDisplayName,
        right.creatorDisplayName,
        sortState.dir,
      );
    case "status":
      return compareAdminChallengeNumbers(
        challengeStatusSortWeight(left.status),
        challengeStatusSortWeight(right.status),
        sortState.dir,
      );
    case "participation":
      return compareAdminChallengeNumbers(
        challengeParticipationTotal(left),
        challengeParticipationTotal(right),
        sortState.dir,
      );
    case "ends":
      return compareNullableAdminChallengeDates(left.endsAt, right.endsAt, sortState.dir);
  }
}

function challengeParticipationTotal(challenge: AdminChallengeBoard) {
  return challenge.entryCount + challenge.attemptCount + challenge.resultCount;
}

function challengeStatusSortWeight(status: string) {
  if (status === "open") return 4;
  if (status === "scheduled") return 3;
  if (status === "completed") return 2;
  if (status === "cancelled") return 1;
  return 0;
}

function compareAdminChallengeNumbers(
  left: number,
  right: number,
  dir: AdminChallengeSortDirection,
) {
  return dir === "asc" ? left - right : right - left;
}

function compareNullableAdminChallengeDates(
  left: Date | null,
  right: Date | null,
  dir: AdminChallengeSortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareAdminChallengeNumbers(left.getTime(), right.getTime(), dir);
}

function compareAdminChallengeStrings(
  left: string | null,
  right: string | null,
  dir: AdminChallengeSortDirection,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function parseAdminChallengeSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): AdminChallengeSortState {
  const metric = parseAdminChallengeSortMetric(metricValue);

  return {
    metric,
    dir: parseAdminChallengeSortDirection(dirValue, adminChallengeSortDefaultDirections[metric]),
  };
}

function parseAdminChallengeSortMetric(value: string | undefined): AdminChallengeSortMetric {
  if (
    value === "challenge" ||
    value === "owner" ||
    value === "status" ||
    value === "participation" ||
    value === "ends"
  ) {
    return value;
  }

  return "challenge";
}

function parseAdminChallengeSortDirection(
  value: string | undefined,
  fallback: AdminChallengeSortDirection,
): AdminChallengeSortDirection {
  return value === "asc" || value === "desc" ? value : fallback;
}

function adminChallengeSortAriaValue(dir: AdminChallengeSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function adminChallengeSortDirectionCopy(
  metric: AdminChallengeSortMetric,
  dir: AdminChallengeSortDirection,
) {
  if (metric === "challenge" || metric === "owner") {
    return dir === "asc" ? "A to Z" : "Z to A";
  }

  if (metric === "ends") {
    return dir === "asc" ? "soonest first" : "latest first";
  }

  return dir === "desc" ? "high to low" : "low to high";
}
