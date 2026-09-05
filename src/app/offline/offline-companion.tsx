"use client";
import Link from "next/link";
import { MobileLiveRound, type SavedRound } from "@/app/rounds/mobile-live-round";
import { QuickRangeCompanionSession } from "@/app/practice/quick-range/quick-range-session";
import { useEffect, useState } from "react";
import type { PracticePlan } from "@/lib/practice-planner";
import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { useMobileActivity } from "@/components/app/use-mobile-activity";
import { Button } from "@/components/ui/button";
import { ActiveRangeMode } from "@/app/practice/active-range-mode";

type SavedPractice = {
  planId: string;
  plan: PracticePlan;
  blockIndex: number;
  completedBlockIds: string[];
  note: string;
  finished?: boolean;
  remainingBalls?: Record<string, number>;
};
type SavedBag = { clubs: QuickBagClub[]; storedAt: string };
export function OfflineCompanion() {
  const [round, setRound] = useState<SavedRound | null>(null);
  const [quick, setQuick] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [bag, setBag] = useState<SavedBag | null>(null);
  const [practice, setPractice] = useState<SavedPractice | null>(null);
  const [view, setView] = useState("saved");
  const [mode, setMode] = useState("carry");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const id = localStorage.getItem("fkh:offline-account");
        if (!id) return;
        setAccount(id);
        const roundKey = Array.from({ length: localStorage.length }, (_, index) =>
          localStorage.key(index),
        ).find((key) => key?.startsWith(`fkh:live-round:${id}:`));
        const savedRound = roundKey ? JSON.parse(localStorage.getItem(roundKey) ?? "null") : null;
        if (
          savedRound?.context?.sessionId &&
          typeof savedRound.version === "string" &&
          Array.isArray(savedRound.holes) &&
          savedRound.holes.length
        )
          setRound(savedRound);
        const quickDraft = JSON.parse(localStorage.getItem(`fkh:quick-range:${id}`) ?? "null");
        setQuick(Boolean(quickDraft && ["active", "paused"].includes(quickDraft.state)));
        const savedBag = JSON.parse(
          localStorage.getItem(`fkh:quick-bag:${id}`) ?? "null",
        ) as SavedBag | null;
        if (savedBag && Array.isArray(savedBag.clubs)) setBag(savedBag);
        const savedPractice = JSON.parse(
          localStorage.getItem(`fkh:active-practice:${id}`) ?? "null",
        ) as SavedPractice | null;
        if (
          savedPractice?.plan &&
          Array.isArray(savedPractice.plan.blocks) &&
          Array.isArray(savedPractice.completedBlockIds) &&
          Number.isInteger(savedPractice.blockIndex)
        )
          setPractice(savedPractice);
      } catch {
        setMessage("Saved activity could not be opened on this device.");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useMobileActivity(view === "practice" && !practice?.finished);
  function updatePractice(update: Partial<SavedPractice>) {
    if (!practice || !account) return;
    const next = { ...practice, ...update };
    setPractice(next);
    try {
      localStorage.setItem(`fkh:active-practice:${account}`, JSON.stringify(next));
      setMessage("Saved on this iPhone. Open Practice after reconnecting to sync.");
    } catch {
      setMessage("Storage unavailable. Keep this page open.");
    }
  }
  const block = practice?.plan.blocks[practice.blockIndex];
  return (
    <main
      data-app-surface="companion"
      data-mobile-platform="apple"
      className="grid min-h-dvh content-start gap-6 bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-foreground"
    >
      {view !== "saved" && !(view === "practice" && !practice?.finished) ? (
        <Button
          variant="ghost"
          className="min-h-11 justify-self-start"
          onClick={() => setView("saved")}
        >
          Back
        </Button>
      ) : null}
      {view !== "round" && view !== "quick" && view !== "practice" ? (
        <MobileLargeTitle
          title={
            view === "bag" ? "Quick Bag" : view === "practice" ? "Range Mode" : "You're offline"
          }
          detail="Your saved golf essentials are here."
        />
      ) : null}
      {view === "round" && round?.context && account ? (
        <MobileLiveRound
          accountId={account}
          {...round.context}
          holes={round.holes}
          recordVersion={round.version}
        />
      ) : view === "quick" && account ? (
        <div className="px-4">
          <QuickRangeCompanionSession accountId={account} focus="Distance control" />
        </div>
      ) : null}
      {view === "saved" ? (
        <>
          {round?.context ? (
            <Button className="min-h-14" onClick={() => setView("round")}>
              Continue {round.context.course}
            </Button>
          ) : null}
          {quick ? (
            <Button variant="outline" className="min-h-14" onClick={() => setView("quick")}>
              Resume Quick Range
            </Button>
          ) : null}
          {practice ? (
            <MobileSection title={practice.finished ? "Completed activity" : "Saved practice"}>
              <h3 className="text-xl font-semibold">{practice.plan.title}</h3>
              <p className="text-muted-foreground">
                {practice.completedBlockIds.length} of {practice.plan.blocks.length} blocks complete
              </p>
              <Button className="min-h-12" onClick={() => setView("practice")}>
                {practice.finished ? "Review activity" : "Resume Range Mode"}
              </Button>
            </MobileSection>
          ) : null}
          {bag?.clubs.length ? (
            <Button variant="outline" className="min-h-14" onClick={() => setView("bag")}>
              Open Quick Bag
            </Button>
          ) : null}
          {!practice && !bag?.clubs.length ? (
            <p className="text-muted-foreground">
              Open Quick Bag or start a practice while connected to save it for later.
            </p>
          ) : null}
          <Button asChild className="min-h-12">
            <Link href="/practice" prefetch={false}>
              Reconnect and sync
            </Link>
          </Button>
        </>
      ) : view === "bag" && bag ? (
        <>
          <MobileSegmentedControl
            ariaLabel="Offline yardage type"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "carry", label: "Carry" },
              { value: "total", label: "Total" },
            ]}
          />
          <div className="overflow-hidden rounded-2xl bg-card">
            {bag.clubs.map((club) => (
              <div key={club.id} className="mobile-yardage-row">
                <span>
                  <strong>{club.label}</strong>
                  <small>
                    {club.lowYd != null && club.highYd != null
                      ? `${Math.round(club.lowYd)}–${Math.round(club.highYd)} yd carry`
                      : "Range unavailable"}
                  </small>
                </span>
                <span className="mobile-yardage-number">
                  {(mode === "carry" ? club.trustedCarryYd : club.totalYd) != null
                    ? Math.round((mode === "carry" ? club.trustedCarryYd : club.totalYd)!)
                    : "—"}
                  <small>yd</small>
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Saved {new Date(bag.storedAt).toLocaleDateString("en-GB")}. Reconnect to refresh
            yardages.
          </p>
        </>
      ) : view === "practice" && practice && block ? (
        practice.finished ? (
          <MobileSection title="Practice activity">
            <h2 className="mobile-type-title2">{practice.plan.title}</h2>
            <p className="mobile-type-callout text-muted-foreground">
              Activity saved. Measured success needs imported shots.
            </p>
            <ol className="divide-y">
              {practice.plan.blocks.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="mobile-type-headline">{item.title}</p>
                  <p className="mobile-type-footnote text-muted-foreground">
                    {practice.completedBlockIds.includes(item.id) ? "Completed" : "Incomplete"}
                  </p>
                </li>
              ))}
            </ol>
            {practice.note ? <p className="mobile-type-body">{practice.note}</p> : null}
          </MobileSection>
        ) : (
          <ActiveRangeMode
            plan={practice.plan}
            block={block}
            blockIndex={practice.blockIndex}
            blockDirection={null}
            completedBlockIds={practice.completedBlockIds}
            note={practice.note}
            remainingBalls={practice.remainingBalls?.[block.id] ?? block.ballCount ?? 0}
            onRemainingBalls={(count) =>
              updatePractice({ remainingBalls: { ...practice.remainingBalls, [block.id]: count } })
            }
            pending={false}
            onNote={(note) => updatePractice({ note })}
            onPrevious={() => updatePractice({ blockIndex: Math.max(0, practice.blockIndex - 1) })}
            onNext={() =>
              updatePractice({
                blockIndex: Math.min(practice.plan.blocks.length - 1, practice.blockIndex + 1),
              })
            }
            onComplete={() =>
              updatePractice({
                completedBlockIds: [...new Set([...practice.completedBlockIds, block.id])],
                blockIndex: Math.min(practice.plan.blocks.length - 1, practice.blockIndex + 1),
              })
            }
            onPause={() => setView("saved")}
            onFinish={() => {
              updatePractice({ finished: true });
              setView("saved");
            }}
            practicePlanId={practice.planId}
          />
        )
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </main>
  );
}
