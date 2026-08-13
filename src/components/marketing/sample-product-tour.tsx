"use client";

import { ChevronRight, CircleCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingDemoClubs, type MarketingDemoClub } from "@/lib/marketing-demo-data";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./marketing.module.css";

const tourSteps = ["Session", "Dispersion", "Club trust", "Practice", "Course plan"] as const;

export function SampleProductTour() {
  const [clubKey, setClubKey] = useState<MarketingDemoClub["key"]>("driver");
  const [trusted, setTrusted] = useState(true);
  const [minutes, setMinutes] = useState(30);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
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

  function advance() {
    markStarted();
    if (completed) {
      trackPlausibleEvent("Public Sample Tour Completed");
      return;
    }
    setStep((current) => current + 1);
  }

  function markStarted() {
    if (started) return;
    setStarted(true);
    trackPlausibleEvent("Public Sample Tour Started");
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
            <span>
              {step + 1} / {tourSteps.length}
            </span>
          </div>
          <Tabs
            value={tourSteps[step]}
            onValueChange={(value) => {
              markStarted();
              setStep(tourSteps.indexOf(value as (typeof tourSteps)[number]));
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
              <TabsContent key={label} value={label} className={styles.tourView}>
                {view[label]}
              </TabsContent>
            ))}
          </Tabs>
          <div className={styles.tourNext}>
            {completed ? (
              <div>
                <CircleCheck className="size-5" aria-hidden />{" "}
                <span>Ready to use your own data?</span>
              </div>
            ) : (
              <span>Next: {tourSteps[step + 1]}</span>
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
              <Button type="button" onClick={advance}>
                Continue <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
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
