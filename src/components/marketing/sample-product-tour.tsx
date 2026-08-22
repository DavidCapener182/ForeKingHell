"use client";

import { ChevronRight, CircleCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type UIEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingDemoClubs, type MarketingDemoClub } from "@/lib/marketing-demo-data";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./marketing.module.css";

const tourSteps = ["Session", "Dispersion", "Club trust", "Practice", "Course plan"] as const;
const mobileRailSettleDelayMs = 140;

export function SampleProductTour() {
  const [clubKey, setClubKey] = useState<MarketingDemoClub["key"]>("driver");
  const [trusted, setTrusted] = useState(true);
  const [minutes, setMinutes] = useState(30);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [started, setStarted] = useState(false);
  const mobileRailRef = useRef<HTMLDivElement>(null);
  const controlledMobileScrollTargetRef = useRef<number | null>(null);
  const mobileRailSettleTimerRef = useRef<number | null>(null);
  const club =
    marketingDemoClubs.find((candidate) => candidate.key === clubKey) ?? marketingDemoClubs[0];
  const completed = step === tourSteps.length - 1;
  const planBalls = minutes === 15 ? 18 : minutes === 30 ? 36 : 54;

  const view = useMemo(
    () => ({
      Session: <SessionView club={club} trusted={trusted} />,
      Dispersion: <DispersionView club={club} trusted={trusted} />,
      "Club trust": <ClubTrustView club={club} />,
      Practice: <PracticeView club={club} minutes={minutes} balls={planBalls} />,
      "Course plan": <CoursePlanView club={club} />,
    }),
    [club, minutes, planBalls, trusted],
  );

  useEffect(
    () => () => {
      if (mobileRailSettleTimerRef.current !== null) {
        window.clearTimeout(mobileRailSettleTimerRef.current);
      }
    },
    [],
  );

  function advance() {
    if (completed) {
      markStarted();
      trackPlausibleEvent("Public Sample Tour Completed");
      return;
    }
    selectStep(step + 1, true);
  }

  function markStarted() {
    if (started) return;
    setStarted(true);
    trackPlausibleEvent("Public Sample Tour Started");
  }

  function selectStep(nextStep: number, scrollMobile = false) {
    const boundedStep = Math.max(0, Math.min(tourSteps.length - 1, nextStep));
    markStarted();
    setDirection(boundedStep < step ? "back" : "forward");

    if (
      !scrollMobile ||
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      clearMobileRailSettleTimer();
      controlledMobileScrollTargetRef.current = null;
      setStep(boundedStep);
      return;
    }

    controlledMobileScrollTargetRef.current = boundedStep;

    window.requestAnimationFrame(() => {
      const rail = mobileRailRef.current;
      const card = rail?.querySelector<HTMLElement>(`[data-tour-swipe-card="${boundedStep}"]`);
      const firstCard = rail?.querySelector<HTMLElement>("[data-tour-swipe-card]");
      if (!rail || !card || !firstCard) {
        controlledMobileScrollTargetRef.current = null;
        setStep(boundedStep);
        return;
      }

      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";

      rail.scrollTo({
        left: card.offsetLeft - firstCard.offsetLeft,
        behavior,
      });

      if (behavior === "auto") {
        clearMobileRailSettleTimer();
        controlledMobileScrollTargetRef.current = null;
        setStep((currentStep) => (currentStep === boundedStep ? currentStep : boundedStep));
      }
    });
  }

  function clearMobileRailSettleTimer() {
    if (mobileRailSettleTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(mobileRailSettleTimerRef.current);
    mobileRailSettleTimerRef.current = null;
  }

  function commitStepFromMobileRail(rail: HTMLDivElement) {
    clearMobileRailSettleTimer();
    const nextStep = nearestMobileRailStep(rail);
    if (nextStep === null) return;
    if (
      controlledMobileScrollTargetRef.current !== null &&
      nextStep !== controlledMobileScrollTargetRef.current
    ) {
      scheduleMobileRailCommit(rail);
      return;
    }
    controlledMobileScrollTargetRef.current = null;
    setDirection(nextStep < step ? "back" : "forward");
    setStep((currentStep) => (currentStep === nextStep ? currentStep : nextStep));
  }

  function scheduleMobileRailCommit(rail: HTMLDivElement) {
    clearMobileRailSettleTimer();
    mobileRailSettleTimerRef.current = window.setTimeout(
      () => commitStepFromMobileRail(rail),
      mobileRailSettleDelayMs,
    );
  }

  function syncStepFromMobileRail(event: UIEvent<HTMLDivElement>) {
    scheduleMobileRailCommit(event.currentTarget);
  }

  function beginManualMobileRailInteraction() {
    controlledMobileScrollTargetRef.current = null;
    clearMobileRailSettleTimer();
    markStarted();
  }

  function handleMobileRailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextStep =
      event.key === "ArrowRight"
        ? step + 1
        : event.key === "ArrowLeft"
          ? step - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tourSteps.length - 1
              : null;

    if (nextStep === null) return;
    event.preventDefault();
    selectStep(nextStep, true);
  }

  return (
    <section id="sample-tour" className={styles.tourSection} aria-labelledby="sample-tour-title">
      <div className={styles.tourHeading}>
        <div>
          <p className={styles.eyebrow}>Interactive sample tour</p>
          <h2 id="sample-tour-title">See the decision chain before you sign up.</h2>
        </div>
        <p>Fictional demo data only. Nothing here connects to or changes a real account.</p>
      </div>
      <div className={styles.tourShell}>
        <div className={styles.tourControls}>
          <fieldset>
            <legend>Choose demo club</legend>
            <ToggleGroup
              type="single"
              value={clubKey}
              variant="outline"
              className={styles.segmentedControl}
              onValueChange={(value) => {
                if (!value) return;
                markStarted();
                setClubKey(value as MarketingDemoClub["key"]);
              }}
            >
              {marketingDemoClubs.map((candidate) => (
                <ToggleGroupItem key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <fieldset>
            <legend>Evidence view</legend>
            <ToggleGroup
              type="single"
              value={trusted ? "trusted" : "raw"}
              variant="outline"
              className={styles.segmentedControl}
              onValueChange={(value) => {
                if (!value) return;
                markStarted();
                setTrusted(value === "trusted");
              }}
            >
              <ToggleGroupItem value="raw">Raw shots</ToggleGroupItem>
              <ToggleGroupItem value="trusted">Trusted sample</ToggleGroupItem>
            </ToggleGroup>
          </fieldset>
          <fieldset>
            <legend>Practice time</legend>
            <ToggleGroup
              type="single"
              value={String(minutes)}
              variant="outline"
              className={styles.segmentedControl}
              onValueChange={(value) => {
                if (!value) return;
                markStarted();
                setMinutes(Number(value));
              }}
            >
              {[15, 30, 45].map((duration) => (
                <ToggleGroupItem key={duration} value={String(duration)}>
                  {duration} min
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
        </div>
        <div className={styles.tourStage}>
          <div className={styles.tourTopline}>
            <span>Demo data · no sign-in required</span>
            <span
              key={`tour-status-${step}`}
              className="t-text-state"
              data-motion-ready={step > 0 ? "true" : "false"}
              role="status"
              aria-live="polite"
              data-tour-step-status
            >
              {step + 1} / {tourSteps.length}
            </span>
          </div>
          <div className={styles.tourDesktopExperience} data-tour-direction={direction}>
            <Tabs
              value={tourSteps[step]}
              onValueChange={(value) => {
                selectStep(tourSteps.indexOf(value as (typeof tourSteps)[number]));
              }}
            >
              <TabsList className={styles.tourTabs} aria-label="Sample tour chapters">
                {tourSteps.map((label) => (
                  <TabsTrigger key={label} value={label}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tourSteps.map((label) => (
                <TabsContent
                  key={label}
                  value={label}
                  className={styles.tourView}
                  data-direction={direction}
                >
                  {view[label]}
                </TabsContent>
              ))}
            </Tabs>
          </div>
          <div className={styles.tourMobileExperience}>
            <p id="sample-tour-swipe-hint" className={styles.tourSwipeHint}>
              Swipe or use arrow keys to explore each chapter
              <ChevronRight className="size-4" aria-hidden />
            </p>
            <div
              ref={mobileRailRef}
              className={styles.tourSwipeRail}
              role="region"
              aria-roledescription="carousel"
              aria-label="Sample tour chapters"
              aria-describedby="sample-tour-swipe-hint"
              tabIndex={0}
              onPointerDown={beginManualMobileRailInteraction}
              onWheel={beginManualMobileRailInteraction}
              onKeyDown={handleMobileRailKeyDown}
              onScroll={syncStepFromMobileRail}
              onScrollEnd={(event) => commitStepFromMobileRail(event.currentTarget)}
            >
              {tourSteps.map((label, index) => (
                <article
                  key={label}
                  className={styles.tourSwipeCard}
                  data-tour-swipe-card={index}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${tourSteps.length}: ${label}`}
                  aria-current={step === index ? "step" : undefined}
                >
                  <header className={styles.tourSwipeCardHeader}>
                    <span>Chapter {index + 1}</span>
                    <strong>{label}</strong>
                  </header>
                  <div className={styles.tourView}>{view[label]}</div>
                </article>
              ))}
            </div>
          </div>
          <div className={styles.tourNext}>
            {completed ? (
              <div>
                <span className="t-success-check" data-state="in" data-draw="false">
                  <CircleCheck className="size-5" aria-hidden />
                </span>{" "}
                <span className="t-text-state" data-motion-ready="true">
                  Ready to use your own data?
                </span>
              </div>
            ) : (
              <span
                key={`tour-next-${step}`}
                className="t-text-state"
                data-motion-ready={step > 0 ? "true" : "false"}
              >
                Next: {tourSteps[step + 1]}
              </span>
            )}
            {completed ? (
              <div className={styles.tourEndActions}>
                <Button asChild>
                  <Link
                    href={marketingJoinBetaHref}
                    onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
                  >
                    Join the beta
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login" onClick={() => trackPlausibleEvent("Public Sign In Clicked")}>
                    Sign in
                  </Link>
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={advance} className="t-learn">
                Continue <ChevronRight className="t-learn-chevron size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function nearestMobileRailStep(rail: HTMLDivElement) {
  const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-tour-swipe-card]"));
  if (cards.length === 0) return null;
  const firstCardOffset = cards[0].offsetLeft;
  const nearestCard = cards.reduce((nearest, card) => {
    const nearestDistance = Math.abs(nearest.offsetLeft - firstCardOffset - rail.scrollLeft);
    const cardDistance = Math.abs(card.offsetLeft - firstCardOffset - rail.scrollLeft);
    return cardDistance < nearestDistance ? card : nearest;
  });
  const nextStep = Number(nearestCard.dataset.tourSwipeCard);
  return Number.isInteger(nextStep) ? nextStep : null;
}

function SessionView({ club, trusted }: { club: MarketingDemoClub; trusted: boolean }) {
  return (
    <div className={styles.tourSession}>
      <div>
        <p className={styles.panelEyebrow}>Imported {club.label} session</p>
        <h3>
          {trusted ? "Clean sample is ready to review" : "Raw rows are visible before filtering"}
        </h3>
        <p>
          {trusted
            ? `${club.sample} usable shots · ${club.freshness}`
            : `${club.sample + 4} original rows · 4 duplicate or incomplete rows flagged`}
        </p>
      </div>
      <div className={styles.miniDataTable}>
        <span>Original row</span>
        <span>Club matched</span>
        <span>{trusted ? "Included" : "Flagged"}</span>
        <span>Evidence stays traceable</span>
      </div>
    </div>
  );
}

function DispersionView({ club, trusted }: { club: MarketingDemoClub; trusted: boolean }) {
  return (
    <div className={styles.tourDispersion}>
      <div>
        <p className={styles.panelEyebrow}>{club.label} pattern</p>
        <h3>{club.pattern}</h3>
        <p>
          {trusted
            ? "Trusted sample removes rows that cannot support a clean conclusion."
            : "Raw view keeps every imported row visible for review."}
        </p>
      </div>
      <div
        className={styles.largeDispersion}
        data-raw={trusted ? "false" : "true"}
        aria-label="Sample shot dispersion pattern"
      >
        {Array.from({ length: trusted ? 13 : 19 }, (_, index) => (
          <i key={index} style={{ "--point": index } as CSSProperties} />
        ))}
        <span>Target line</span>
      </div>
    </div>
  );
}

function ClubTrustView({ club }: { club: MarketingDemoClub }) {
  return (
    <div className={styles.tourTrustView}>
      <div className={styles.tourCarry}>
        <strong>{club.carry}</strong>
        <span>yd carry</span>
      </div>
      <div className={styles.tourTrustFacts}>
        <span>
          <b>Expected range</b>
          {club.range}
        </span>
        <span>
          <b>Confidence</b>
          {club.confidence}
        </span>
        <span>
          <b>Evidence</b>
          {club.sample} shots
        </span>
        <span>
          <b>Freshness</b>
          {club.freshness}
        </span>
      </div>
      <p>
        LM World Tour keeps the qualification beside the number so a stock yardage remains
        explainable.
      </p>
    </div>
  );
}

function PracticeView({
  club,
  minutes,
  balls,
}: {
  club: MarketingDemoClub;
  minutes: number;
  balls: number;
}) {
  return (
    <div className={styles.tourPracticeView}>
      <div className={styles.practiceDial}>
        <SlidersHorizontal className="size-6" />
        <strong>{minutes}</strong>
        <span>minutes</span>
      </div>
      <div>
        <p className={styles.panelEyebrow}>Evidence-backed practice prescription</p>
        <h3>{club.practice}</h3>
        <p>{balls} balls · score from uploaded session evidence, then review plan versus actual.</p>
      </div>
    </div>
  );
}

function CoursePlanView({ club }: { club: MarketingDemoClub }) {
  return (
    <div className={styles.tourCourseView}>
      <div className={styles.tourHole}>
        <span>TEE</span>
        <i />
        <b />
        <em>GREEN</em>
      </div>
      <div>
        <p className={styles.panelEyebrow}>Hole strategy · Course Twin pilot</p>
        <h3>{club.label} to the safe target</h3>
        <p>
          Planned carry: {club.range}. Common miss: {club.pattern.toLowerCase()}. Modelled route and
          placement remain labelled separately from measured shots.
        </p>
      </div>
    </div>
  );
}
