import { CompanionBrandLockup } from "@/components/app/companion-brand";
import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

type GolfLoadingProps = {
  title: string;
  subtitle: string;
  variant?:
    | "dashboard"
    | "bag"
    | "progress"
    | "speed"
    | "strokes"
    | "shots"
    | "rounds"
    | "sessions"
    | "coach"
    | "analyse"
    | "dataChat"
    | "compare"
    | "courses"
    | "courseRecords"
    | "admin"
    | "clubAnalytics"
    | "roundDetail"
    | "today"
    | "import"
    | "rapsodo"
    | "providers"
    | "practice"
    | "equipment"
    | "handicap"
    | "simulatorLab"
    | "trainingLoad"
    | "achievements"
    | "leaderboard"
    | "challenges"
    | "tournaments"
    | "feed"
    | "friends"
    | "groups"
    | "profile"
    | "settings"
    | "billing"
    | "partners"
    | "socialSafety";
};

export function GolfRouteLoading({ title, subtitle, variant = "dashboard" }: GolfLoadingProps) {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4 lg:gap-5">
        <header className="ios-page-header lg:hidden">
          <CompanionBrandLockup className="mb-4 justify-start" />
          <p className="text-[13px] font-semibold text-primary">{variantLabel(variant)}</p>
          <h1>{title}</h1>
          <p className="mt-1 text-[15px] leading-5 text-muted-foreground">{subtitle}</p>
        </header>

        <div className="grid gap-4 lg:hidden">
          <AppLoadingSkeleton variant="answer" />
          <AppLoadingSkeleton variant="list" rows={3} />
        </div>

        <div className="hidden gap-5 lg:grid">
          <div>
            <div className="flex flex-wrap gap-2">
              <LoadingPill label="Loading read" />
              <LoadingPill label={variantLabel(variant)} />
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          <AppLoadingSkeleton variant="answer" />
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.7fr)]">
            <AppLoadingSkeleton variant="table" rows={5} />
            <AppLoadingSkeleton variant="detail" rows={4} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function LoadingPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
      data-clubhouse-state="live"
    >
      {label}
    </span>
  );
}

function variantLabel(variant: NonNullable<GolfLoadingProps["variant"]>) {
  switch (variant) {
    case "bag":
      return "Bag map";
    case "progress":
      return "Progression";
    case "speed":
      return "Speed centre";
    case "strokes":
      return "Strokes gained";
    case "shots":
      return "Shot explorer";
    case "rounds":
      return "Round review";
    case "sessions":
      return "Sessions";
    case "coach":
      return "Coach desk";
    case "analyse":
      return "Analysis";
    case "dataChat":
      return "Data chat";
    case "compare":
      return "Compare";
    case "courses":
      return "Course library";
    case "courseRecords":
      return "Course records";
    case "admin":
      return "Admin console";
    case "clubAnalytics":
      return "Club analytics";
    case "roundDetail":
      return "Round review";
    case "today":
      return "Latest practice";
    case "import":
      return "Import centre";
    case "rapsodo":
      return "Rapsodo sync";
    case "providers":
      return "Provider console";
    case "practice":
      return "Practice planner";
    case "equipment":
      return "Equipment";
    case "handicap":
      return "Handicap";
    case "simulatorLab":
      return "Simulator lab";
    case "trainingLoad":
      return "Training load";
    case "achievements":
      return "Achievement hub";
    case "leaderboard":
      return "Leaderboard";
    case "challenges":
      return "Challenges";
    case "tournaments":
      return "Tournaments";
    case "feed":
      return "Feed";
    case "friends":
      return "Friends";
    case "groups":
      return "Groups";
    case "profile":
      return "Profile";
    case "settings":
      return "Settings";
    case "billing":
      return "Billing";
    case "partners":
      return "Partners";
    case "socialSafety":
      return "Safety console";
    default:
      return "Command centre";
  }
}
