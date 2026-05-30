import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  ListFilter,
  Megaphone,
  Share2,
  Target,
  Trophy,
} from "lucide-react";

import {
  completePracticeDrillAction,
  createCoachSignalChallengeAction,
  createLatestRoundRecapAction,
  featureCourseRecordAction,
  followCourseAction,
  saveCurrentWeeklyRecapAction,
  saveShotViewAction,
  updateFeaturePreferencesAction,
  upsertCourseRecordGoalAction,
} from "@/app/feature-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DataPanel,
  DataPair,
  MobileAccordionSection,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import type {
  CourseFollowFeatureData,
  FeatureIdeasData,
  FeatureInsight,
} from "@/lib/feature-ideas";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

function featureInsightKey(item: FeatureInsight, index: number) {
  return [item.title, item.metric, item.href, index].filter(Boolean).join("-");
}

export function ActionCentrePanel({
  data,
  layout = "default",
  compactMobile = false,
}: {
  data: FeatureIdeasData;
  layout?: "default" | "dashboard";
  compactMobile?: boolean;
}) {
  const isDashboard = layout === "dashboard";

  if (compactMobile) {
    return (
      <div className="grid gap-2">
        {data.dashboardActions.map((item) => (
          <ActionInsightCard key={item.title} item={item} compact />
        ))}
      </div>
    );
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Action centre"
        description="Fix the items that improve data quality, practice and competition flow."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/progress">Review week</Link>
          </Button>
        }
      />
      <MobileFeatureInsightPreview
        items={data.dashboardActions}
        moreTitle="More actions"
        moreDescription="Secondary fixes and follow-ups."
      />
      <div
        className={
          isDashboard
            ? "hidden gap-3 p-4 sm:grid md:grid-cols-3"
            : "hidden gap-3 p-4 sm:grid sm:grid-cols-2"
        }
      >
        {data.dashboardActions.map((item) => (
          <ActionInsightCard key={item.title} item={item} compact={isDashboard} />
        ))}
      </div>
    </DataPanel>
  );
}

