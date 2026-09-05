"use client";
import { useEffect, useState } from "react";
import { Flag, Play, ClipboardCheck } from "lucide-react";
import { MobileSection } from "./mobile-screen";
import { MobileGroupedList, MobileListRow } from "./mobile-primitives";
import { todayPlanAction, type TodayPlanActivity } from "@/lib/mobile-today-briefing";
export function MobileTodayActivities({
  accountId,
  plan,
  round,
}: {
  accountId: string;
  plan: TodayPlanActivity | null;
  round: { id: string; courseName: string | null } | null;
}) {
  const [local, setLocal] = useState<{
    planActivity: "unfinished" | "finished" | null;
    quick: string | null;
  }>({
    planActivity: null,
    quick: null,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`fkh:active-practice:${accountId}`) ?? "null",
        );
        const quick = JSON.parse(localStorage.getItem(`fkh:quick-range:${accountId}`) ?? "null");
        setLocal({
          planActivity:
            saved && saved.planId === plan?.id
              ? saved.finished === true
                ? "finished"
                : "unfinished"
              : null,
          quick:
            quick && ["active", "paused"].includes(quick.state) && typeof quick.focus === "string"
              ? quick.focus
              : null,
        });
      } catch {
        /* Server activity remains available without local storage. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [accountId, plan?.id]);
  const planAction = todayPlanAction(plan, local.planActivity);
  const activePlan = planAction?.kind === "active" ? planAction : null;
  const nextAction = planAction?.kind === "next" ? planAction : null;
  return (
    <>
      {activePlan || round || local.quick ? (
        <MobileSection title="Current activity">
          <MobileGroupedList>
            {round ? (
              <MobileListRow
                icon={Flag}
                label="Continue round"
                detail={round.courseName ?? "Round in progress"}
                href={`/rounds/${round.id}`}
              />
            ) : null}
            {activePlan ? (
              <MobileListRow
                icon={Play}
                label={activePlan.label}
                detail={activePlan.detail}
                href={activePlan.href}
              />
            ) : null}
            {local.quick ? (
              <MobileListRow
                icon={Play}
                label="Resume Quick Range"
                detail={local.quick}
                href="/practice/quick-range"
              />
            ) : null}
          </MobileGroupedList>
        </MobileSection>
      ) : null}
      <MobileSection title="Next up">
        <MobileGroupedList>
          {nextAction ? (
            <MobileListRow
              icon={ClipboardCheck}
              label={nextAction.label}
              detail={nextAction.detail}
              href={nextAction.href}
            />
          ) : (
            <MobileListRow
              icon={Flag}
              label={round ? "Your on-course club numbers" : "Prepare your next round"}
              detail={
                round
                  ? "Trusted carries for your next shot"
                  : "Course strategy and trusted club numbers"
              }
              href={round ? "/quick-bag" : "/play"}
            />
          )}
        </MobileGroupedList>
      </MobileSection>
    </>
  );
}
