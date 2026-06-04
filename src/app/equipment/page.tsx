import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { count, desc, eq, sql } from "drizzle-orm";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Gauge,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";

import {
  createBallModelAction,
  retireClubAction,
  saveEquipmentHistoryAction,
} from "@/app/equipment/actions";
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
  type Tone,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { clubSortValue, formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import {
  calculateStockCarryTrend,
  calculateStockYardage,
  type StockCarryTrend,
  type StockShot,
  type StockYardage,
} from "@/lib/stock-yardage";

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
const compactDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export default async function EquipmentPage({ searchParams }: EquipmentPageProps) {
  const params = await searchParams;
  const [data, featureData] = await Promise.all([getEquipmentData(), getFeatureIdeasData()]);
  const activeHistory = data.history.filter((row) => row.effectiveTo === null);
  const intelligence = buildEquipmentIntelligence(data);

  return (
    <PageShell>
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
        eyebrow={<StatusPill tone="sky">Equipment centre</StatusPill>}
        title="My Bag"
        description="See whether the current setup is helping your golf, where the weak window is, and what upgrade would move the bag first."
        visual={<PageArtwork variant="equipment" alt="" className="h-full min-h-36" priority />}
        metrics={[
          {
            label: "Bag fit",
            value: `${intelligence.bagFitScore}%`,
            detail: intelligence.nextUpgrade
              ? `Next: ${intelligence.nextUpgrade}`
              : "Current setup coverage",
          },
          {
            label: "Confidence",
            value: `${intelligence.averageConfidence}%`,
            detail: intelligence.bestClub
              ? `${formatClubType(intelligence.bestClub.club.type)} is most trusted`
              : "Need shot samples",
          },
          {
            label: "Strength",
            value: intelligence.strength.label,
            detail: intelligence.strength.detail,
          },
          {
            label: "Weakness",
            value: intelligence.weakness.label,
            detail: intelligence.weakness.detail,
          },
        ]}
      />

      {params?.saved ? (
        <Alert>
          <CircleDot className="size-4" />
          <AlertTitle>{params.saved === "retired" ? "Club retired" : "Equipment saved"}</AlertTitle>
          <AlertDescription>
            {params.saved === "retired"
              ? "The club is hidden from the active bag, but its historic shots remain available for comparison."
              : "The setup is now part of your bag intelligence and future before/after comparisons."}
          </AlertDescription>
        </Alert>
      ) : null}

      <MobileBentoSummary
        items={[
          {
            label: "Current setup",
            value: intelligence.primarySetupLabel,
            detail: `${data.activeClubs.length} clubs tracked`,
            tone: "green",
          },
          {
            label: "Bag fit",
            value: `${intelligence.bagFitScore}%`,
            detail: intelligence.fitDetail,
            tone: "sky",
          },
          {
            label: "Weak window",
            value: intelligence.weakness.label,
            detail: intelligence.weakness.detail,
            tone: "amber",
          },
          {
            label: "Next move",
            value: intelligence.nextUpgrade ?? "Build sample",
            detail: intelligence.nextUpgradeDetail,
            tone: "slate",
          },
        ]}
      />

      <CurrentSetupStrip setup={intelligence.setup} ballModel={data.ballModels[0] ?? null} />
      <CurrentBagScorePanel intelligence={intelligence} />
      <BagFeaturePanel data={featureData} />
      <ClubIntelligenceSection profiles={intelligence.activeProfiles} />
      <BagTimelineSection profiles={intelligence.activeProfiles} />
      <EquipmentImpactSection impacts={intelligence.impacts} />
      <BagBuilderSection scenarios={intelligence.builderScenarios} />

      {intelligence.retiredProfiles.length > 0 ? (
        <ClubHistorySection
          retiredProfiles={intelligence.retiredProfiles}
          activeProfiles={intelligence.activeProfiles}
        />
      ) : null}

      <EquipmentMobileDisclosure
        title="Add or edit setup"
        description="Ball models, specs and retire controls."
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

      {data.retiredClubs.length > 0 ? (
        <EquipmentMobileDisclosure title="Retired equipment" description="Historic club records">
          <DataPanel>
            <SectionHeader
              title="Retired clubs"
              description="Clubs no longer in the active bag. Historic shots stay available for before/after comparisons."
              action={<Archive className="size-5 text-slate-500" />}
            />
            <CardContent>
              <RetiredClubsTable retired={data.retiredClubs} />
            </CardContent>
          </DataPanel>
        </EquipmentMobileDisclosure>
      ) : null}

      {activeHistory.length > 0 || data.history.some((row) => row.effectiveTo !== null) ? (
        <EquipmentMobileDisclosure title="Setup history" description="Specification timeline">
          <DataPanel>
            <SectionHeader
              title="Setup history"
              description="A timeline of club and ball setups used by the account."
            />
            <CardContent>
              <EquipmentHistoryTable history={data.history} />
            </CardContent>
          </DataPanel>
        </EquipmentMobileDisclosure>
      ) : null}
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

function CurrentSetupStrip({
  setup,
  ballModel,
}: {
  setup: EquipmentSetupItem[];
  ballModel: EquipmentData["ballModels"][number] | null;
}) {
  if (setup.length === 0 && !ballModel) {
    return null;
  }

  return (
    <section
      aria-label="Current setup"
      tabIndex={0}
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5"
    >
      {setup.map((item) => {
        const primaryClub = item.profiles[0]?.club;

        return (
          <div key={item.key} className="premium-card grid min-w-[76vw] gap-3 p-3 sm:min-w-0">
            <ClubArtwork
              clubType={primaryClub?.type}
              alt=""
              source="generated-v2"
              className="h-28 rounded-lg"
              imageClassName="px-4 py-2"
              sizes="(min-width: 1280px) 210px, (min-width: 640px) 28vw, 70vw"
              priority
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-normal">{item.label}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.model}</p>
              </div>
              <StatusPill tone={item.tone}>{item.confidenceLabel}</StatusPill>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{item.detail}</p>
          </div>
        );
      })}
      {ballModel ? (
        <div className="premium-card grid min-w-[76vw] gap-3 p-3 sm:min-w-0">
          <div className="grid h-28 place-items-center rounded-lg border border-slate-200 bg-white shadow-inner">
            <div className="grid size-20 place-items-center rounded-full border border-slate-200 bg-white shadow-sm">
              <CircleDot className="size-10 text-emerald-700" />
            </div>
          </div>
          <div>
            <p className="text-base font-semibold tracking-normal">Ball</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[ballModel.brand, ballModel.model].filter(Boolean).join(" ")}
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Current ball model for setup comparisons.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CurrentBagScorePanel({ intelligence }: { intelligence: EquipmentIntelligence }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Current bag score"
        description="The quick read on what is trusted, what is weak, and which equipment move improves the setup first."
        action={
          <StatusPill tone={intelligence.bagFitTone}>
            Bag fit {intelligence.bagFitScore}%
          </StatusPill>
        }
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Gauge className="size-4" />
            Bag fit
          </div>
          <p className="mt-3 text-5xl font-semibold tracking-normal text-emerald-950">
            {intelligence.bagFitScore}%
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900/75">{intelligence.fitDetail}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <DataPair label="Confidence" value={`${intelligence.averageConfidence}%`} />
            <DataPair label="Trusted clubs" value={intelligence.trustedCount.toString()} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <EquipmentSignalCard
            icon={<ShieldCheck className="size-4" />}
            label="Strength"
            value={intelligence.strength.label}
            detail={intelligence.strength.detail}
            tone={intelligence.strength.tone}
          />
          <EquipmentSignalCard
            icon={<Target className="size-4" />}
            label="Weakness"
            value={intelligence.weakness.label}
            detail={intelligence.weakness.detail}
            tone={intelligence.weakness.tone}
          />
          <EquipmentSignalCard
            icon={<Sparkles className="size-4" />}
            label="Next upgrade"
            value={intelligence.nextUpgrade ?? "Build sample"}
            detail={intelligence.nextUpgradeDetail}
            tone="sky"
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function EquipmentSignalCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={`grid gap-3 rounded-lg border bg-white p-3 ${toneBorderClass(tone)}`}>
      <div
        className={`flex items-center gap-2 text-xs font-semibold uppercase ${toneTextClass(tone)}`}
      >
        {icon}
        {label}
      </div>
      <div>
        <p className="text-xl font-semibold tracking-normal">{value}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ClubIntelligenceSection({ profiles }: { profiles: ClubProfile[] }) {
  return (
    <DataPanel id="clubs">
      <SectionHeader
        title="Club intelligence"
        description="Each club now shows its course number, confidence and current miss instead of just brand and model."
        action={<TrendingUp className="size-5 text-emerald-700" />}
      />
      <CardContent className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 pt-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-4 lg:grid-cols-3 xl:grid-cols-4">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Link
              key={profile.club.id}
              href={`/bag/${profile.club.id}`}
              prefetch={false}
              className="premium-card block min-w-[78vw] overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-emerald-300 sm:min-w-0"
            >
              <ClubArtwork
                clubType={profile.club.type}
                alt=""
                source="generated-v2"
                className="h-32 rounded-none border-0 border-b"
                imageClassName="px-5 py-3"
                sizes="(min-width: 1280px) 280px, (min-width: 640px) 42vw, 78vw"
              />
              <div className="grid gap-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-normal">
                      {formatClubType(profile.club.type)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {profile.equipmentName}
                    </p>
                  </div>
                  <StatusPill tone={profile.statusTone}>{profile.statusLabel}</StatusPill>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DataPair label="Carry" value={profile.carryLabel} />
                  <DataPair label="Confidence" value={`${profile.confidence}%`} />
                </div>
                <p className="text-sm leading-5 text-muted-foreground">{profile.missLabel}</p>
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Add clubs or import shots to build club intelligence.
          </p>
        )}
      </CardContent>
    </DataPanel>
  );
}

function BagTimelineSection({ profiles }: { profiles: ClubProfile[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Bag timeline"
        description="Current clubs ordered like a bag, with performance state and maintenance actions kept together."
        action={<CalendarDays className="size-5 text-sky-700" />}
      />
      <CardContent className="grid gap-2">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <div
              key={profile.club.id}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.7fr))_auto] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ClubArtwork
                  clubType={profile.club.type}
                  alt=""
                  source="generated-v2"
                  className="h-16 w-24 shrink-0 rounded-md"
                  imageClassName="px-2 py-1.5"
                  sizes="96px"
                  showGroundLine={false}
                />
                <div className="min-w-0">
                  <p className="font-semibold tracking-normal">
                    {formatClubType(profile.club.type)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{profile.equipmentName}</p>
                </div>
              </div>
              <DataPair label="Shots" value={profile.shotCount.toLocaleString("en-GB")} />
              <DataPair
                label="Added"
                value={profile.addedAt ? compactDateFormatter.format(profile.addedAt) : "--"}
              />
              <DataPair label="Performance" value={profile.performanceLabel} />
              <DataPair label="Carry" value={profile.carryLabel} />
              <RetireClubForm club={profile.club as ActiveClub} />
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No active clubs in the bag yet.
          </p>
        )}
      </CardContent>
    </DataPanel>
  );
}

function EquipmentImpactSection({ impacts }: { impacts: EquipmentImpact[] }) {
  if (impacts.length === 0) {
    return null;
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Equipment intelligence"
        description="Before/after signals answer whether the club has actually changed performance."
        action={<ShieldCheck className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {impacts.slice(0, 4).map((impact) => (
          <div
            key={`${impact.clubLabel}-${impact.equipmentName}-${impact.addedLabel}`}
            className={`grid gap-3 rounded-lg border bg-white p-3 ${toneBorderClass(impact.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold tracking-normal">{impact.equipmentName}</p>
                <p className="text-sm text-muted-foreground">{impact.clubLabel}</p>
              </div>
              <StatusPill tone={impact.tone}>{impact.verdict}</StatusPill>
            </div>
            <div className="grid gap-2">
              <DataPair label="Added" value={impact.addedLabel} />
              <DataPair label="Carry" value={formatDeltaYards(impact.carryDeltaYd)} />
              <DataPair label="Offline" value={formatOfflineChange(impact)} />
            </div>
            <p className="text-sm leading-5 text-muted-foreground">{impact.detail}</p>
          </div>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function BagBuilderSection({ scenarios }: { scenarios: BuilderScenario[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Bag builder"
        description="Projected fit changes for the most obvious setup moves."
        action={<Sparkles className="size-5 text-sky-700" />}
      />
      <CardContent className="grid gap-3 md:grid-cols-3">
        {scenarios.map((scenario) => (
          <div
            key={scenario.label}
            className={`grid gap-2 rounded-lg border bg-white p-3 ${toneBorderClass(scenario.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold tracking-normal">{scenario.label}</p>
              <StatusPill tone={scenario.tone}>{scenario.score}%</StatusPill>
            </div>
            <p className="text-sm leading-5 text-muted-foreground">{scenario.detail}</p>
          </div>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function ClubHistorySection({
  retiredProfiles,
  activeProfiles,
}: {
  retiredProfiles: ClubProfile[];
  activeProfiles: ClubProfile[];
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Club history"
        description="Retired clubs become the story of what changed, not a dead inventory list."
        action={<Archive className="size-5 text-slate-500" />}
      />
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {retiredProfiles.slice(0, 6).map((profile) => {
          const replacement = activeProfiles.find(
            (active) => active.club.type === profile.club.type,
          );
          const gain = replacement ? compareCarry(replacement.stock, profile.stock) : null;

          return (
            <div
              key={profile.club.id}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tracking-normal">
                    {formatClubType(profile.club.type)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{profile.equipmentName}</p>
                </div>
                <StatusPill tone="slate">Retired</StatusPill>
              </div>
              <div className="grid gap-2">
                <DataPair
                  label="Retired"
                  value={
                    profile.lastShotAt ? compactDateFormatter.format(profile.lastShotAt) : "--"
                  }
                />
                <DataPair
                  label="Replaced by"
                  value={replacement ? replacement.equipmentName : "No active replacement"}
                />
                <DataPair
                  label="Performance gain"
                  value={gain === null ? "--" : formatDeltaYards(gain)}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </DataPanel>
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

function RetireClubForm({ club, compact = false }: { club: ActiveClub; compact?: boolean }) {
  const label = [formatClubType(club.type), club.brand, club.model].filter(Boolean).join(" ");

  return (
    <form action={retireClubAction}>
      <input type="hidden" name="clubId" value={club.id} />
      <Button
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        className="border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
        aria-label={`Retire ${label}`}
      >
        <Archive className="size-4" />
        Retire
      </Button>
    </form>
  );
}

async function getEquipmentData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [clubRows, ballRows, historyRows, shotCountRows, recentShotRows] = await Promise.all([
    db.select().from(clubs).where(eq(clubs.userId, userId)),
    db
      .select()
      .from(ballModels)
      .where(eq(ballModels.userId, userId))
      .orderBy(desc(ballModels.createdAt)),
    db
      .select({
        id: clubEquipmentHistory.id,
        clubId: clubEquipmentHistory.clubId,
        clubType: clubs.type,
        clubBrand: clubs.brand,
        clubModel: clubs.model,
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
    db
      .select({
        clubId: shots.clubId,
        clubType: shots.clubType,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt))
      .limit(1600),
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
  const activeClubs = clubRows
    .filter((club) => club.active)
    .sort(
      (left, right) =>
        clubSortValue(left.type) - clubSortValue(right.type) ||
        (left.brand ?? "").localeCompare(right.brand ?? "") ||
        (left.model ?? "").localeCompare(right.model ?? ""),
    );

  return {
    clubs: clubRows,
    activeClubs,
    retiredClubs,
    ballModels: ballRows,
    history: historyRows,
    recentShotRows,
    shotStatsByClubId,
  };
}

type ActiveClub = Awaited<ReturnType<typeof getEquipmentData>>["activeClubs"][number];
type RetiredClub = Awaited<ReturnType<typeof getEquipmentData>>["retiredClubs"][number];
type EquipmentData = Awaited<ReturnType<typeof getEquipmentData>>;
type EquipmentShotRow = EquipmentData["recentShotRows"][number];
type EquipmentSignal = {
  label: string;
  detail: string;
  tone: Tone;
};
type EquipmentSetupItem = {
  key: string;
  label: string;
  model: string;
  confidenceLabel: string;
  detail: string;
  tone: Tone;
  profiles: ClubProfile[];
};
type ClubProfile = {
  club: ActiveClub | RetiredClub;
  stock: StockYardage;
  trend: StockCarryTrend;
  shotCount: number;
  lastShotAt: Date | null;
  addedAt: Date | null;
  confidence: number;
  statusLabel: string;
  statusTone: Tone;
  carryLabel: string;
  missLabel: string;
  performanceLabel: string;
  equipmentName: string;
  impact: EquipmentImpact | null;
};
type EquipmentImpact = {
  clubLabel: string;
  equipmentName: string;
  addedLabel: string;
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  beforeOfflineYd: number | null;
  afterOfflineYd: number | null;
  verdict: string;
  tone: Tone;
  detail: string;
};
type BuilderScenario = {
  label: string;
  score: number;
  detail: string;
  tone: Tone;
};
type EquipmentIntelligence = ReturnType<typeof buildEquipmentIntelligence>;

function buildEquipmentIntelligence(data: EquipmentData) {
  const shotsByClubId = groupShotsByClubId(data.recentShotRows);
  const activeSetupByClubId = currentSetupRowsByClubId(data.history);
  const activeProfiles = data.activeClubs.map((club) =>
    buildClubProfile({
      club,
      clubShots: shotsByClubId.get(club.id) ?? [],
      allShots: data.recentShotRows,
      addedAt: activeSetupByClubId.get(club.id)?.effectiveFrom ?? club.createdAt,
      shotStats: data.shotStatsByClubId.get(club.id),
      isRetired: false,
    }),
  );
  const retiredProfiles = data.retiredClubs.map((club) =>
    buildClubProfile({
      club,
      clubShots: shotsByClubId.get(club.id) ?? [],
      allShots: data.recentShotRows,
      addedAt: club.createdAt,
      shotStats: data.shotStatsByClubId.get(club.id),
      isRetired: true,
    }),
  );
  const profilesWithShots = activeProfiles.filter((profile) => profile.shotCount > 0);
  const averageConfidence =
    profilesWithShots.length > 0
      ? Math.round(
          profilesWithShots.reduce((total, profile) => total + profile.confidence, 0) /
            profilesWithShots.length,
        )
      : 0;
  const activeSetupCount = data.activeClubs.filter((club) =>
    activeSetupByClubId.has(club.id),
  ).length;
  const clubCoverage =
    data.activeClubs.length > 0
      ? Math.round((profilesWithShots.length / data.activeClubs.length) * 100)
      : 0;
  const setupCoverage =
    data.activeClubs.length > 0
      ? Math.round((activeSetupCount / data.activeClubs.length) * 100)
      : 0;
  const bagFitScore =
    data.activeClubs.length > 0
      ? clampInteger(
          Math.round(averageConfidence * 0.7 + clubCoverage * 0.2 + setupCoverage * 0.1),
          0,
          99,
        )
      : 0;
  const trustedCount = activeProfiles.filter((profile) => profile.confidence >= 75).length;
  const bestClub =
    [...profilesWithShots].sort(
      (left, right) =>
        right.confidence - left.confidence ||
        compareCarry(right.stock, left.stock) ||
        right.shotCount - left.shotCount,
    )[0] ?? null;
  const weakestClub =
    [...profilesWithShots].sort(
      (left, right) =>
        left.confidence - right.confidence ||
        (right.stock.dispersionLeftYd ?? 0) +
          (right.stock.dispersionRightYd ?? 0) -
          ((left.stock.dispersionLeftYd ?? 0) + (left.stock.dispersionRightYd ?? 0)),
    )[0] ?? null;
  const setup = buildCurrentSetup(activeProfiles);
  const strength = buildStrengthSignal(activeProfiles, bestClub);
  const weakness = buildWeaknessSignal(activeProfiles, weakestClub, data.activeClubs);
  const builderScenarios = buildBuilderScenarios({
    bagFitScore,
    averageConfidence,
    activeProfiles,
    activeClubs: data.activeClubs,
  });
  const nextScenario = builderScenarios.find((scenario) => scenario.label !== "Current bag fit");
  const impacts = activeProfiles
    .map((profile) => profile.impact)
    .filter((impact): impact is EquipmentImpact => impact !== null)
    .sort((left, right) => impactSortValue(right) - impactSortValue(left));

  return {
    activeProfiles,
    retiredProfiles,
    setup,
    impacts,
    builderScenarios,
    averageConfidence,
    bagFitScore,
    bagFitTone: scoreTone(bagFitScore),
    bestClub,
    trustedCount,
    strength,
    weakness,
    primarySetupLabel: setup.length > 0 ? setup[0].label : "No bag",
    fitDetail:
      profilesWithShots.length > 0
        ? `${profilesWithShots.length}/${data.activeClubs.length} clubs have shot evidence`
        : "Import shots to score the setup",
    nextUpgrade: nextScenario?.label.replace(/^Add /, "") ?? null,
    nextUpgradeDetail: nextScenario?.detail ?? "Build more shot evidence before buying equipment.",
  };
}

function buildClubProfile({
  club,
  clubShots,
  allShots,
  addedAt,
  shotStats,
  isRetired,
}: {
  club: ActiveClub | RetiredClub;
  clubShots: EquipmentShotRow[];
  allShots: EquipmentShotRow[];
  addedAt: Date | null;
  shotStats?: { shotCount: number; lastShotAt: Date | null };
  isRetired: boolean;
}): ClubProfile {
  const normalizedAddedAt = coerceDate(addedAt);
  const lastShotAt = coerceDate(shotStats?.lastShotAt);
  const stockShots = clubShots.map(toStockShot);
  const stock = calculateStockYardage(stockShots, 80, { clubType: club.type });
  const trend = calculateStockCarryTrend(stockShots, 80, { clubType: club.type });
  const confidence = isRetired ? 0 : stock.confidenceScore;
  const status = isRetired ? { label: "Retired", tone: "slate" as Tone } : trustStatus(confidence);
  const performance = performanceStatus(stock, trend, isRetired);
  const impact = isRetired
    ? null
    : buildEquipmentImpact({
        club,
        allShots,
        addedAt: normalizedAddedAt,
        confidence,
      });

  return {
    club,
    stock,
    trend,
    shotCount: shotStats?.shotCount ?? clubShots.length,
    lastShotAt,
    addedAt: normalizedAddedAt,
    confidence,
    statusLabel: status.label,
    statusTone: status.tone,
    carryLabel: formatYards(stock.coursePlayCarryYd ?? stock.bestStockCarryYd),
    missLabel: formatMiss(stock.dispersionLeftYd, stock.dispersionRightYd),
    performanceLabel: performance.label,
    equipmentName: formatEquipmentName(club),
    impact,
  };
}

function buildCurrentSetup(activeProfiles: ClubProfile[]): EquipmentSetupItem[] {
  const sorted = [...activeProfiles].sort(
    (left, right) => clubSortValue(left.club.type) - clubSortValue(right.club.type),
  );
  const driver = sorted.filter((profile) => profile.club.type === "driver").slice(0, 1);
  const fairway = sorted
    .filter((profile) => /[wh]$/.test(profile.club.type) && profile.club.type !== "driver")
    .slice(0, 1);
  const irons = sorted.filter(
    (profile) => profile.club.type.endsWith("i") || profile.club.type === "pw",
  );
  const wedges = sorted.filter((profile) => ["gw", "aw", "sw", "lw"].includes(profile.club.type));
  const setup = [
    setupItem("driver", "Driver", driver),
    setupItem("fairway", fairway[0] ? formatClubType(fairway[0].club.type) : "Fairway", fairway),
    setupItem("irons", clubRangeLabel(irons, "Irons"), irons),
    setupItem("wedges", clubRangeLabel(wedges, "Wedges"), wedges),
  ];

  return setup.filter((item): item is EquipmentSetupItem => item !== null);
}

function setupItem(key: string, label: string, profiles: ClubProfile[]): EquipmentSetupItem | null {
  if (profiles.length === 0) {
    return null;
  }

  const confidence = average(
    profiles.filter((profile) => profile.shotCount > 0).map((profile) => profile.confidence),
  );
  const roundedConfidence = Math.round(confidence ?? 0);
  const primary = profiles[0];

  return {
    key,
    label,
    model: commonEquipmentName(profiles) ?? primary.equipmentName,
    confidenceLabel: roundedConfidence > 0 ? `${roundedConfidence}%` : "Building",
    detail:
      profiles.length === 1
        ? `${primary.carryLabel} · ${primary.missLabel}`
        : `${profiles.length} clubs · ${trustedGroupCount(profiles)} trusted`,
    tone: scoreTone(roundedConfidence),
    profiles,
  };
}

function buildStrengthSignal(
  activeProfiles: ClubProfile[],
  bestClub: ClubProfile | null,
): EquipmentSignal {
  const reliableIrons = activeProfiles.filter(
    (profile) => profile.club.type.endsWith("i") && profile.confidence >= 75,
  );

  if (reliableIrons.length >= 3) {
    return {
      label: "Iron gapping",
      detail: `${reliableIrons.length} irons are in the trusted window.`,
      tone: "green",
    };
  }

  if (bestClub) {
    return {
      label: `${formatClubType(bestClub.club.type)} trust`,
      detail: `${bestClub.confidence}% confidence from ${bestClub.shotCount.toLocaleString("en-GB")} shots.`,
      tone: scoreTone(bestClub.confidence),
    };
  }

  return {
    label: "Needs samples",
    detail: "Import more shots to find a genuine bag strength.",
    tone: "amber",
  };
}

function buildWeaknessSignal(
  activeProfiles: ClubProfile[],
  weakestClub: ClubProfile | null,
  activeClubs: ActiveClub[],
): EquipmentSignal {
  if (missingGapWedge(activeClubs)) {
    return {
      label: "Scoring wedge gap",
      detail: "PW to SW is the first equipment window to check.",
      tone: "amber",
    };
  }

  if (weakestClub && weakestClub.confidence < 70) {
    return {
      label: `${formatClubType(weakestClub.club.type)} confidence`,
      detail: `${weakestClub.confidence}% confidence · ${weakestClub.performanceLabel.toLowerCase()}.`,
      tone: "amber",
    };
  }

  const mostOffline = [...activeProfiles]
    .filter((profile) => profile.shotCount >= 5)
    .sort((left, right) => offlineWindow(right.stock) - offlineWindow(left.stock))[0];

  if (mostOffline && offlineWindow(mostOffline.stock) >= 20) {
    return {
      label: `${formatClubType(mostOffline.club.type)} miss`,
      detail: mostOffline.missLabel,
      tone: "amber",
    };
  }

  return {
    label: "No urgent gap",
    detail: "The current evidence does not flag a major equipment problem.",
    tone: "green",
  };
}

function buildBuilderScenarios({
  bagFitScore,
  averageConfidence,
  activeProfiles,
  activeClubs,
}: {
  bagFitScore: number;
  averageConfidence: number;
  activeProfiles: ClubProfile[];
  activeClubs: ActiveClub[];
}): BuilderScenario[] {
  const scenarios: BuilderScenario[] = [
    {
      label: "Current bag fit",
      score: bagFitScore,
      detail: `${averageConfidence}% average confidence across clubs with shot evidence.`,
      tone: scoreTone(bagFitScore),
    },
  ];
  const weakest = [...activeProfiles]
    .filter((profile) => profile.shotCount > 0)
    .sort((left, right) => left.confidence - right.confidence)[0];

  if (missingGapWedge(activeClubs)) {
    scenarios.push({
      label: "Add 48° Gap Wedge",
      score: clampInteger(bagFitScore + 4, 0, 99),
      detail: "Fills the scoring-end bridge before chasing longer clubs.",
      tone: "green",
    });
  }

  if (missingSevenWood(activeClubs)) {
    scenarios.push({
      label: "Add 7W",
      score: clampInteger(bagFitScore + 2, 0, 99),
      detail:
        "Creates a higher-flight long-game option if the top end needs another launch window.",
      tone: "sky",
    });
  }

  if (weakest && weakest.confidence < 75) {
    scenarios.push({
      label: `Dial ${formatClubType(weakest.club.type)}`,
      score: clampInteger(bagFitScore + 3, 0, 99),
      detail: `The biggest current gain is making ${formatClubType(weakest.club.type)} trustworthy.`,
      tone: "amber",
    });
  }

  return scenarios.slice(0, 3);
}

function buildEquipmentImpact({
  club,
  allShots,
  addedAt,
  confidence,
}: {
  club: ActiveClub | RetiredClub;
  allShots: EquipmentShotRow[];
  addedAt: Date | null;
  confidence: number;
}): EquipmentImpact | null {
  const addedDate = coerceDate(addedAt);

  if (!addedDate) {
    return null;
  }

  const sameTypeShots = allShots.filter((shot) => shot.clubType === club.type);
  const after = sameTypeShots.filter((shot) => {
    const shotTime = dateValue(shot.shotAt);
    return shotTime !== null && shotTime >= addedDate.getTime();
  });
  const before = sameTypeShots.filter((shot) => {
    const shotTime = dateValue(shot.shotAt);
    return shotTime !== null && shotTime < addedDate.getTime();
  });
  const afterCarry = median(after.map((shot) => shot.carryYd).filter(isNumber));
  const beforeCarry = median(before.map((shot) => shot.carryYd).filter(isNumber));
  const afterOffline = mean(
    after
      .map((shot) => shot.sideCarryYd)
      .filter(isNumber)
      .map(Math.abs),
  );
  const beforeOffline = mean(
    before
      .map((shot) => shot.sideCarryYd)
      .filter(isNumber)
      .map(Math.abs),
  );
  const carryDeltaYd =
    afterCarry !== null && beforeCarry !== null ? roundOne(afterCarry - beforeCarry) : null;
  const offlineDeltaYd =
    afterOffline !== null && beforeOffline !== null ? roundOne(afterOffline - beforeOffline) : null;

  if (after.length < 5 && carryDeltaYd === null && offlineDeltaYd === null) {
    return null;
  }

  const verdict = equipmentVerdict({
    carryDeltaYd,
    offlineDeltaYd,
    confidence,
    sampleSize: after.length,
  });
  const addedLabel = compactDateFormatter.format(addedDate);

  return {
    clubLabel: formatClubType(club.type),
    equipmentName: formatEquipmentName(club),
    addedLabel,
    carryDeltaYd,
    offlineDeltaYd,
    beforeOfflineYd: beforeOffline === null ? null : roundOne(beforeOffline),
    afterOfflineYd: afterOffline === null ? null : roundOne(afterOffline),
    verdict: verdict.label,
    tone: verdict.tone,
    detail:
      carryDeltaYd !== null || offlineDeltaYd !== null
        ? "Compared with previous shots from the same club slot."
        : `${after.length} shots since ${addedLabel}; baseline still building.`,
  };
}

function groupShotsByClubId(rows: EquipmentShotRow[]) {
  const grouped = new Map<string, EquipmentShotRow[]>();

  for (const row of rows) {
    grouped.set(row.clubId, [...(grouped.get(row.clubId) ?? []), row]);
  }

  return grouped;
}

function currentSetupRowsByClubId(history: EquipmentData["history"]) {
  const currentRows = new Map<string, EquipmentData["history"][number]>();

  for (const row of history) {
    if (row.effectiveTo !== null) {
      continue;
    }

    const current = currentRows.get(row.clubId);

    if (!current || row.effectiveFrom > current.effectiveFrom) {
      currentRows.set(row.clubId, row);
    }
  }

  return currentRows;
}

function toStockShot(row: EquipmentShotRow): StockShot {
  return {
    clubType: row.clubType,
    carryYd: row.carryYd,
    totalYd: row.totalYd,
    sideCarryYd: row.sideCarryYd,
    ballSpeedMph: row.ballSpeedMph,
    launchAngleDeg: row.launchAngleDeg,
    shotCategory: row.shotCategory,
    qualityTag: row.qualityTag,
    shotAt: row.shotAt,
  };
}

function trustStatus(confidence: number): { label: string; tone: Tone } {
  if (confidence >= 80) {
    return { label: "Trusted", tone: "green" };
  }

  if (confidence >= 55) {
    return { label: "Developing", tone: "amber" };
  }

  if (confidence > 0) {
    return { label: "New", tone: "sky" };
  }

  return { label: "Building", tone: "slate" };
}

function performanceStatus(
  stock: StockYardage,
  trend: StockCarryTrend,
  isRetired: boolean,
): { label: string; tone: Tone } {
  if (isRetired) {
    return { label: "Retired", tone: "slate" };
  }

  if (trend.status === "better") {
    return { label: "Improving", tone: "green" };
  }

  if (trend.status === "worse") {
    return { label: "Review", tone: "amber" };
  }

  if (stock.confidenceScore >= 80) {
    return { label: "Trusted", tone: "green" };
  }

  if (stock.rawSampleSize < 10) {
    return { label: "Calibrating", tone: "sky" };
  }

  return { label: "Stable", tone: "green" };
}

function equipmentVerdict({
  carryDeltaYd,
  offlineDeltaYd,
  confidence,
  sampleSize,
}: {
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  confidence: number;
  sampleSize: number;
}): { label: string; tone: Tone } {
  if (sampleSize < 8) {
    return { label: "Calibrating", tone: "sky" };
  }

  if ((carryDeltaYd ?? 0) >= 8 && (offlineDeltaYd ?? 0) <= 2) {
    return { label: "Excellent upgrade", tone: "green" };
  }

  if ((carryDeltaYd ?? 0) >= 3 || (offlineDeltaYd ?? 0) <= -3 || confidence >= 80) {
    return { label: "Promising", tone: "green" };
  }

  if ((carryDeltaYd ?? 0) <= -5 || (offlineDeltaYd ?? 0) >= 5) {
    return { label: "Review", tone: "amber" };
  }

  return { label: "Steady", tone: "slate" };
}

function formatEquipmentName(club: Pick<ActiveClub, "brand" | "model" | "type">) {
  return [club.brand, club.model].filter(Boolean).join(" ") || formatClubType(club.type);
}

function commonEquipmentName(profiles: ClubProfile[]) {
  const counts = new Map<string, number>();

  for (const profile of profiles) {
    counts.set(profile.equipmentName, (counts.get(profile.equipmentName) ?? 0) + 1);
  }

  const common = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];

  return common?.[0] ?? null;
}

function clubRangeLabel(profiles: ClubProfile[], fallback: string) {
  if (profiles.length === 0) {
    return fallback;
  }

  if (profiles.length === 1) {
    return formatClubType(profiles[0].club.type);
  }

  const sorted = [...profiles].sort(
    (left, right) => clubSortValue(left.club.type) - clubSortValue(right.club.type),
  );

  return `${formatClubType(sorted[0].club.type)}-${formatClubType(sorted[sorted.length - 1].club.type)}`;
}

function trustedGroupCount(profiles: ClubProfile[]) {
  return profiles.filter((profile) => profile.confidence >= 75).length;
}

function missingGapWedge(activeClubs: ActiveClub[]) {
  const types = new Set(activeClubs.map((club) => club.type));
  return types.has("pw") && types.has("sw") && !types.has("gw") && !types.has("aw");
}

function missingSevenWood(activeClubs: ActiveClub[]) {
  const types = new Set(activeClubs.map((club) => club.type));
  return types.has("driver") && (types.has("5w") || types.has("3w")) && !types.has("7w");
}

function scoreTone(score: number): Tone {
  if (score >= 75) {
    return "green";
  }

  if (score >= 45) {
    return "amber";
  }

  if (score > 0) {
    return "sky";
  }

  return "slate";
}

function toneBorderClass(tone: Tone) {
  switch (tone) {
    case "green":
      return "border-emerald-100";
    case "sky":
      return "border-sky-100";
    case "pink":
      return "border-pink-100";
    case "amber":
      return "border-amber-100";
    case "slate":
      return "border-slate-200";
  }
}

function toneTextClass(tone: Tone) {
  switch (tone) {
    case "green":
      return "text-emerald-700";
    case "sky":
      return "text-sky-700";
    case "pink":
      return "text-pink-700";
    case "amber":
      return "text-amber-800";
    case "slate":
      return "text-slate-600";
  }
}

function formatYards(value: number | null | undefined) {
  return typeof value === "number" ? `${integerFormatter.format(Math.round(value))} yd` : "--";
}

function formatDeltaYards(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)} yd`;
}

function formatOfflineChange(impact: EquipmentImpact) {
  if (impact.beforeOfflineYd === null || impact.afterOfflineYd === null) {
    return formatDeltaYards(impact.offlineDeltaYd);
  }

  return `${numberFormatter.format(impact.beforeOfflineYd)} yd -> ${numberFormatter.format(
    impact.afterOfflineYd,
  )} yd`;
}

function formatMiss(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return "Miss pattern building";
  }

  const leftValue = left ?? 0;
  const rightValue = right ?? 0;

  if (rightValue > leftValue + 3) {
    return `Right miss ${integerFormatter.format(Math.round(rightValue))} yd`;
  }

  if (leftValue > rightValue + 3) {
    return `Left miss ${integerFormatter.format(Math.round(leftValue))} yd`;
  }

  return `Balanced miss ${integerFormatter.format(Math.round(Math.max(leftValue, rightValue)))} yd`;
}

function compareCarry(next: StockYardage, previous: StockYardage) {
  const nextCarry = next.coursePlayCarryYd ?? next.bestStockCarryYd;
  const previousCarry = previous.coursePlayCarryYd ?? previous.bestStockCarryYd;

  return nextCarry !== null && previousCarry !== null ? roundOne(nextCarry - previousCarry) : null;
}

function offlineWindow(stock: StockYardage) {
  return (stock.dispersionLeftYd ?? 0) + (stock.dispersionRightYd ?? 0);
}

function impactSortValue(impact: EquipmentImpact) {
  return Math.abs(impact.carryDeltaYd ?? 0) + Math.abs(impact.offlineDeltaYd ?? 0);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = (sorted.length - 1) / 2;
  const lower = Math.floor(middle);
  const upper = Math.ceil(middle);

  return lower === upper ? sorted[lower] : (sorted[lower] + sorted[upper]) / 2;
}

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

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

function formatDate(value: Date | string | number | null | undefined) {
  const date = coerceDate(value);
  return date ? dateFormatter.format(date) : "--";
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

function formatBall(brand: string | null, model: string | null) {
  return [brand, model].filter(Boolean).join(" ") || "--";
}

function coerceDate(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function dateValue(value: Date | string | number | null | undefined) {
  return coerceDate(value)?.getTime() ?? null;
}
