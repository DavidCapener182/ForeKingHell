import Link from "next/link";
import type { ReactNode } from "react";
import { Award, BarChart3, Lock, Plus, Radio, Trophy, Upload, Users, Zap } from "lucide-react";

import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import {
  PageShell,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getFeedPageData } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const data = await getFeedPageData();
  const kudos = data.items.reduce((total, item) => total + item.reactionCount, 0);
  const comments = data.items.reduce((total, item) => total + item.commentCount, 0);
  const feedXp = data.items.reduce((total, item) => total + xpFromFeedItem(item.metricValue), 0);

  return (
    <PageShell size="7xl" className="bg-slate-50/20">
      <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:items-start">
        <aside className="hidden lg:grid lg:sticky lg:top-28 lg:gap-4">
          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="h-20 bg-[linear-gradient(135deg,#111827,#047857_55%,#38bdf8)]" />
            <div className="grid gap-3 p-4 pt-0">
              <div className="-mt-8">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                  size="lg"
                />
              </div>
              <div>
                <Link href="/profile" prefetch={false} className="font-semibold hover:underline">
                  {data.profile.displayName}
                </Link>
                <p className="text-sm text-muted-foreground">@{data.profile.username}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Friends" value={data.friendCount} />
                <MiniStat label="XP" value={numberFormatter.format(data.totalXp)} />
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile" prefetch={false}>Edit profile</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-3 shadow-sm">
            <p className="px-1 text-sm font-semibold">Social shortcuts</p>
            <div className="mt-2 grid gap-1">
              <SideLink href="/friends" icon={<Users className="size-4" />} label="Friends" />
              <SideLink href="/groups" icon={<Users className="size-4" />} label="Groups" />
              <SideLink href="/challenges" icon={<Trophy className="size-4" />} label="Challenges" />
              <SideLink href="/leaderboard" icon={<BarChart3 className="size-4" />} label="Leaderboards" />
            </div>
          </section>
        </aside>

        <main className="grid gap-4">
          <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <StatusPill tone="green">Social feed</StatusPill>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">Feed</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  PBs, achievements, imports, rounds and challenge moments from your golf network.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/friends" prefetch={false}>
                    <Users className="size-4" />
                    Find friends
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/challenges" prefetch={false}>
                    <Plus className="size-4" />
                    Join challenge
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-4">
              <PulseCard label="Friends active this week" value={Math.min(data.friendCount, 3)} detail="From your network" />
              <PulseCard label="PBs" value={data.items.filter((item) => item.itemType.includes("pb")).length} detail="Recent personal bests" />
              <PulseCard label="Challenge closing soon" value={data.items.filter((item) => item.itemType.includes("challenge")).length > 0 ? 1 : 0} detail="Check the boards" />
              <PulseCard label="New comments" value={comments} detail="Across visible cards" />
            </div>
          </section>

          <section className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["All", "Friends", "PBs", "Achievements", "Challenges", "Rounds", "Me"].map((filter) => (
                <Button key={filter} type="button" variant={filter === "All" ? "default" : "outline"} size="sm" className="shrink-0">
                  {filter}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <SocialAvatar
                displayName={data.profile.displayName}
                username={data.profile.username}
                avatarUrl={data.profile.avatarUrl}
                href="/profile"
              />
              <div className="grid gap-3">
                <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                  Your feed is automatic right now. Import a session, complete a round, or join a challenge to post a verified update.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/import" prefetch={false}>
                      <Upload className="size-4" />
                      Import
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/rounds/new" prefetch={false}>
                      <Radio className="size-4" />
                      Log round
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile" prefetch={false}>
                      <Lock className="size-4" />
                      Privacy
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <FeedCardList items={data.items} />
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Network pulse</p>
            <div className="mt-3 grid gap-2">
              <PulseRow icon={<Zap className="size-4 text-emerald-600" />} label="Total XP" value={numberFormatter.format(data.totalXp)} />
              <PulseRow icon={<Award className="size-4 text-orange-500" />} label="Feed XP" value={numberFormatter.format(feedXp)} />
              <PulseRow icon={<Award className="size-4 text-emerald-600" />} label="Kudos" value={kudos} />
              <PulseRow icon={<Radio className="size-4 text-sky-600" />} label="Comments" value={comments} />
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Privacy state</p>
            <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
              <p>Default feed visibility is <span className="font-medium text-foreground">{data.profile.feedVisibilityDefault}</span>.</p>
              <p>{data.publicProfileCount} golfers are discoverable through public profile search.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile" prefetch={false}>Change social defaults</Link>
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </PageShell>
  );
}

const numberFormatter = new Intl.NumberFormat("en-GB");

function PulseCard({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-4 py-3">
      <p className="text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-slate-50 px-3 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} prefetch={false} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-slate-50">
      {icon}
      {label}
    </Link>
  );
}

function PulseRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold tracking-normal">{value}</span>
    </div>
  );
}

function xpFromFeedItem(metricValue: string | null) {
  const match = metricValue?.replace(/,/g, "").match(/^\+?(\d+(?:\.\d+)?)\s*XP$/i);
  return match ? Math.round(Number(match[1])) : 0;
}
