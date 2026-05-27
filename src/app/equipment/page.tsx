import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { count, desc, eq, sql } from "drizzle-orm";
import { Archive, ArrowLeft, Award, ChevronDown, CircleDot, Save, Wrench } from "lucide-react";

import { createBallModelAction, saveEquipmentHistoryAction } from "@/app/equipment/actions";
import { BagFeaturePanel } from "@/components/features/feature-panels";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  DataPanel,
  DataPair,
  DataTableFrame,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ballModels, clubEquipmentHistory, clubs, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type EquipmentPageProps = {
  searchParams?: Promise<{
    saved?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function EquipmentPage({ searchParams }: EquipmentPageProps) {
  const params = await searchParams;
  const [data, featureData] = await Promise.all([getEquipmentData(), getFeatureIdeasData()]);
  const activeHistory = data.history.filter((row) => row.effectiveTo === null);

  return (
    <PageShell size="7xl">
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="equipment" />

      <div data-primary-action className="sm:hidden">
        <Button
          asChild
          className="h-11 w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
        >
          <Link href="#equipment-forms" prefetch={false}>
            <Save className="size-4" />
            Add setup
          </Link>
        </Button>
      </div>

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/bag" prefetch={false}>
            <ArrowLeft className="size-4" />
            Bag
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="amber">Equipment</StatusPill>}
        title="Equipment inventory"
        description="Track club specifications and ball models over time so performance changes can be compared against equipment changes."
        visual={<PageArtwork variant="equipment" alt="" className="h-full min-h-44" priority />}
        metrics={[
          {
            label: "Clubs",
            value: data.activeClubs.length.toString(),
            detail: "Active bag records",
          },
          {
            label: "Retired clubs",
            value: data.retiredClubs.length.toString(),
            detail: "Hidden from bag and dashboard",
          },
          {
            label: "Ball models",
            value: data.ballModels.length.toString(),
            detail: "Tracked golf balls",
          },
          {
            label: "Active specs",
            value: activeHistory.length.toString(),
            detail: "Current club setups",
          },
        ]}
      />

      {params?.saved ? (
        <Alert>
          <CircleDot className="size-4" />
          <AlertTitle>Equipment saved</AlertTitle>
          <AlertDescription>
            The inventory record is available for future comparisons.
          </AlertDescription>
        </Alert>
      ) : null}

      <MobileBentoSummary
        items={[
          {
            label: "Current setup",
            value: `${data.activeClubs.length} clubs`,
            detail: `${activeHistory.length} active specs`,
            tone: "green",
          },
          {
            label: "Ball",
            value: data.ballModels[0]?.model ?? "--",
            detail: data.ballModels[0]?.brand ?? "No model",
            tone: "sky",
          },
          {
            label: "Changed",
            value: data.history.length.toString(),
            detail: "History rows",
            tone: "amber",
          },
          {
            label: "Retired",
            value: data.retiredClubs.length.toString(),
            detail: "Hidden clubs",
            tone: "slate",
          },
        ]}
      />

      <section
        aria-label="Active club highlights"
        tabIndex={0}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {data.activeClubs.slice(0, 4).map((club) => (
          <div
            key={club.id}
            className="premium-card grid min-w-[72vw] grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 p-3 sm:min-w-0"
          >
            <ClubArtwork
              clubType={club.type}
              brand={club.brand}
              model={club.model}
              alt=""
              className="h-24 rounded-xl"
              sizes="104px"
              priority
            />
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold">{formatClubType(club.type)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[club.brand, club.model].filter(Boolean).join(" ") || "Specs not recorded"}
              </p>
            </div>
          </div>
        ))}
        {data.ballModels
          .slice(0, Math.max(0, 4 - data.activeClubs.slice(0, 4).length))
          .map((ball) => (
            <div
              key={ball.id}
              className="premium-card grid min-w-[72vw] place-items-center p-3 text-center sm:min-w-0"
            >
              <div className="grid size-20 place-items-center rounded-full border border-slate-200 bg-white shadow-sm">
                <CircleDot className="size-10 text-emerald-700" />
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold">{ball.model}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ball.brand ?? "Ball model"}
                </p>
              </div>
            </div>
          ))}
      </section>

      <EquipmentSocialBadges data={data} activeHistoryCount={activeHistory.length} />

      <BagFeaturePanel data={featureData} />

      <EquipmentMobileDisclosure
        title="Add or edit equipment"
        description="Ball models and club specification forms."
      >
        <section id="equipment-forms" className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <DataPanel>
            <SectionHeader
              title="Add ball model"
              description="Use this when you switch balls and want to compare before/after launch data."
              action={<CircleDot className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <form action={createBallModelAction} className="grid gap-3">
                <FormField label="Brand" name="brand" placeholder="Titleist" />
                <FormField label="Model" name="model" placeholder="Pro V1" required />
                <Button
                  type="submit"
                  className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
                >
                  <Save className="size-4" />
                  Save ball
                </Button>
              </form>
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Add club specification"
              description="Saving a new active setup automatically closes the previous active setup for that club."
              action={<Wrench className="size-5 text-sky-600" />}
            />
            <CardContent>
              <form action={saveEquipmentHistoryAction} className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Club"
                    name="clubId"
                    values={data.activeClubs.map((club) => ({
                      value: club.id,
                      label: formatClubType(club.type),
                    }))}
                  />
                  <SelectField
                    label="Ball model"
                    name="ballModelId"
                    optionalLabel="No ball model"
                    values={data.ballModels.map((ball) => ({
                      value: ball.id,
                      label: [ball.brand, ball.model].filter(Boolean).join(" "),
                    }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <FormField label="Effective from" name="effectiveFrom" type="date" />
                  <FormField label="Loft" name="loftDeg" type="number" step="0.1" />
                  <FormField label="Lie" name="lieDeg" type="number" step="0.1" />
                  <FormField label="Swing weight" name="swingWeight" placeholder="D3" />
                </div>
                <FormField label="Shaft" name="shaft" placeholder="Project X 6.0" />
                <FormField
                  label="Notes"
                  name="notes"
                  placeholder="Grip, length, adapter setting, build notes"
                />
                <Button
                  type="submit"
                  className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
                >
                  <Save className="size-4" />
                  Save specification
                </Button>
              </form>
            </CardContent>
          </DataPanel>
        </section>
      </EquipmentMobileDisclosure>

      <EquipmentMobileDisclosure
        title="Retired equipment"
        description={`${data.retiredClubs.length} clubs`}
      >
        <DataPanel>
          <SectionHeader
            title="Retired clubs"
            description="Clubs no longer in the active bag. They are hidden from bag, dashboard, and progress views but still count for compare and historic shot totals."
            action={<Archive className="size-5 text-slate-500" />}
          />
          <CardContent>
            <RetiredClubsTable retired={data.retiredClubs} />
          </CardContent>
        </DataPanel>
      </EquipmentMobileDisclosure>

      <EquipmentMobileDisclosure
        title="Equipment history"
        description={`${data.history.length} setup rows`}
      >
        <DataPanel>
          <SectionHeader
            title="Equipment history"
            description="A timeline of club and ball setups used by the account."
          />
          <CardContent>
            <EquipmentHistoryTable history={data.history} />
          </CardContent>
        </DataPanel>
      </EquipmentMobileDisclosure>
    </PageShell>
  );
}

function EquipmentMobileDisclosure({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group sm:contents">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/92 px-3 py-2 text-sm shadow-sm sm:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block truncate font-semibold tracking-normal">{title}</span>
          {description ? (
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="hidden group-open:block sm:contents">{children}</div>
    </details>
  );
}

function EquipmentSocialBadges({
  data,
  activeHistoryCount,
}: {
  data: Awaited<ReturnType<typeof getEquipmentData>>;
  activeHistoryCount: number;
}) {
  const mostUsedClub = data.activeClubs
    .map((club) => ({
      club,
      shotCount: data.shotStatsByClubId.get(club.id)?.shotCount ?? 0,
    }))
    .sort((left, right) => right.shotCount - left.shotCount)[0];

  return (
    <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
      <div className="rounded-xl border bg-slate-50 p-3">
        <Badge variant="secondary" className="gap-1">
          <Award className="size-3" />
          Most trusted club
        </Badge>
        <p className="mt-3 text-xl font-semibold tracking-normal">
          {mostUsedClub ? formatClubType(mostUsedClub.club.type) : "--"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {mostUsedClub
            ? `${mostUsedClub.shotCount.toLocaleString("en-GB")} tracked shots`
            : "Import shots to earn equipment badges."}
        </p>
      </div>
      <div className="rounded-xl border bg-slate-50 p-3">
        <Badge variant="outline">New equipment test</Badge>
        <p className="mt-3 text-xl font-semibold tracking-normal">
          {activeHistoryCount} active specs
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use history rows to compare before and after performance.
        </p>
      </div>
      <div className="rounded-xl border bg-slate-50 p-3">
        <Badge variant="outline">Before / after</Badge>
        <p className="mt-3 text-xl font-semibold tracking-normal">
          {data.history.length} setup rows
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Equipment comparisons stay private unless you share a feed card.
        </p>
      </div>
    </section>
  );
}

function RetiredClubsTable({ retired }: { retired: RetiredClub[] }) {
  return (
    <DataTableFrame
      mobile={
        <MobileDataList
          empty={
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No retired clubs.
            </p>
          }
        >
          {retired.map((club) => (
            <MobileDataCard
              key={club.id}
              title={formatClubType(club.type)}
              subtitle={[club.brand, club.model].filter(Boolean).join(" ") || "Unknown brand"}
              action={<StatusPill tone="slate">Retired</StatusPill>}
            >
              <DataPair label="Shots" value={club.shotCount.toLocaleString("en-GB")} />
              <DataPair
                label="Last shot"
                value={club.lastShotAt instanceof Date ? formatDate(club.lastShotAt) : "--"}
              />
            </MobileDataCard>
          ))}
        </MobileDataList>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead>Brand / model</TableHead>
            <TableHead className="text-right">Shots</TableHead>
            <TableHead>Last shot</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {retired.length > 0 ? (
            retired.map((club) => (
              <TableRow key={club.id}>
                <TableCell className="font-medium">{formatClubType(club.type)}</TableCell>
                <TableCell>
                  {[club.brand, club.model].filter(Boolean).join(" ") || "Unknown brand"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {club.shotCount.toLocaleString("en-GB")}
                </TableCell>
                <TableCell>
                  {club.lastShotAt instanceof Date ? formatDate(club.lastShotAt) : "--"}
                </TableCell>
                <TableCell>
                  <StatusPill tone="slate">Retired</StatusPill>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No retired clubs.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

async function getEquipmentData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [clubRows, ballRows, historyRows, shotCountRows] = await Promise.all([
    db.select().from(clubs).where(eq(clubs.userId, userId)),
    db
      .select()
      .from(ballModels)
      .where(eq(ballModels.userId, userId))
      .orderBy(desc(ballModels.createdAt)),
    db
      .select({
        id: clubEquipmentHistory.id,
        clubType: clubs.type,
        ballBrand: ballModels.brand,
        ballModel: ballModels.model,
        effectiveFrom: clubEquipmentHistory.effectiveFrom,
        effectiveTo: clubEquipmentHistory.effectiveTo,
        loftDeg: clubEquipmentHistory.loftDeg,
        lieDeg: clubEquipmentHistory.lieDeg,
        shaft: clubEquipmentHistory.shaft,
        swingWeight: clubEquipmentHistory.swingWeight,
        notes: clubEquipmentHistory.notes,
      })
      .from(clubEquipmentHistory)
      .leftJoin(clubs, eq(clubs.id, clubEquipmentHistory.clubId))
      .leftJoin(ballModels, eq(ballModels.id, clubEquipmentHistory.ballModelId))
      .where(eq(clubEquipmentHistory.userId, userId))
      .orderBy(desc(clubEquipmentHistory.effectiveFrom)),
    db
      .select({
        clubId: shots.clubId,
        shotCount: count(),
        lastShotAt: sql<Date | null>`max(${shots.shotAt})`,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.clubId),
  ]);

  const shotStatsByClubId = new Map(
    shotCountRows.map((row) => [
      row.clubId,
      { shotCount: row.shotCount, lastShotAt: row.lastShotAt },
    ]),
  );
  const retiredClubs = clubRows
    .filter((club) => !club.active)
    .map((club) => ({
      ...club,
      shotCount: shotStatsByClubId.get(club.id)?.shotCount ?? 0,
      lastShotAt: shotStatsByClubId.get(club.id)?.lastShotAt ?? null,
    }))
    .sort((left, right) => {
      const leftTime = left.lastShotAt instanceof Date ? left.lastShotAt.getTime() : 0;
      const rightTime = right.lastShotAt instanceof Date ? right.lastShotAt.getTime() : 0;
      return rightTime - leftTime || left.type.localeCompare(right.type);
    });
  const activeClubs = clubRows.filter((club) => club.active);

  return {
    clubs: clubRows,
    activeClubs,
    retiredClubs,
    ballModels: ballRows,
    history: historyRows,
    shotStatsByClubId,
  };
}

type RetiredClub = Awaited<ReturnType<typeof getEquipmentData>>["retiredClubs"][number];

function EquipmentHistoryTable({
  history,
}: {
  history: Awaited<ReturnType<typeof getEquipmentData>>["history"];
}) {
  return (
    <DataTableFrame
      mobile={
        <MobileDataList
          empty={
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No equipment history yet.
            </p>
          }
        >
          {history.map((row) => (
            <MobileDataCard
              key={row.id}
              title={formatClubType(row.clubType ?? "")}
              subtitle={`${formatDate(row.effectiveFrom)} - ${row.effectiveTo ? formatDate(row.effectiveTo) : "current"}`}
              action={
                <StatusPill tone={row.effectiveTo ? "slate" : "green"}>
                  {row.effectiveTo ? "Retired" : "Active"}
                </StatusPill>
              }
            >
              <DataPair label="Ball" value={formatBall(row.ballBrand, row.ballModel)} />
              <DataPair
                label="Loft / lie"
                value={`${formatNumber(row.loftDeg)} / ${formatNumber(row.lieDeg)}`}
              />
              <DataPair label="Shaft" value={row.shaft ?? "--"} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Ball</TableHead>
            <TableHead>Loft / lie</TableHead>
            <TableHead>Shaft</TableHead>
            <TableHead>Swing weight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.length > 0 ? (
            history.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{formatClubType(row.clubType ?? "")}</TableCell>
                <TableCell>
                  {formatDate(row.effectiveFrom)} -{" "}
                  {row.effectiveTo ? formatDate(row.effectiveTo) : "current"}
                </TableCell>
                <TableCell>{formatBall(row.ballBrand, row.ballModel)}</TableCell>
                <TableCell>
                  {formatNumber(row.loftDeg)} / {formatNumber(row.lieDeg)}
                </TableCell>
                <TableCell>{row.shaft ?? "--"}</TableCell>
                <TableCell>{row.swingWeight ?? "--"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No equipment history yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

function FormField({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & ComponentProps<typeof Input>) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input name={name} className="h-10 rounded-xl bg-white" {...props} />
    </label>
  );
}

function SelectField({
  label,
  name,
  values,
  optionalLabel,
}: {
  label: string;
  name: string;
  values: Array<{ value: string; label: string }>;
  optionalLabel?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        required={!optionalLabel}
        className="h-10 rounded-xl border bg-white px-3 text-sm"
      >
        {optionalLabel ? <option value="">{optionalLabel}</option> : null}
        {values.map((value) => (
          <option key={value.value} value={value.value}>
            {value.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

function formatBall(brand: string | null, model: string | null) {
  return [brand, model].filter(Boolean).join(" ") || "--";
}
