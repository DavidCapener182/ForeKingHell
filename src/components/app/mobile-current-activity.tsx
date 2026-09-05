"use client";
import { useEffect, useState } from "react";
import { Flag, Play } from "lucide-react";
import { MobileSection } from "./mobile-screen";
import { MobileGroupedList, MobileListRow } from "./mobile-primitives";
export function MobileCurrentActivity({
  accountId,
  plan,
  round,
}: {
  accountId: string;
  plan: { id: string; title: string; status: string } | null;
  round: { id: string; courseName: string | null } | null;
}) {
  const [local, setLocal] = useState<{ planFinished: boolean; quick: string | null }>({
    planFinished: false,
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
          planFinished: saved?.planId === plan?.id && saved?.finished === true,
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
  const activePlan =
    plan && ["active", "awaiting_import"].includes(plan.status) && !local.planFinished;
  if (!activePlan && !round && !local.quick) return null;
  return (
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
            label="Resume Range Mode"
            detail={plan.title}
            href="/practice"
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
  );
}
