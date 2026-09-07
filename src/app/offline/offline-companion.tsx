"use client";
import { ChevronLeft, WifiOff } from "lucide-react";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import {
  readOfflineSavedRounds,
  requestedOfflineRound,
  type OfflineSavedRound,
} from "@/lib/offline-saved-rounds";
import { MobileLiveRound } from "@/app/rounds/mobile-live-round";
import { parseQuickRangeDraft } from "@/app/practice/quick-range/quick-range-draft";
import { QuickRangeCompanionSession } from "@/app/practice/quick-range/quick-range-session";
import { Suspense, useEffect, useRef, useState } from "react";
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

import { offlineDestination } from "@/lib/offline-destination";
import { createOfflineConnectionCheck } from "@/lib/offline-connection";
import { OfflineNavigation } from "./offline-navigation";
import styles from "./offline.module.css";
import { BRAND_NAME } from "@/lib/brand";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Input } from "@/components/ui/input";

type SavedPractice = {
  planId: string;
  plan: PracticePlan;
  blockIndex: number;
  completedBlockIds: string[];
  note: string;
  finished?: boolean;
  savedAt?: string;
  remainingBalls?: Record<string, number>;
};
type SavedBag = QuickBagSnapshot;
export function OfflineCompanion() {
  const [loaded, setLoaded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [resourceQuery, setResourceQuery] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [books, setBooks] = useState<CaddieBookSnapshot[]>([]);
  const [bookId, setBookId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<OfflineSavedRound[]>([]);
  const [round, setRound] = useState<OfflineSavedRound | null>(null);
  const [quick, setQuick] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [bag, setBag] = useState<SavedBag | null>(null);
  const [practice, setPractice] = useState<SavedPractice | null>(null);
  const [view, setView] = useState("saved");
  const [section, setSection] = useState("today");
  const [connecting, setConnecting] = useState(false);
  const connectingRef = useRef(false);
  const [connection] = useState(createOfflineConnectionCheck);
  useEffect(() => () => connection.cancel(), [connection]);
  const [connectionMessage, setConnectionMessage] = useState("");
  async function reconnect() {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    setConnectionMessage("Checking connection…");
    const connected = await connection.check();
    if (connected === null) return;
    if (connected) {
      setConnectionMessage("Connected. Opening the app…");
      // A hard navigation replaces the recovered offline document and stale client chunks.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(
        `/surface/companion?next=${encodeURIComponent(offlineDestination(new URL(window.location.href)).target)}`,
      );
    } else {
      setConnectionMessage(
        `Still unable to reach ${BRAND_NAME}. Check your connection and try again. Your saved golf stays available.`,
      );
    }
    connectingRef.current = false;
    setConnecting(false);
  }
  const [message, setMessage] = useState("");
  useEffect(() => {
    let loadedAccount: string | null = null;
    const clearPrivateView = () => {
      setBooks([]);
      setBookId(null);
      setRound(null);
      setRounds([]);
      setQuick(false);
      setBag(null);
      setPractice(null);
      setAccount(null);
      setView("saved");
      setMessage(
        `The account on this device changed. Reopen ${BRAND_NAME} online before continuing.`,
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
    const restoreView = () => {
      try {
        const query = new URLSearchParams(window.location.search);
        setSection(offlineDestination(new URL(window.location.href)).section);
        setView("saved");
        const id = localStorage.getItem("fkh:offline-account");
        if (!id) return;
        loadedAccount = id;
        setAccount(id);
        setMessage("");
        const savedBooks = readSavedCaddieBooks(localStorage, id);
        setBooks(savedBooks);
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
        const savedRounds = readOfflineSavedRounds(localStorage, id);
        setRounds(savedRounds);
        const requestedId = requestedOfflineRound(new URL(window.location.href));
        const requestedRound = savedRounds.find((item) => item.context.sessionId === requestedId);
        setRound(requestedRound ?? null);
        if (requestedRound) setView("round");
        else if (requestedId)
          setMessage(
            "This round has no usable saved copy on this device. Choose another saved activity or reconnect to open it.",
          );
        const quickDraft = parseQuickRangeDraft(
          parseSaved(localStorage.getItem(`fkh:quick-range:${id}`)),
        );
        setQuick(Boolean(quickDraft && ["active", "paused"].includes(quickDraft.state)));
        const savedBag = readQuickBagSnapshot(localStorage.getItem(`fkh:quick-bag:${id}`), id);
        setBag(savedBag);
        if (savedBag) {
          if (query.get("view") === "bag" || window.location.pathname === "/quick-bag")
            setView("bag");
        }
        if (
          quickDraft &&
          ["active", "paused"].includes(quickDraft.state) &&
          query.get("view") === "quick"
        )
          setView("quick");
        setPractice(null);
        const savedPractice = parseSaved(
          localStorage.getItem(`fkh:active-practice:${id}`),
        ) as SavedPractice | null;
        if (
          savedPractice?.plan &&
          Array.isArray(savedPractice.plan.blocks) &&
          Array.isArray(savedPractice.completedBlockIds) &&
          Number.isInteger(savedPractice.blockIndex)
        ) {
          setPractice(savedPractice);
          if (query.get("view") === "practice") setView("practice");
        }
      } catch {
        setMessage("Saved activity could not be opened on this device.");
      } finally {
        setLoaded(true);
      }
    };
    const onHistory = () => {
      connection.cancel();
      connectingRef.current = false;
      setConnecting(false);
      setConnectionMessage("");
      checkAccount();
      restoreView();
    };
    window.addEventListener("popstate", onHistory);
    const timer = setTimeout(restoreView, 0);
    return () => {
      window.removeEventListener("popstate", onHistory);
      clearTimeout(timer);
      window.removeEventListener("storage", checkAccount);
      window.removeEventListener("focus", checkAccount);
      document.removeEventListener("visibilitychange", checkAccount);
    };
  }, [connection]);
  useMobileActivity(view === "practice" && !practice?.finished);
  function updatePractice(update: Partial<SavedPractice>) {
    if (!practice || !account) return;
    const next = { ...practice, ...update, savedAt: new Date().toISOString() };
    setPractice(next);
    try {
      if (localStorage.getItem("fkh:offline-account") !== account) return;
      localStorage.setItem(`fkh:active-practice:${account}`, JSON.stringify(next));
      setMessage("Saved locally on this device. Open Practice after reconnecting to review sync.");
    } catch {
      setMessage("Storage unavailable. Keep this page open.");
    }
  }
  const book = books.find((item) => item.course.id === bookId);
  function cancelReconnect() {
    connection.cancel();
    connectingRef.current = false;
    setConnecting(false);
    setConnectionMessage("");
  }
  function navigate(nextView: string, params: Record<string, string> = {}) {
    cancelReconnect();
    const url = new URL("/offline", window.location.origin);
    url.searchParams.set("view", nextView === "book" ? "caddie" : nextView);
    url.searchParams.set("section", section);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const state = { ...window.history.state, fkhOfflineDetail: true };
    delete state.__NA;
    delete state._N;
    window.history.pushState(state, "", url);
    setMessage("");
    setView(nextView);
    window.scrollTo(0, 0);
  }
  function openRound(selected: OfflineSavedRound) {
    setRound(selected);
    navigate("round", { sessionId: selected.context.sessionId });
  }
  function openBook(selected: CaddieBookSnapshot) {
    setBookId(selected.course.id);
    navigate("book", {
      courseId: selected.course.id,
      ...(selected.tee ? { teeSetId: selected.tee.id } : {}),
      hole: String(selected.selectedHole),
      option: selected.selectedMode,
    });
  }
  function showSaved() {
    cancelReconnect();
    if (window.history.state?.fkhOfflineDetail) {
      window.history.back();
      return;
    }
    const state = { ...window.history.state };
    delete state.__NA;
    delete state._N;
    window.history.replaceState(state, "", "/offline");
    if (account) setRounds(readOfflineSavedRounds(localStorage, account));
    setView("saved");
    setMessage("");
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
  function selectSection(nextSection: string) {
    setSection(nextSection);
    navigate(nextSection === "bag" && bag?.clubs.length ? "bag" : "saved", {
      section: nextSection,
    });
  }
  const block = practice?.plan.blocks[practice.blockIndex];
  const immersive =
    view === "round" || view === "quick" || (view === "practice" && !practice?.finished);
  const sectionTitle =
    section === "today"
      ? "Saved golf"
      : section === "practice"
        ? "Practice"
        : section === "play"
          ? "Play"
          : section === "bag"
            ? "Bag"
            : "Sessions";
  const hasSavedSection =
    section === "today"
      ? Boolean(rounds.length || quick || practice || bag?.clubs.length || books.length)
      : section === "practice"
        ? Boolean(quick || practice)
        : section === "play"
          ? Boolean(rounds.length || books.length || bag?.clubs.length)
          : section === "bag"
            ? Boolean(bag?.clubs.length)
            : false;
  return (
    <main
      data-app-surface="companion"
      data-mobile-platform="apple"
      className={styles.screen}
      data-immersive={immersive}
    >
      <div className={styles.connection} role="status">
        <strong>
          <WifiOff aria-hidden size={18} /> Connection unavailable
        </strong>
        <p>
          You are using local saved copies. Reconnecting does not confirm that queued changes have
          synced.
        </p>
      </div>
      {!immersive ? (
        <Button
          variant="outline"
          className="min-h-11 justify-self-start"
          onClick={() => setMoreOpen(true)}
        >
          Find saved resources
        </Button>
      ) : null}
      {view !== "saved" && view !== "round" && !(view === "practice" && !practice?.finished) ? (
        <Button variant="ghost" className="min-h-11 justify-self-start" onClick={showSaved}>
          <ChevronLeft aria-hidden className="size-5" /> Back
        </Button>
      ) : null}
      {view !== "round" && view !== "quick" && view !== "practice" && view !== "book" ? (
        <MobileLargeTitle
          title={view === "bag" ? "Quick Bag" : sectionTitle}
          detail={
            view === "bag"
              ? "Your saved distances, ready to use."
              : "Keep playing with what’s saved on this device."
          }
        />
      ) : null}
      {view === "round" && round?.context && account ? (
        <MobileLiveRound
          key={round.context.sessionId}
          accountId={account}
          {...round.context}
          holes={round.holes}
          recordVersion={round.version}
          offlineNavigation={{
            onBack: showSaved,
            onQuickBag: bag?.clubs.length ? () => navigate("bag") : undefined,
          }}
        />
      ) : view === "quick" && account ? (
        <QuickRangeCompanionSession accountId={account} focus="Distance control" />
      ) : null}
      {view === "saved" ? (
        <div className={styles.resources}>
          {message ? (
            <p role="status" className="mobile-type-callout text-muted-foreground">
              {message}
            </p>
          ) : null}
          {(section === "today" || section === "play") && rounds.length ? (
            <MobileSection title="Saved rounds">
              <MobileGroupedList label="Saved rounds">
                {rounds.map((item) => (
                  <MobileListRow
                    key={item.context.sessionId}
                    label={item.context.course}
                    detail={`${item.context.tee ?? "Tee not recorded"} · ${item.finished ? "Round finished" : `Hole ${item.holes[item.index].holeNumber}`} · saved time not recorded`}
                    status={
                      item.dirty.length ||
                      item.inFlight ||
                      (item.finished && !item.completedSynced) ? (
                        <span className="mobile-type-footnote text-muted-foreground">
                          Sync pending
                        </span>
                      ) : undefined
                    }
                    onClick={() => openRound(item)}
                  />
                ))}
              </MobileGroupedList>
            </MobileSection>
          ) : null}
          {(section === "today" || section === "practice") && (quick || practice) ? (
            <MobileSection title="Practice">
              <MobileGroupedList label="Saved practice">
                {quick ? (
                  <MobileListRow
                    label="Quick Range"
                    detail="Resume local activity · saved time not recorded"
                    onClick={() => navigate("quick")}
                  />
                ) : null}
                {practice ? (
                  <MobileListRow
                    label={practice.plan.title}
                    detail={`${practice.completedBlockIds.length} of ${practice.plan.blocks.length} blocks complete · ${practice.savedAt ? `saved ${savedDate(practice.savedAt)}` : "saved time not recorded"}`}
                    status={
                      practice.finished
                        ? "Activity finished · measured results need an import"
                        : "Resume Range Mode"
                    }
                    onClick={() => navigate("practice")}
                  />
                ) : null}
              </MobileGroupedList>
            </MobileSection>
          ) : null}
          {(section === "today" || section === "play") && (bag?.clubs.length || books.length) ? (
            <MobileSection title="On the course">
              <MobileGroupedList label="Saved course essentials">
                {bag?.clubs.length ? (
                  <MobileListRow
                    label="Quick Bag"
                    detail={`${bag.clubs.length} clubs · saved ${savedDate(bag.storedAt)}`}
                    onClick={() => navigate("bag")}
                  />
                ) : null}
                {books.map((item) => (
                  <MobileListRow
                    key={item.course.id}
                    label={item.course.name}
                    detail={`${item.tee?.name ?? "Tee not recorded"} · ${item.strategy.length} holes`}
                    status={
                      <span className="mobile-type-footnote text-muted-foreground">
                        Caddie book · saved {savedDate(item.storedAt)}
                      </span>
                    }
                    onClick={() => openBook(item)}
                  />
                ))}
              </MobileGroupedList>
            </MobileSection>
          ) : null}
          {!loaded ? (
            <p role="status">Reading saved resources on this device…</p>
          ) : !hasSavedSection ? (
            <MobileSection
              title={
                section === "sessions"
                  ? "Your session reviews need a connection"
                  : "Nothing saved here yet"
              }
            >
              <p className="mobile-type-body text-muted-foreground">
                {section === "sessions"
                  ? "Reconnect to see your session reviews, club comparisons and shot patterns."
                  : "Open Quick Bag, a course strategy or start practice while connected to keep it available here."}
              </p>
            </MobileSection>
          ) : null}
          <p className="mobile-type-footnote text-muted-foreground">
            Saved copies may be older than your latest online data. Reopen the activity online to
            review pending changes and any conflicts. No saved date means freshness is unknown.
          </p>
          <Button className="min-h-12" disabled={connecting} onClick={reconnect}>
            {connecting ? "Checking connection…" : "Reconnect and open app"}
          </Button>
          <p role="status" aria-live="polite" className="mobile-type-callout text-muted-foreground">
            {connectionMessage}
          </p>
        </div>
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
                      navigate("bag");
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
            onPause={showSaved}
            onFinish={() => {
              updatePractice({ finished: true });
              showSaved();
            }}
            practicePlanId={practice.planId}
          />
        )
      ) : null}
      {message && view !== "saved" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      <ResponsiveDetailPanel
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="Find saved resources"
        description="Only copies available on this device can open offline. Reconnect for other account tasks."
      >
        <label className="grid gap-2 text-sm">
          Search saved resources
          <Input
            value={resourceQuery}
            onChange={(e) => setResourceQuery(e.target.value)}
            type="search"
          />
        </label>
        <div className="mt-4 grid gap-3">
          {[
            ...rounds.map((item) => ({
              id: `round-${item.context.sessionId}`,
              title: item.context.course,
              detail: "Saved round · local edits may be pending",
              kind: "round",
              resourceId: item.context.sessionId,
            })),
            ...books.map((item) => ({
              id: `book-${item.course.id}`,
              title: item.course.name,
              detail: `Caddie book · saved ${savedDate(item.storedAt)}`,
              kind: "book",
              resourceId: item.course.id,
            })),
            ...(practice
              ? [
                  {
                    id: "practice",
                    title: practice.plan.title,
                    detail: "Saved practice · local progress",
                    kind: "practice",
                    resourceId: "practice",
                  },
                ]
              : []),
            ...(quick
              ? [
                  {
                    id: "quick",
                    title: "Quick Range",
                    detail: "Saved local activity",
                    kind: "quick",
                    resourceId: "quick",
                  },
                ]
              : []),
            ...(bag?.clubs.length
              ? [
                  {
                    id: "bag",
                    title: "Quick Bag",
                    detail: `Saved ${savedDate(bag.storedAt)}`,
                    kind: "bag",
                    resourceId: "bag",
                  },
                ]
              : []),
          ]
            .filter((item) =>
              `${item.title} ${item.detail}`
                .toLowerCase()
                .includes(resourceQuery.trim().toLowerCase()),
            )
            .map((item) => (
              <Button
                key={item.id}
                variant="outline"
                className="h-auto min-h-14 flex-col items-start whitespace-normal text-left"
                onClick={() => {
                  setMoreOpen(false);
                  if (item.kind === "round") {
                    const selected = rounds.find((r) => r.context.sessionId === item.resourceId);
                    if (selected) openRound(selected);
                  } else if (item.kind === "book") {
                    const selected = books.find((b) => b.course.id === item.resourceId);
                    if (selected) openBook(selected);
                  } else navigate(item.kind);
                }}
              >
                <span>{item.title}</span>
                <span className="text-xs font-normal text-muted-foreground">{item.detail}</span>
              </Button>
            ))}
          <p className="text-sm text-muted-foreground">
            If a resource is not listed, there is no matching usable saved copy. Session reviews,
            imports, sharing and account settings need a connection.
          </p>
        </div>
      </ResponsiveDetailPanel>
      {!immersive ? (
        <OfflineNavigation section={view === "bag" ? "bag" : section} onSelect={selectSection} />
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
  if (!Number.isFinite(Date.parse(value))) return "time not recorded";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
