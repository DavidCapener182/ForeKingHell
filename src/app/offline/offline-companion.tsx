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
import { Textarea } from "@/components/ui/textarea";

type SavedPractice = {
  planId: string;
  plan: PracticePlan;
  blockIndex: number;
  completedBlockIds: string[];
  note: string;
  finished?: boolean;
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
  useMobileActivity(view === "practice");
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
      {view !== "saved" ? (
        <Button
          variant="ghost"
          className="min-h-11 justify-self-start"
          onClick={() => setView("saved")}
        >
          Back
        </Button>
      ) : null}
      {view !== "round" && view !== "quick" ? (
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
        <>
          <p className="text-sm text-primary">
            Block {practice.blockIndex + 1} of {practice.plan.blocks.length}
          </p>
          <h2 className="text-2xl font-bold">{block.title}</h2>
          <p className="text-lg">{block.drill}</p>
          <p className="text-muted-foreground">Success target: {block.successTarget}</p>
          <progress
            className="w-full accent-primary"
            max={practice.plan.blocks.length}
            value={practice.completedBlockIds.length}
            aria-label="Completed blocks"
          />
          <Button
            className="min-h-14"
            onClick={() =>
              updatePractice({
                completedBlockIds: [...new Set([...practice.completedBlockIds, block.id])],
                blockIndex: Math.min(practice.plan.blocks.length - 1, practice.blockIndex + 1),
              })
            }
          >
            {practice.completedBlockIds.includes(block.id) ? "Block complete" : "Complete block"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={!practice.blockIndex}
              onClick={() => updatePractice({ blockIndex: practice.blockIndex - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={practice.blockIndex >= practice.plan.blocks.length - 1}
              onClick={() => updatePractice({ blockIndex: practice.blockIndex + 1 })}
            >
              Next
            </Button>
          </div>
          <Textarea
            aria-label="Practice note"
            value={practice.note}
            maxLength={500}
            placeholder="Add note"
            onChange={(e) => updatePractice({ note: e.target.value })}
          />
          <Button
            variant="outline"
            onClick={() => {
              updatePractice({ finished: true });
              setView("saved");
            }}
          >
            Finish practice
          </Button>
          <p className="text-sm text-muted-foreground">
            Activity completion is saved. Measured success still requires imported shots.
          </p>
        </>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </main>
  );
}
