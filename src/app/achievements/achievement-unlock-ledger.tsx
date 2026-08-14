"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableFrame } from "@/components/premium";
import { achievementDomId } from "@/lib/alert-links";
import type { AchievementView } from "@/lib/achievements/service";
import type { AchievementTier } from "@/lib/achievements/types";

const defaultUnlockLedgerLimit = 40;
const unlockLedgerPageSize = 40;

const achievementUnlockColumns: DesktopWorkbenchColumn[] = [
  { id: "achievement", label: "Achievement", locked: true },
  { id: "unlocked", label: "Unlocked" },
  { id: "tier", label: "Tier" },
  { id: "xp", label: "XP" },
  { id: "category", label: "Category" },
  { id: "source", label: "Source" },
  { id: "action", label: "Action", locked: true },
];

const categoryLabels: Record<string, string> = {
  data: "Data",
  power: "Power",
  accuracy: "Accuracy",
  launch: "Launch",
  strike: "Strike",
  driver: "Driver",
  fiveWood: "5W",
  gapping: "Gapping",
  consistency: "Consistency",
  coach: "Coach",
  progress: "Progress",
  speed: "Speed",
  mileage: "Mileage",
  scoring: "Scoring",
  putting: "Putting",
  shortGame: "Short Game",
  roundStats: "Round Stats",
  hidden: "Hidden",
};

const tierLabels: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Master",
  hidden: "Hidden",
};

export function AchievementUnlockLedger({ achievements }: { achievements: AchievementView[] }) {
  const [visibleCount, setVisibleCount] = useState(defaultUnlockLedgerLimit);
  const visibleAchievements = achievements.slice(0, visibleCount);
  const remainingCount = Math.max(0, achievements.length - visibleAchievements.length);
  const resultLabel = `${visibleAchievements.length.toLocaleString("en-GB")} of ${achievements.length.toLocaleString("en-GB")} unlocks`;

  return (
    <Card className="overflow-hidden shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="achievement-ledger" className="border-0">
          <AccordionTrigger className="px-4 py-3 text-left no-underline hover:no-underline sm:px-5">
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-semibold tracking-normal text-foreground">
                XP unlock ledger
              </span>
              <span className="text-sm font-normal leading-5 text-muted-foreground">
                Recent unlocked badges, XP, category and source evidence.
              </span>
            </span>
            <Badge variant="outline" className="ml-auto shrink-0">
              {achievements.length.toLocaleString("en-GB")} unlocks
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/70 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="space-y-3">
              <DesktopTableWorkbenchControls
                viewKey="achievement-unlocks"
                scope="achievements"
                currentViewLabel="Achievement unlock history"
                resultLabel={resultLabel}
                columns={achievementUnlockColumns}
                exportTableId="achievement-unlocks"
                exportFileName="forekinghell-achievement-unlocks.csv"
              />
              {achievements.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Import provider sessions or complete round scorecards to start the XP ledger.
                </div>
              ) : (
                <DataTableFrame
                  mainTable
                  mainTableLabel="Achievement unlock ledger table"
                  stickyFirstColumn
                >
                  <Table
                    className="min-w-[880px]"
                    data-workbench-scope="achievements"
                    data-workbench-export-table="achievement-unlocks"
                    aria-describedby="achievement-unlock-ledger-summary"
                  >
                    <TableCaption id="achievement-unlock-ledger-summary" className="sr-only">
                      Achievement unlock ledger with achievement name, unlock date, tier, XP
                      awarded, category, source evidence and action.
                    </TableCaption>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead
                          data-column="achievement"
                          className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                        >
                          Achievement
                        </TableHead>
                        <TableHead data-column="unlocked">Unlocked</TableHead>
                        <TableHead data-column="tier">Tier</TableHead>
                        <TableHead data-column="xp" className="text-right">
                          XP
                        </TableHead>
                        <TableHead data-column="category">Category</TableHead>
                        <TableHead data-column="source">Source</TableHead>
                        <TableHead data-column="action" className="text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleAchievements.map((achievement) => (
                        <TableRow
                          key={achievement.id}
                          tabIndex={0}
                          className="focus-aaa outline-none"
                        >
                          <TableCell
                            data-column="achievement"
                            className="sticky left-0 z-10 max-w-[18rem] bg-card font-medium text-foreground shadow-[1px_0_0_hsl(var(--border))]"
                          >
                            <span className="block truncate">{achievement.displayName}</span>
                          </TableCell>
                          <TableCell data-column="unlocked">
                            {formatUnlockDate(achievement.unlockedAt)}
                          </TableCell>
                          <TableCell data-column="tier">{tierLabels[achievement.tier]}</TableCell>
                          <TableCell data-column="xp" className="text-right tabular-nums">
                            {achievement.xpAwarded.toLocaleString("en-GB")}
                          </TableCell>
                          <TableCell data-column="category">
                            {categoryLabels[achievement.category] ?? achievement.category}
                          </TableCell>
                          <TableCell data-column="source">
                            {achievement.source
                              ? sourceLabel(achievement.source.kind)
                              : "Older unlock"}
                          </TableCell>
                          <TableCell data-column="action" className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={
                                  achievement.source?.href ?? `#${achievementDomId(achievement.id)}`
                                }
                                prefetch={false}
                              >
                                {achievement.source?.href ? "Open source" : "Open badge"}
                                <ExternalLink className="size-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              )}
              {remainingCount > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {remainingCount.toLocaleString("en-GB")} older unlock
                    {remainingCount === 1 ? "" : "s"} available.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setVisibleCount((current) =>
                          Math.min(achievements.length, current + unlockLedgerPageSize),
                        )
                      }
                    >
                      Show {Math.min(unlockLedgerPageSize, remainingCount)} more
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setVisibleCount(achievements.length)}
                    >
                      Show all
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function sourceLabel(kind: NonNullable<AchievementView["source"]>["kind"]) {
  if (kind === "shot") return "Source shot";
  if (kind === "round") return "Source round";
  if (kind === "session") return "Source session";
  if (kind === "stock") return "Stock yardage";
  if (kind === "progress") return "Progress source";
  if (kind === "speed") return "Speed session";
  return "Source data";
}

function formatUnlockDate(value: string | null) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
