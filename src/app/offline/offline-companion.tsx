"use client";
import Link from "next/link";
import { MobileLiveRound, type SavedRound } from "@/app/rounds/mobile-live-round";
import { QuickRangeCompanionSession } from "@/app/practice/quick-range/quick-range-session";
import { Suspense, useEffect, useState } from "react";
import type { PracticePlan } from "@/lib/practice-planner";
import { MobileQuickBag } from "@/app/quick-bag/mobile-quick-bag";
import { readQuickBagSnapshot, type QuickBagSnapshot } from "@/lib/quick-bag-snapshot";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { useMobileActivity } from "@/components/app/use-mobile-activity";
import { Button } from "@/components/ui/button";
import { MobileHoleStrategy } from "@/app/courses/strategy/mobile-hole-strategy";
import {
  caddieBookKey,
  readSavedCaddieBooks,
  type CaddieBookSnapshot,
} from "@/lib/caddie-book-snapshot";
import type { HoleStrategyMode } from "@/lib/course-strategy";
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
type SavedBag = QuickBagSnapshot;
export function OfflineCompanion() {
  const [openedAt] = useState(() => Date.now());
  const [books, setBooks] = useState<CaddieBookSnapshot[]>([]);
  const [bookId, setBookId] = useState<string | null>(null);
  const [bagReturn, setBagReturn] = useState("saved");
  const [round, setRound] = useState<SavedRound | null>(null);
  const [quick, setQuick] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [bag, setBag] = useState<SavedBag | null>(null);
  const [practice, setPractice] = useState<SavedPractice | null>(null);
  const [view, setView] = useState("saved");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let loadedAccount: string | null = null;
    const clearPrivateView = () => {
      setBooks([]);
      setBookId(null);
      setRound(null);
      setQuick(false);
      setBag(null);
      setPractice(null);
      setAccount(null);
      setView("saved");
      setMessage(
        "The account on this device changed. Reopen ForeKingHell online before continuing.",
      );
    };
    const checkAccount = () => {
      try {
        if (loadedAccount && localStorage.getItem("fkh:offline-account") !== loadedAccount) {
          loadedAccount = null;
          clearPrivateView();
        }
      } catch {
        clearPrivateView();
      }
    };
    window.addEventListener("storage", checkAccount);
    window.addEventListener("focus", checkAccount);
    document.addEventListener("visibilitychange", checkAccount);
    const timer = setTimeout(() => {
      try {
        const id = localStorage.getItem("fkh:offline-account");
        if (!id) return;
        loadedAccount = id;
        setAccount(id);
        const savedBooks = readSavedCaddieBooks(localStorage, id);
        setBooks(savedBooks);
        const query = new URLSearchParams(window.location.search);
        const requestedBook = savedBooks.find(
          (b) =>
            b.course.id === query.get("courseId") &&
            (!query.get("teeSetId") || b.tee?.id === query.get("teeSetId")),
        );
        if (
          requestedBook &&
          (window.location.pathname === "/courses/strategy" || query.get("view") === "caddie")
        ) {
          const requestedHole = Number(query.get("hole"));
          const requestedMode = query.get("option");
          const selected: CaddieBookSnapshot = {
            ...requestedBook,
            selectedHole: requestedBook.strategy.some((hole) => hole.holeNumber === requestedHole)
              ? requestedHole
              : requestedBook.selectedHole,
            selectedMode:
              requestedMode === "safe" ||
              requestedMode === "normal" ||
              requestedMode === "aggressive"
                ? requestedMode
                : requestedBook.selectedMode,
          };
          setBooks(
            savedBooks.map((item) => (item.course.id === selected.course.id ? selected : item)),
          );
          setBookId(requestedBook.course.id);
          setView("book");
        }
        const roundKey = Array.from({ length: localStorage.length }, (_, index) =>
          localStorage.key(index),
        ).find((key) => key?.startsWith(`fkh:live-round:${id}:`));
        const savedRound = roundKey ? parseSaved(localStorage.getItem(roundKey)) : null;
        if (
          savedRound?.context?.sessionId &&
          typeof savedRound.version === "string" &&
          Array.isArray(savedRound.holes) &&
          savedRound.holes.length
        )
          setRound(savedRound);
        const quickDraft = parseSaved(localStorage.getItem(`fkh:quick-range:${id}`));
        setQuick(Boolean(quickDraft && ["active", "paused"].includes(quickDraft.state)));
        const savedBag = readQuickBagSnapshot(localStorage.getItem(`fkh:quick-bag:${id}`), id);
        if (savedBag) setBag(savedBag);
        const savedPractice = parseSaved(
          localStorage.getItem(`fkh:active-practice:${id}`),
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
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", checkAccount);
      window.removeEventListener("focus", checkAccount);
      document.removeEventListener("visibilitychange", checkAccount);
    };
  }, []);
  useMobileActivity(view === "practice" && !practice?.finished);
  function updatePractice(update: Partial<SavedPractice>) {
    if (!practice || !account) return;
    const next = { ...practice, ...update };
    setPractice(next);
    try {
      if (localStorage.getItem("fkh:offline-account") !== account) return;
      localStorage.setItem(`fkh:active-practice:${account}`, JSON.stringify(next));
      setMessage("Saved on this iPhone. Open Practice after reconnecting to sync.");
    } catch {
      setMessage("Storage unavailable. Keep this page open.");
    }
  }
  const book = books.find((item) => item.course.id === bookId);
  function openBook(selected: CaddieBookSnapshot) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "caddie");
    url.searchParams.set("courseId", selected.course.id);
    if (selected.tee) url.searchParams.set("teeSetId", selected.tee.id);
    else url.searchParams.delete("teeSetId");
    url.searchParams.set("hole", String(selected.selectedHole));
    url.searchParams.set("option", selected.selectedMode);
    window.history.replaceState(null, "", url);
    setBookId(selected.course.id);
    setView("book");
  }
  function showSaved() {
    const url = new URL(window.location.href);
    for (const key of ["view", "courseId", "teeSetId", "hole", "option"])
      url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
    setView("saved");
  }
  function updateBookSelection(hole: number, mode: HoleStrategyMode["id"]) {
    if (!book || !account) return;
    const next = { ...book, selectedHole: hole, selectedMode: mode };
    setBooks((current) => current.map((item) => (item.course.id === next.course.id ? next : item)));
    try {
      if (localStorage.getItem("fkh:offline-account") !== account) return;
      localStorage.setItem(caddieBookKey(account, book.course.id), JSON.stringify(next));
    } catch {
      setMessage("Hole selection could not be saved. Keep this screen open.");
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
          onClick={() => (view === "bag" && bagReturn === "book" ? setView("book") : showSaved())}
        >
          Back
        </Button>
      ) : null}
      {view !== "round" && view !== "quick" && view !== "practice" && view !== "book" ? (
        <MobileLargeTitle
          title={view === "bag" ? "Quick Bag" : "Saved golf"}
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
            <Button
              variant="outline"
              className="min-h-14"
              onClick={() => {
                setBagReturn("saved");
                setView("bag");
              }}
            >
              Open Quick Bag
            </Button>
          ) : null}
          {books.length ? (
            <MobileSection title="Saved caddie books">
              <div className="grid divide-y">
                {books.map((item) => (
                  <Button
                    key={item.course.id}
                    variant="ghost"
                    className="h-auto min-h-14 justify-start whitespace-normal px-0 py-3 text-left"
                    onClick={() => openBook(item)}
                  >
                    <span className="grid gap-1">
                      <strong>{item.course.name}</strong>
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.tee?.name ?? "Tee not recorded"} · {item.strategy.length} holes
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Saved {savedDate(item.storedAt)}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </MobileSection>
          ) : null}
          {!practice && !bag?.clubs.length && !books.length ? (
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
      ) : view === "book" && book && account ? (
        <div className="grid gap-3" data-offline-caddie-book>
          <div>
            <p className="mobile-type-headline">{book.course.name}</p>
            <p className="mobile-type-footnote text-muted-foreground">
              {book.tee?.name ?? "Tee not recorded"}
            </p>
          </div>
          <p role="status" className="mobile-type-footnote text-muted-foreground">
            Saved {savedDate(book.storedAt)}.{" "}
            {openedAt - Date.parse(book.storedAt) > 86_400_000
              ? "This copy is over a day old. "
              : ""}
            Reconnect to refresh club evidence and course information.
            {book.legacy
              ? " Earlier snapshot: map and per-option dispersion were not saved."
              : " Saved hole geometry; aerial imagery needs a connection."}
          </p>
          <Suspense fallback={<p role="status">Opening your saved hole…</p>}>
            <MobileHoleStrategy
              key={`${book.course.id}:${book.tee?.id}`}
              offline
              strategies={book.strategy}
              course={book.course}
              tee={book.tee}
              accountId={account}
              courseMap={book.courseMap}
              savedSelection={{ hole: book.selectedHole, mode: book.selectedMode }}
              onSelectionChange={updateBookSelection}
              onQuickBag={
                bag?.clubs.length
                  ? () => {
                      setBagReturn("book");
                      setView("bag");
                    }
                  : undefined
              }
            />
          </Suspense>
        </div>
      ) : view === "bag" && bag ? (
        <MobileQuickBag clubs={bag.clubs} savedAt={bag.storedAt} legacy={bag.legacy} />
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

function parseSaved(raw: string | null) {
  try {
    return JSON.parse(raw ?? "null");
  } catch {
    return null;
  }
}
function savedDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