function ActionInsightCard({ item, compact = false }: { item: FeatureInsight; compact?: boolean }) {
  const content = (
    <div
      className={
        compact
          ? "grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/35"
          : "grid min-h-28 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/35"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold leading-5">{item.title}</p>
        {item.metric ? <StatusPill tone={item.tone as Tone}>{item.metric}</StatusPill> : null}
      </div>
      <p className="line-clamp-2 leading-5 text-muted-foreground">{item.detail}</p>
    </div>
  );

  return item.href ? (
    <Link href={item.href} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function ImportQualityFeaturePanel({
  data,
  compactMobile = false,
}: {
  data: FeatureIdeasData;
  compactMobile?: boolean;
}) {
  if (compactMobile) {
    return (
      <div className="grid gap-2">
        {data.importQuality.checks.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    );
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Import quality score"
        description="Checks club mapping, duplicate files, missing metrics and event eligibility before data reaches records or coach."
        action={
          <StatusPill tone={data.importQuality.tone as Tone}>
            {data.importQuality.metric}
          </StatusPill>
        }
      />
      <MobileFeatureInsightPreview
        items={data.importQuality.checks}
        moreTitle="More import checks"
        moreDescription="Mapping, duplicate and eligibility details."
      />
      <div className="hidden gap-3 p-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {data.importQuality.checks.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

export function DataHealthFeaturePanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Can I trust this?"
        description="Shows whether the current golf data is ready for stock yardages, progress signals, coaching and competition proof."
        action={
          <StatusPill tone={data.dataHealth.tone as Tone}>
            {data.dataHealth.status} · {data.dataHealth.metric}
          </StatusPill>
        }
      />
      <MobileFeatureInsightPreview
        items={data.dataHealth.checks}
        moreTitle="More trust checks"
        moreDescription="Progress, coach and competition readiness."
      />
      <div className="hidden gap-3 p-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {data.dataHealth.checks.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

export function ProviderHealthFeaturePanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Provider import health"
        description="Each adapter reports readiness, last activity and beta status without exposing raw provider metadata."
        action={<StatusPill tone="sky">Adapters</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={data.providerHealth}
        moreTitle="More provider checks"
        moreDescription="Adapter status and latest activity."
      />
      <div className="hidden gap-3 p-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
        {data.providerHealth.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

export function BagFeaturePanel({
  data,
  compactMobile = false,
}: {
  data: FeatureIdeasData;
  compactMobile?: boolean;
}) {
  if (compactMobile) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-2">
          {data.bagAlerts.slice(0, 4).map((item, index) => (
            <InsightCard key={featureInsightKey(item, index)} item={item} compact />
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-emerald-700" />
            Target distance links
          </p>
          <div className="mt-3 grid gap-2">
            {data.targetDistanceOptions.slice(2, 7).map((option) => (
              <Link
                key={option.target}
                href={option.href}
                prefetch={false}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
              >
                <span className="font-semibold tabular-nums">{option.target} yd</span>
                <span className="truncate text-muted-foreground">{option.clubName}</span>
                <span
                  className={
                    option.gap === null
                      ? "text-slate-500"
                      : Math.abs(option.gap) <= 5
                        ? "text-emerald-700"
                        : "text-amber-700"
                  }
                >
                  {option.playNumber === null ? "--" : `${option.playNumber} yd`}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          {data.clubIdentities.slice(0, 4).map((club) => (
            <Link
              key={club.clubId}
              href={club.href}
              prefetch={false}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{club.name}</p>
                <StatusPill tone="green">{club.confidence}</StatusPill>
              </div>
              <p className="mt-2 text-muted-foreground">{club.purpose}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Bag fitting and target selector"
        description="Gapping alerts, target-distance club suggestions and club identity cards are generated from current stock yardages."
        action={
          <StatusPill tone={(data.bagAlerts[0]?.tone ?? "green") as Tone}>
            {data.bagAlerts[0]?.metric ?? "Ready"}
          </StatusPill>
        }
      />
      <div className="grid gap-3 p-3 sm:hidden">
        {data.bagAlerts.slice(0, 2).map((item, index) => (
          <InsightCard key={featureInsightKey(item, index)} item={item} compact />
        ))}
        <MobileAccordionSection
          title="More fitting detail"
          description="Target links, extra alerts and club identities."
          count="Full analysis"
        >
          <div className="grid gap-3">
            {data.bagAlerts.slice(2, 4).map((item, index) => (
              <InsightCard key={featureInsightKey(item, index + 2)} item={item} compact />
            ))}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Target className="size-4 text-emerald-700" />
                Target distance links
              </p>
              <div className="mt-3 grid gap-2">
                {data.targetDistanceOptions.slice(2, 7).map((option) => (
                  <Link
                    key={option.target}
                    href={option.href}
                    prefetch={false}
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  >
                    <span className="font-semibold tabular-nums">{option.target} yd</span>
                    <span className="truncate text-muted-foreground">{option.clubName}</span>
                    <span
                      className={
                        option.gap === null
                          ? "text-slate-500"
                          : Math.abs(option.gap) <= 5
                            ? "text-emerald-700"
                            : "text-amber-700"
                      }
                    >
                      {option.playNumber === null ? "--" : `${option.playNumber} yd`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {data.clubIdentities.slice(0, 4).map((club) => (
                <Link
                  key={club.clubId}
                  href={club.href}
                  prefetch={false}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{club.name}</p>
                    <StatusPill tone="green">{club.confidence}</StatusPill>
                  </div>
                  <p className="mt-2 text-muted-foreground">{club.purpose}</p>
                </Link>
              ))}
            </div>
          </div>
        </MobileAccordionSection>
      </div>
      <div className="hidden gap-4 p-4 sm:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2">
          {data.bagAlerts.slice(0, 4).map((item, index) => (
            <InsightCard key={featureInsightKey(item, index)} item={item} compact />
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-emerald-700" />
            Target distance selector
          </p>
          <div className="mt-3 grid gap-2">
            {data.targetDistanceOptions.slice(2, 7).map((option) => (
              <Link
                key={option.target}
                href={option.href}
                prefetch={false}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
              >
                <span className="font-semibold tabular-nums">{option.target} yd</span>
                <span className="truncate text-muted-foreground">{option.clubName}</span>
                <span
                  className={
                    option.gap === null
                      ? "text-slate-500"
                      : Math.abs(option.gap) <= 5
                        ? "text-emerald-700"
                        : "text-amber-700"
                  }
                >
                  {option.playNumber === null ? "--" : `${option.playNumber} yd`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="hidden gap-3 border-t border-slate-200 p-4 sm:grid md:grid-cols-2 xl:grid-cols-3">
        {data.clubIdentities.slice(0, 6).map((club) => (
          <Link
            key={club.clubId}
            href={club.href}
            prefetch={false}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{club.name}</p>
              <StatusPill tone="green">{club.confidence}</StatusPill>
            </div>
            <p className="mt-2 text-muted-foreground">{club.purpose}</p>
            <div className="mt-3 grid gap-2">
              <DataPair label="Best distance" value={club.bestDistance} />
              <DataPair label="Dangerous miss" value={club.dangerousMiss} />
            </div>
          </Link>
        ))}
      </div>
    </DataPanel>
  );
}

export function SavedShotViewsPanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Saved shot views"
        description="Fast filters for driver misses, wedge windows, recent form and user-defined shot groups."
        action={<StatusPill tone="sky">{data.savedViews.length} views</StatusPill>}
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 md:grid-cols-2">
          {data.savedViews.map((view) => (
            <Link
              key={view.id}
              href={view.href}
              prefetch={false}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="font-semibold">{view.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{view.description}</p>
            </Link>
          ))}
        </div>
        <form
          action={saveShotViewAction}
          className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
        >
          <p className="text-sm font-semibold">Save current view</p>
          <div className="mt-3 grid gap-2">
            <Input name="name" placeholder="My tournament attempts" required />
            <Input name="description" placeholder="What this view is for" />
            <select
              aria-label="Saved view club filter"
              name="club"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All clubs</option>
              {data.savedViewOptions.clubs.map((club) => (
                <option key={club.value} value={club.value}>
                  {club.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Saved view category filter"
              name="category"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All categories</option>
              {data.savedViewOptions.categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input name="from" type="date" aria-label="Saved view start date" />
              <Input name="to" type="date" aria-label="Saved view end date" />
            </div>
            <Input name="q" placeholder="Search term or note" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox name="pinned" />
              Pin view
            </label>
            <Button type="submit" className="bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <ListFilter className="size-4" />
              Save view
            </Button>
          </div>
        </form>
      </div>
    </DataPanel>
  );
}

export function CoachPracticeFeaturePanel({
  data,
  compactMobile = false,
}: {
  data: FeatureIdeasData;
  compactMobile?: boolean;
}) {
  const top = data.practicePlan[0];

  if (compactMobile) {
    return (
      <div className="grid gap-3">
        {data.practicePlan.slice(0, 1).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
            <DataPair className="mt-3" label="Target" value={`${item.targetShots} shots`} />
          </div>
        ))}
        {top ? (
          <form
            action={completePracticeDrillAction}
            className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
          >
            <input type="hidden" name="sourceId" value={top.id} />
            <input type="hidden" name="title" value={top.title} />
            <input type="hidden" name="focusArea" value={top.focusArea} />
            <input type="hidden" name="clubId" value={top.clubId ?? ""} />
            <input type="hidden" name="clubType" value={top.clubType ?? ""} />
            <input type="hidden" name="targetShots" value={top.targetShots} />
            <p className="text-sm font-semibold">Start 20-minute plan</p>
            <p className="mt-1 text-sm text-muted-foreground">{top.detail}</p>
            <Input
              className="mt-3 bg-white"
              type="number"
              min={0}
              max={200}
              name="recordedShots"
              aria-label="Recorded shots"
              defaultValue={top.targetShots}
            />
            <Button type="submit" className="premium-action mt-2 w-full">
              <CalendarCheck className="size-4" />
              Mark drill complete
            </Button>
          </form>
        ) : null}
        {data.practicePlan.slice(1).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
            <DataPair className="mt-3" label="Target" value={`${item.targetShots} shots`} />
          </div>
        ))}
        <CoachChallengeForm data={data} />
      </div>
    );
  }

  return (
    <DataPanel>
      <SectionHeader
        title="Practice mode and coach confidence"
        description="Turn Today's prescription into a tracked drill, save completion, and optionally post it to the feed."
        action={
          <StatusPill tone={data.coachConfidence.tone as Tone}>
            {data.coachConfidence.metric}
          </StatusPill>
        }
      />
      <div className="grid gap-3 p-3 sm:hidden">
        {data.practicePlan.slice(0, 1).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
            <DataPair className="mt-3" label="Target" value={`${item.targetShots} shots`} />
          </div>
        ))}
        {top ? (
          <form
            action={completePracticeDrillAction}
            className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
          >
            <input type="hidden" name="sourceId" value={top.id} />
            <input type="hidden" name="title" value={top.title} />
            <input type="hidden" name="focusArea" value={top.focusArea} />
            <input type="hidden" name="clubId" value={top.clubId ?? ""} />
            <input type="hidden" name="clubType" value={top.clubType ?? ""} />
            <input type="hidden" name="targetShots" value={top.targetShots} />
            <p className="text-sm font-semibold">Start 20-minute plan</p>
            <p className="mt-1 text-sm text-muted-foreground">{top.detail}</p>
            <Input
              className="mt-3 bg-white"
              type="number"
              min={0}
              max={200}
              name="recordedShots"
              aria-label="Recorded shots"
              defaultValue={top.targetShots}
            />
            <Button type="submit" className="premium-action mt-2 w-full">
              <CalendarCheck className="size-4" />
              Mark drill complete
            </Button>
          </form>
        ) : null}
        <MobileAccordionSection
          title="More coach actions"
          description="Extra drills and challenge template."
          count={`${Math.max(data.practicePlan.length - 1, 0) + 1} items`}
        >
          <div className="grid gap-3">
            {data.practicePlan.slice(1).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
                <DataPair className="mt-3" label="Target" value={`${item.targetShots} shots`} />
              </div>
            ))}
            <CoachChallengeForm data={data} />
          </div>
        </MobileAccordionSection>
      </div>
      <div className="hidden gap-4 p-4 sm:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 md:grid-cols-3">
          {data.practicePlan.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
              <DataPair className="mt-3" label="Target" value={`${item.targetShots} shots`} />
            </div>
          ))}
        </div>
        {top ? (
          <form
            action={completePracticeDrillAction}
            className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
          >
            <input type="hidden" name="sourceId" value={top.id} />
            <input type="hidden" name="title" value={top.title} />
            <input type="hidden" name="focusArea" value={top.focusArea} />
            <input type="hidden" name="clubId" value={top.clubId ?? ""} />
            <input type="hidden" name="clubType" value={top.clubType ?? ""} />
            <input type="hidden" name="targetShots" value={top.targetShots} />
            <p className="text-sm font-semibold">Start 20-minute plan</p>
            <p className="mt-1 text-sm text-muted-foreground">{top.detail}</p>
            <Input
              className="mt-3 bg-white"
              type="number"
              min={0}
              max={200}
              name="recordedShots"
              aria-label="Recorded shots"
              defaultValue={top.targetShots}
            />
            <Button type="submit" className="premium-action mt-2 w-full">
              <CalendarCheck className="size-4" />
              Mark drill complete
            </Button>
          </form>
        ) : null}
      </div>
      <div className="hidden border-t border-slate-200 p-4 sm:block">
        <CoachChallengeForm data={data} />
      </div>
    </DataPanel>
  );
}

export function RoundOpportunityFeaturePanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Round opportunities"
        description="Detect course-board eligibility, proof gaps and post-round recap options from the latest scorecard."
        action={<StatusPill tone="green">Detector</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={data.roundOpportunities}
        moreTitle="More round checks"
        moreDescription="Eligibility, proof gaps and recap options."
      />
      <div className="hidden gap-3 p-4 sm:grid md:grid-cols-3">
        {data.roundOpportunities.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
      <form action={createLatestRoundRecapAction} className="border-t border-slate-200 p-4">
        <Button type="submit" variant="outline">
          <Share2 className="size-4" />
          Create latest round recap
        </Button>
      </form>
    </DataPanel>
  );
}

export function HandicapConfidenceFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const visibleChecks = data.handicapConfidence.checks.slice(0, 2);
  const secondaryChecks = data.handicapConfidence.checks.slice(2);

  return (
    <DataPanel>
      <SectionHeader
        title="Handicap confidence checklist"
        description="Shows why the estimate is strong or what data is still missing."
        action={
          <StatusPill tone={data.handicapConfidence.tone as Tone}>
            {data.handicapConfidence.metric}
          </StatusPill>
        }
      />
      <div className="grid gap-3 p-3 sm:hidden">
        {visibleChecks.map((check) => (
          <HandicapCheckRow key={check.label} check={check} />
        ))}
        {secondaryChecks.length ? (
          <MobileAccordionSection
            title="More handicap checks"
            description="Remaining confidence signals."
            count={`${secondaryChecks.length} more`}
          >
            <div className="grid gap-2">
              {secondaryChecks.map((check) => (
                <HandicapCheckRow key={check.label} check={check} />
              ))}
            </div>
          </MobileAccordionSection>
        ) : null}
      </div>
      <div className="hidden gap-3 p-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {data.handicapConfidence.checks.map((check) => (
          <HandicapCheckRow key={check.label} check={check} />
        ))}
      </div>
    </DataPanel>
  );
}

export function WeeklyRecapFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const weeklySummary = [
    { label: "Best club", value: data.weeklyRecap.bestClub },
    { label: "Weakest signal", value: data.weeklyRecap.weakestSignal },
    { label: "New PBs", value: data.weeklyRecap.newPbs },
    { label: "Next goal", value: data.weeklyRecap.nextGoal },
  ];

  return (
    <DataPanel>
      <SectionHeader
        title="Weekly recap and practice calendar"
        description="Summarises best club, weak signal, PB shelf and next practice date."
        action={
          <StatusPill tone={data.weeklyRecap.tone as Tone}>{data.weeklyRecap.metric}</StatusPill>
        }
      />
      <div className="grid gap-3 p-3 sm:hidden">
        {weeklySummary.slice(0, 2).map((item) => (
          <DataPair key={item.label} label={item.label} value={item.value} />
        ))}
        <MobileAccordionSection
          title="Weekly detail"
          description="Recap, practice plan and calendar."
          count="Full recap"
        >
          <div className="grid gap-3">
            <div className="grid gap-2">
              {weeklySummary.slice(2).map((item) => (
                <DataPair key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
            <WeeklyRecapCard data={data} />
          </div>
        </MobileAccordionSection>
      </div>
      <div className="hidden gap-4 p-4 sm:grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {weeklySummary.map((item) => (
            <DataPair key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
        <WeeklyRecapCard data={data} />
      </div>
    </DataPanel>
  );
}

export function CourseRecordFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const firstGoal = data.courseRecordGoals.find((goal) => goal.href.includes("/course-records/"));
  const recordId = firstGoal?.href.split("/").pop() ?? data.courseRecordTargets[0]?.id;
  return (
    <DataPanel>
      <SectionHeader
        title="Course-record goals"
        description="Set a goal, track friend targets, and keep notify-when-beaten enabled for followed boards."
        action={<StatusPill tone="amber">{data.courseRecordGoals.length} goals</StatusPill>}
      />
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {data.courseRecordGoals.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
      {recordId ? (
        <div className="grid gap-2 border-t border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form
            action={upsertCourseRecordGoalAction}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]"
          >
            <select
              aria-label="Course record board"
              name="recordId"
              defaultValue={recordId}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {data.courseRecordTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <Input name="targetLabel" placeholder="Beat this board by 2 shots" />
            <Input name="targetValue" type="number" step="0.1" placeholder="Target" />
            <select
              aria-label="Friend target"
              name="targetUserId"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">No friend target</option>
              {data.friendTargets.map((friend) => (
                <option key={friend.userId} value={friend.userId}>
                  {friend.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
              <input type="hidden" name="notifyWhenBeaten" value="off" />
              <Checkbox name="notifyWhenBeaten" defaultChecked />
              Notify when beaten
            </label>
            <Button type="submit" variant="outline">
              <Bell className="size-4" />
              Save goal
            </Button>
          </form>
          <form action={featureCourseRecordAction}>
            <input type="hidden" name="recordId" value={recordId} />
            <Button type="submit" variant="outline" className="w-full">
              <Trophy className="size-4" />
              Feature record
            </Button>
          </form>
        </div>
      ) : null}
    </DataPanel>
  );
}

export function CourseFollowFeaturePanel({
  data,
  courseId,
}: {
  data: CourseFollowFeatureData;
  courseId?: string | null;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Course follows and aliases"
        description="Follow courses, track beaten-record alerts, and save provider aliases for imported course names."
        action={<StatusPill tone="green">{data.courseFollows.length} followed</StatusPill>}
      />
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {data.courseFollows.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
      {courseId ? (
        <form
          action={followCourseAction}
          className="grid gap-2 border-t border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]"
        >
          <input type="hidden" name="courseId" value={courseId} />
          <Input name="alias" placeholder="Provider course alias" />
          <Input name="provider" placeholder="Rapsodo" />
          <Input name="providerCourseId" placeholder="Provider ID" />
          <Input name="teeName" placeholder="Tee name" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
            <input type="hidden" name="notifyRecords" value="off" />
            <Checkbox name="notifyRecords" defaultChecked />
            Notify for beaten records
          </label>
          <Button type="submit" variant="outline">
            <Flag className="size-4" />
            Follow course
          </Button>
        </form>
      ) : null}
    </DataPanel>
  );
}

export function CompetitionFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const dailyChallengeItems: FeatureInsight[] = data.dailyMicroChallenges.map((item) => ({
    ...item,
    metric: item.status,
    href: "/challenges",
    tone: (item.status === "live" ? "green" : "sky") as FeatureInsight["tone"],
  }));
  const roundDueItems = data.roundDueReminders.length
    ? data.roundDueReminders
    : data.tournamentChecklist;
  const mobileCompetitionItems = [
    dailyChallengeItems[0],
    data.tournamentChecklist[0],
    roundDueItems[0],
  ].filter(Boolean) as FeatureInsight[];

  return (
    <DataPanel>
      <SectionHeader
        title="Competition engine"
        description="Daily micro-challenges, tournament proof checklists and round-due reminders stay secondary to the data."
        action={<StatusPill tone="sky">Compete</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={mobileCompetitionItems}
        moreTitle="More competition"
        moreDescription="Tournament proof and round reminders."
        visibleCount={2}
      />
      <MobileAccordionSection
        title="Full competition engine"
        description="All challenge, tournament and round-due checks."
        count="Full analysis"
        className="px-3 pb-3"
      >
        <div className="grid gap-3">
          <FeatureColumn title="Daily micro-challenges" items={dailyChallengeItems} />
          <FeatureColumn title="Tournament proof" items={data.tournamentChecklist} />
          <FeatureColumn title="Round due" items={roundDueItems} />
        </div>
      </MobileAccordionSection>
      <div className="hidden gap-4 p-4 sm:grid lg:grid-cols-3">
        <FeatureColumn title="Daily micro-challenges" items={dailyChallengeItems} />
        <FeatureColumn title="Tournament proof" items={data.tournamentChecklist} />
        <FeatureColumn title="Round due" items={roundDueItems} />
      </div>
    </DataPanel>
  );
}

export function LeaderboardClimbPanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Ways to climb"
        description="Concrete actions that move records, challenges and leaderboards."
        action={<StatusPill tone="green">Next moves</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={data.waysToClimb}
        moreTitle="More ways to climb"
        moreDescription="Records, challenges and leaderboard actions."
      />
      <div className="hidden gap-3 p-4 sm:grid md:grid-cols-3">
        {data.waysToClimb.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

export function SocialFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const socialItems: FeatureInsight[] = [
    {
      title: "Highlight of the week",
      metric: data.social.highlightOfWeek.metric,
      detail: data.social.highlightOfWeek.title,
      href: data.social.highlightOfWeek.href,
      tone: "green",
    },
    {
      title: "Profile completeness",
      metric: data.social.profileCompleteness.metric,
      detail: data.social.profileCompleteness.detail,
      href: data.social.profileCompleteness.href,
      tone: "sky",
    },
  ];

  return (
    <DataPanel>
      <SectionHeader
        title="Social support controls"
        description="Auto-share stays opt-in, while highlights and recap cards use the existing feed system."
        action={
          <StatusPill tone={data.social.publicSharePreview ? "green" : "slate"}>
            Share preview
          </StatusPill>
        }
      />
      <MobileFeatureInsightPreview
        items={socialItems}
        moreTitle="More social checks"
        moreDescription="Highlights and profile readiness."
      />
      <MobileAccordionSection
        title="Sharing controls"
        description="Opt-in post-round and practice sharing."
        count={data.social.publicSharePreview ? "Preview on" : "Preview off"}
        className="px-3 pb-3"
      >
        <SocialPreferencesForm data={data} />
      </MobileAccordionSection>
      <div className="hidden gap-4 p-4 sm:grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {socialItems.map((item) => (
            <InsightCard key={item.title} item={item} compact />
          ))}
        </div>
        <SocialPreferencesForm data={data} />
      </div>
    </DataPanel>
  );
}

export function ProfileFeaturePanel({ data }: { data: FeatureIdeasData }) {
  const profileItems: FeatureInsight[] = [
    {
      title: "Profile completeness",
      metric: data.social.profileCompleteness.metric,
      detail: data.social.profileCompleteness.detail,
      href: "/profile",
      tone: "sky",
    },
    {
      title: "Featured records",
      metric: `${data.social.featuredRecords}`,
      detail: "Records selected for the profile trophy shelf.",
      href: "/course-records",
      tone: "amber",
    },
    {
      title: "Public share preview",
      metric: data.social.publicSharePreview ? "On" : "Off",
      detail: "Preview what friends and public visitors can see.",
      href: "/settings",
      tone: data.social.publicSharePreview ? "green" : "slate",
    },
  ];

  return (
    <DataPanel>
      <SectionHeader
        title="Golfer identity extras"
        description="Completeness, featured records, trophy shelf and public preview are now feature-state aware."
        action={<StatusPill tone="sky">{data.social.profileCompleteness.metric}</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={profileItems}
        moreTitle="More profile checks"
        moreDescription="Records, trophy shelf and public preview."
      />
      <div className="hidden gap-3 p-4 sm:grid md:grid-cols-3">
        {profileItems.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

export function GroupDigestFeaturePanel({ data }: { data: FeatureIdeasData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Group weekly digest"
        description="Summarises group posts, linked challenges and champion-board activity."
        action={<StatusPill tone="green">Digest</StatusPill>}
      />
      <MobileFeatureInsightPreview
        items={data.groupDigest}
        moreTitle="More digest detail"
        moreDescription="Group posts, challenges and champion boards."
      />
      <div className="hidden gap-3 p-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
        {data.groupDigest.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </DataPanel>
  );
}

function HandicapCheckRow({
  check,
}: {
  check: FeatureIdeasData["handicapConfidence"]["checks"][number];
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span>{check.label}</span>
      {check.done ? (
        <CheckCircle2 className="size-4 text-emerald-700" />
      ) : (
        <span className="font-medium text-amber-700">Needed</span>
      )}
    </div>
  );
}

function WeeklyRecapCard({ data }: { data: FeatureIdeasData }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">AI weekly recap</p>
        <StatusPill tone={data.weeklyRecap.generatedFrom.startsWith("openai") ? "green" : "slate"}>
          {data.weeklyRecap.generatedFrom.startsWith("openai") ? "AI" : "Rules"}
        </StatusPill>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{data.weeklyRecap.coachNote}</p>
      <div className="mt-3 grid gap-1 text-sm">
        {data.weeklyRecap.practicePlan.slice(0, 3).map((step) => (
          <div
            key={step}
            className="rounded-md bg-white px-2 py-1 text-muted-foreground ring-1 ring-slate-200"
          >
            {step}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold">Practice plan calendar</p>
      <div className="mt-3 grid gap-2">
        {data.practiceCalendar.slice(0, 4).map((item) => (
          <DataPair
            key={`${item.title}-${item.date.toISOString()}`}
            label={dateFormatter.format(item.date)}
            value={item.title}
          />
        ))}
      </div>
      <form action={saveCurrentWeeklyRecapAction}>
        <Button type="submit" variant="outline" className="mt-3 w-full">
          <ClipboardCheck className="size-4" />
          Save weekly recap
        </Button>
      </form>
    </div>
  );
}

function MobileFeatureInsightPreview({
  items,
  moreTitle,
  moreDescription,
  visibleCount = 2,
}: {
  items: FeatureInsight[];
  moreTitle: string;
  moreDescription?: string;
  visibleCount?: number;
}) {
  const visibleItems = items.slice(0, visibleCount);
  const secondaryItems = items.slice(visibleCount);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 p-3 sm:hidden">
      {visibleItems.map((item) => (
        <InsightCard key={item.title} item={item} compact />
      ))}
      {secondaryItems.length ? (
        <MobileAccordionSection
          title={moreTitle}
          description={moreDescription}
          count={`${secondaryItems.length} more`}
        >
          <div className="grid gap-2">
            {secondaryItems.map((item) => (
              <InsightCard key={item.title} item={item} compact />
            ))}
          </div>
        </MobileAccordionSection>
      ) : null}
    </div>
  );
}

function SocialPreferencesForm({ data }: { data: FeatureIdeasData }) {
  return (
    <form
      action={updateFeaturePreferencesAction}
      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
    >
      <p className="text-sm font-semibold">Auto-share toggles</p>
      <div className="mt-3 grid gap-2 text-sm">
        <CheckboxLine
          name="autoShareRounds"
          label="Post-round recaps"
          checked={data.preferences.autoShareRounds}
        />
        <CheckboxLine
          name="autoSharePbs"
          label="Personal bests"
          checked={data.preferences.autoSharePbs}
        />
        <CheckboxLine
          name="autoShareAchievements"
          label="Achievements"
          checked={data.preferences.autoShareAchievements}
        />
        <CheckboxLine
          name="autoSharePractice"
          label="Practice completions"
          checked={data.preferences.autoSharePractice}
        />
        <CheckboxLine
          name="publicSharePreview"
          label="Public share preview"
          checked={data.preferences.publicSharePreview}
        />
      </div>
      <Button type="submit" className="premium-action mt-3 w-full">
        <Megaphone className="size-4" />
        Save sharing controls
      </Button>
    </form>
  );
}

function CoachChallengeForm({ data }: { data: FeatureIdeasData }) {
  return (
    <form
      action={createCoachSignalChallengeAction}
      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div>
        <p className="font-semibold">Challenge template from coach signal</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.coachChallengeRecommendation.detail}
        </p>
      </div>
      <input type="hidden" name="title" value={data.coachChallengeRecommendation.title} />
      <input type="hidden" name="description" value={data.coachChallengeRecommendation.detail} />
      <input type="hidden" name="clubId" value={data.coachChallengeRecommendation.clubId ?? ""} />
      <input
        type="hidden"
        name="clubType"
        value={data.coachChallengeRecommendation.clubType ?? ""}
      />
      <input type="hidden" name="focusArea" value={data.coachChallengeRecommendation.focusArea} />
      <Button type="submit" variant="outline">
        <Trophy className="size-4" />
        Create challenge
      </Button>
    </form>
  );
}

function FeatureColumn({ title, items }: { title: string; items: FeatureInsight[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <InsightCard key={item.title} item={item} compact />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ item, compact = false }: { item: FeatureInsight; compact?: boolean }) {
  const content = (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{item.title}</p>
        {item.metric ? <StatusPill tone={item.tone as Tone}>{item.metric}</StatusPill> : null}
      </div>
      <p
        className={
          compact ? "mt-2 leading-5 text-muted-foreground" : "mt-3 leading-6 text-muted-foreground"
        }
      >
        {item.detail}
      </p>
    </div>
  );

  return item.href ? (
    <Link href={item.href} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function CheckboxLine({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <Checkbox name={name} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}
