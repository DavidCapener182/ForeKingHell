import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const practiceSource =
  source("src/app/practice/practice-companion-client.tsx") +
  source("src/app/practice/active-range-mode.tsx") +
  source("src/app/practice/measured-practice-result-card.tsx");
const roundSource = source("src/app/rounds/new/new-round-form.tsx");
const sessionsSource = source("src/app/sessions/session-timeline.tsx");
const loginSource = source("src/app/login/login-form.tsx");
const playSelectionSource = source("src/app/play/play-selection-controls.tsx");
const sharedReportSource = source(
  "src/app/share/report/[token]/shared-coach-report-password-form.tsx",
);
const sharedReportActionSource = source("src/app/share/report/[token]/actions.ts");
const sharedReportPageSource = source("src/app/share/report/[token]/page.tsx");
const strategySource = source("src/app/courses/strategy/mobile-hole-strategy.tsx");
const rapsodoSource = source("src/app/rapsodo/rapsodo-sync-client.tsx");
const courseTwinSource = source("src/app/play/[courseId]/course-twin-scene.tsx");

describe("authenticated route and feedback motion", () => {
  it("animates Practice block truth while preserving the navigation controls' DOM", () => {
    expect(practiceSource).toContain("const [blockDirection, setBlockDirection] = useState<");
    expect(practiceSource).toContain('setBlockDirection("forward")');
    expect(practiceSource).toContain('setBlockDirection("back")');
    expect(practiceSource).toContain(
      "<div className={styles.rangeBlock} data-current-range-block>",
    );
    expect(practiceSource).toContain("key={block?.id ?? `range-block-${blockIndex}`}");
    expect(practiceSource).toContain('blockDirection && "t-route-step"');
    expect(practiceSource).toContain("data-direction={blockDirection ?? undefined}");
    expect(practiceSource).toContain("data-current-range-block-content");
    expect(practiceSource).not.toContain("<Card\n        key={block?.id");
    expect(practiceSource).toContain("navigatedButton?.disabled");
    expect(practiceSource).toContain("completeButtonRef.current?.focus({ preventScroll: true })");

    const activeRange = practiceSource.slice(practiceSource.indexOf("function ActiveRangeMode"));
    const motionRegionEnd = activeRange.indexOf(
      "<footer className={styles.rangeActions}>",
      activeRange.indexOf("data-current-range-block-content"),
    );
    expect(motionRegionEnd).toBeGreaterThan(0);
    for (const stableHandler of ["onPrevious();", "onComplete();", "onNext();"]) {
      expect(activeRange.indexOf(stableHandler, motionRegionEnd)).toBeGreaterThan(motionRegionEnd);
    }
  });

  it("replays all four in-flow New Round panels without keying form fields", () => {
    for (const step of ["setup", "score", "stats", "review"]) {
      expect(roundSource).toContain(`mobileStepPanelRefs.current.${step} = node`);
    }

    expect(roundSource).toContain('panel.classList.remove("t-route-step")');
    expect(roundSource).toContain('panel.classList.add("t-route-step")');
    expect(roundSource).toContain("panel.dataset.direction = mobileStepDirection");
    expect(roundSource).toContain('window.matchMedia("(max-width: 639px)").matches');
    expect(roundSource).toContain("mobileStepHeadingRef.current?.focus({ preventScroll: true })");
    expect(roundSource).toContain('hidden={mobileStep !== "review"}');
    expect(roundSource).not.toMatch(/key=\{mobileStep/);
  });

  it("reveals the mounted Sessions comparison tray and keys only the preview truth", () => {
    expect(sessionsSource).toContain('className="t-panel-slide sticky bottom-4');
    expect(sessionsSource).toContain('data-open={comparisonTrayOpen ? "true" : "false"}');
    expect(sessionsSource).toContain("exitSnapshot");
    expect(sessionsSource).toContain("visibleExitSnapshot");
    expect(sessionsSource).toContain("comparisonTrayIds.length === 2");
    expect(sessionsSource).toContain("comparisonTrayHref");
    expect(sessionsSource).toContain("inert={!comparisonTrayOpen}");
    expect(sessionsSource).toContain('event.propertyName !== "opacity"');
    expect(sessionsSource).toContain('key={activeSession?.id ?? "empty-session-preview"}');
    expect(sessionsSource).toContain('className="t-route-step');
  });

  it("shakes only invalid bordered controls while keeping errors immediate", () => {
    for (const formSource of [loginSource, playSelectionSource, sharedReportSource]) {
      expect(formSource).toContain("t-input");
      expect(formSource).toContain("is-error is-shaking");
      expect(formSource).toContain("aria-invalid");
    }

    expect(loginSource).toContain('role="alert"');
    expect(playSelectionSource).toContain('<Alert variant="destructive">');
    expect(sharedReportSource).toContain('<Alert variant="destructive">');
    expect(sharedReportSource).toContain("}, [invalid, invalidAttempt]);");
    expect(sharedReportSource).not.toContain("onSubmit=");
    expect(sharedReportActionSource).toContain("attempt: randomUUID()");
    expect(sharedReportPageSource).toContain("query?.attempt ?? null");
  });

  it("respects reduced motion for every audited smooth-scroll handoff", () => {
    expect(strategySource).toContain('behavior: "auto"');
    expect(strategySource).not.toContain('behavior: "smooth"');
    expect(rapsodoSource.match(/prefers-reduced-motion: reduce/g)).toHaveLength(2);
    expect(rapsodoSource).not.toContain('scrollIntoView({ behavior: "smooth"');
  });

  it("keeps Course Twin playback off React's per-frame render path", () => {
    expect(courseTwinSource).toContain("const playbackRef = useRef(0)");
    expect(courseTwinSource).toContain("element.style.transform = `scaleX(${normalizedPlayback})`");
    expect(courseTwinSource).toContain("<PlaybackProgress");
    expect(courseTwinSource).toContain("function ReplayBall(");
    expect(courseTwinSource).toContain("useFrame(() => {");

    const playbackEffect =
      courseTwinSource.match(
        /const tick = \(now: number\)[\s\S]*?cancelAnimationFrame\(frame\);/,
      )?.[0] ?? "";
    expect(playbackEffect).toContain("syncPlaybackProgress(next)");
    expect(playbackEffect).not.toContain("setPlayback(next)");
    expect(courseTwinSource).not.toContain("transition-[width]");
  });
});
