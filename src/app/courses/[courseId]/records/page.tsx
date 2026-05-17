import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Medal, Send, ShieldCheck, Target, Trophy, Users } from "lucide-react";

import { PageShell, StatusPill } from "@/components/premium";
import {
  BottomSheet,
  CourseRecordCard,
  MobileAppShell,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseRecordCourseData, verificationTierLabel } from "@/lib/course-records";

export const dynamic = "force-dynamic";

type CourseRecordsPageProps = {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ tab?: string }>;
};

export default async function CourseRecordsForCoursePage({ params, searchParams }: CourseRecordsPageProps) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const activeTab = parseTab(query?.tab);
  const data = await getCourseRecordCourseData(courseId, activeTab);

  if (!data) {
    notFound();
  }

  const champion = data.championCard?.champion;

  return (
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar
          title={data.course.name}
          leading={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
              <Link href="/course-records" prefetch={false} aria-label="Records">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          }
          actions={
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
              <Link href={`/courses/${data.course.id}/tournaments`} prefetch={false} aria-label="Events">
                <Trophy className="size-5" />
              </Link>
            </Button>
          }
        />
        <MobileStatusAction
          label="Course Champion"
          value={champion?.profile?.displayName ?? "Open board"}
          detail={
            champion?.profile
              ? `${champion.result.scoreLabel} · ${verificationTierLabel(champion.result.verificationTier)}`
              : "Submit a verified round to become the first champion."
          }
          action={
            champion ? (
              <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                <Link href={`/course-records/${champion.record.id}`} prefetch={false}>Challenge</Link>
              </Button>
            ) : null
          }
        />
        <PageArtwork
          variant="fairway"
          alt=""
          crop="random"
          cropKey={data.course.id}
          className="block h-40 min-h-0 rounded-lg"
          sizes="100vw"
        />
        <MobileTabBar
          activeKey={activeTab}
          tabs={[
            { key: "all_time", label: "Records", href: `/courses/${data.course.id}/records?tab=all_time` },
            { key: "holes", label: "Holes", href: `/courses/${data.course.id}/records?tab=holes` },
            { key: "month", label: "Monthly", href: `/courses/${data.course.id}/records?tab=month` },
            { key: "friends", label: "Friends", href: `/courses/${data.course.id}/records?tab=friends` },
          ]}
        />
        {data.previousRounds.length > 0 ? (
          <BottomSheet label="Submit attempt" title="Eligible saved rounds">
            <div className="grid gap-3">
              {data.previousRounds.map((round) => (
                <div key={round.id} className="rounded-lg border border-[#E5E7EB] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{round.title}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {round.teeSetName ?? "Any tee"} · {round.holeCount} holes · {round.proofLabel}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold">{round.totalScore}</p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {round.suggestions.map((suggestion) => (
                      <Button key={suggestion.recordId} asChild variant="outline" className="justify-between rounded-full">
                        <Link href={`/course-records/${suggestion.recordId}?sessionId=${round.id}#submit-record`} prefetch={false}>
                          {suggestion.label}
                          <span>{suggestion.value}</span>
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </BottomSheet>
        ) : null}
        <NativeListSection title="Record boards">
          {data.recordCards.map(({ record, category, champion: recordChampion, viewerBest }) => (
            <CourseRecordCard
              key={record.id}
              href={`/course-records/${record.id}`}
              title={category.name}
              champion={recordChampion?.profile?.displayName}
              score={recordChampion?.result.scoreLabel}
              proof={recordChampion?.result.verificationTier}
              cta={viewerBest ? `You ${viewerBest.result.scoreLabel}` : "Challenge"}
            />
          ))}
          {data.recordCards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
              No boards match this scope yet.
            </p>
          ) : null}
        </NativeListSection>
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/course-records" prefetch={false}>
            <ArrowLeft className="size-4" />
            Records
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/courses/${data.course.id}/tournaments`} prefetch={false}>
            <Trophy className="size-4" />
            Events
          </Link>
        </Button>
      </div>

      <div className="hidden sm:contents">
      <header className="premium-hero overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <StatusPill tone="amber">Course champion</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">{data.course.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Records are scoped by course, tee set, format, verification tier and date window.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">{data.teeSets[0]?.name ?? "Any tee"}</Badge>
              <Badge variant="outline">{data.friendCount} friends in scope</Badge>
              <Badge variant="outline">Verified board first</Badge>
            </div>
          </div>
          <div className="rounded-lg border bg-[#F5F6F4] p-3">
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={data.course.id}
              className="mb-3 block h-24 min-h-0 rounded-lg"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
            {champion?.profile ? (
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Medal className="size-4 text-amber-600" />
                  Current Champion
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-normal">{champion.profile.displayName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {champion.result.scoreLabel} · {verificationTierLabel(champion.result.verificationTier)}
                </p>
                <Button asChild className="mt-3 w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                  <Link href={`/course-records/${champion.record.id}`} prefetch={false}>Challenge record</Link>
                </Button>
              </div>
            ) : (
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  No champion yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Submit a verified round to become the first course champion.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="premium-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Previous rounds you can submit</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scores come from saved rounds. Rapsodo imports enter as Gold or Silver, and saved scorecards seed Bronze review entries.
            </p>
          </div>
          <Badge variant="secondary">{data.previousRounds.length} rounds</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.previousRounds.map((round) => (
            <article key={round.id} className="rounded-lg border bg-[#F5F6F4] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{round.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {round.teeSetName ?? "Any tee"} · {round.holeCount} holes · {round.proofLabel}
                  </p>
                </div>
                <p className="text-2xl font-semibold tracking-normal">{round.totalScore}</p>
              </div>
              <div className="mt-3 grid gap-2">
                {round.suggestions.map((suggestion) => (
                  <Button key={suggestion.recordId} asChild variant="outline" size="sm" className="justify-between bg-white">
                    <Link href={`/course-records/${suggestion.recordId}?sessionId=${round.id}#submit-record`} prefetch={false}>
                      <span>{suggestion.label}</span>
                      <span className="inline-flex items-center gap-1">
                        {suggestion.value}
                        <Send className="size-3.5" />
                      </span>
                    </Link>
                  </Button>
                ))}
              </div>
            </article>
          ))}
          {data.previousRounds.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No saved rounds for this course yet. Import or log a round first, then come back here to submit it.
            </p>
          ) : null}
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Course record scopes">
        <TabLink courseId={data.course.id} tab="all_time" activeTab={activeTab} label="All-time" count={data.tabs.allTimeCount} icon={<Trophy className="size-4" />} />
        <TabLink courseId={data.course.id} tab="month" activeTab={activeTab} label="This month" count={data.tabs.monthCount} icon={<CalendarDays className="size-4" />} />
        <TabLink courseId={data.course.id} tab="friends" activeTab={activeTab} label="Friends" count={data.tabs.friendsCount} icon={<Users className="size-4" />} />
        <TabLink courseId={data.course.id} tab="holes" activeTab={activeTab} label="Holes" count={data.tabs.holesCount} icon={<Target className="size-4" />} />
      </nav>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.recordCards.map(({ record, category, champion: recordChampion, viewerBest, friendToBeat }) => (
          <Link
            key={record.id}
            href={`/course-records/${record.id}`}
            prefetch={false}
            className="premium-card p-4 transition hover:border-emerald-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant={recordChampion?.result.verificationStatus === "verified" ? "secondary" : "outline"}>
                  {record.period === "month" ? "This month" : record.scope === "friends" ? "Friends" : "All-time"}
                </Badge>
                <h2 className="mt-3 text-xl font-semibold tracking-normal">{category.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{category.description}</p>
              </div>
              <Trophy className="size-5 shrink-0 text-amber-600" />
            </div>
            <div className="mt-4 rounded-lg bg-[#F5F6F4] p-3 text-sm">
              {recordChampion?.profile ? (
                <>
                  <p className="font-medium">{recordChampion.profile.displayName}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-normal">{recordChampion.result.scoreLabel}</p>
                  <p className="mt-1 text-muted-foreground">{verificationTierLabel(recordChampion.result.verificationTier)}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No entries yet. Set the first mark.</p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-lg border bg-white px-2 py-2">
                Your best: {viewerBest ? viewerBest.result.scoreLabel : "--"}
              </span>
              <span className="rounded-lg border bg-white px-2 py-2">
                Friend: {friendToBeat?.profile ? friendToBeat.profile.displayName : "--"}
              </span>
            </div>
          </Link>
        ))}
        {data.recordCards.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
            No boards match this scope yet.
          </div>
        ) : null}
      </section>
      </div>
    </PageShell>
  );
}

function TabLink({
  courseId,
  tab,
  activeTab,
  label,
  count,
  icon,
}: {
  courseId: string;
  tab: "all_time" | "month" | "friends" | "holes";
  activeTab: string;
  label: string;
  count: number;
  icon: ReactNode;
}) {
  const active = activeTab === tab;

  return (
    <Link
      href={`/courses/${courseId}/records?tab=${tab}`}
      prefetch={false}
      className={
        active
          ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0B7A3B] px-3 text-sm font-semibold text-white"
          : "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold"
      }
    >
      {icon}
      {label}
      <span className={active ? "text-white/70" : "text-muted-foreground"}>{count}</span>
    </Link>
  );
}

function parseTab(value?: string): "all_time" | "month" | "friends" | "holes" {
  if (value === "month" || value === "friends" || value === "holes") {
    return value;
  }

  return "all_time";
}
