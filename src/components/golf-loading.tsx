import { Activity, Flag, Target } from "lucide-react";

import { PageShell } from "@/components/premium";
import { cn } from "@/lib/utils";

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
    | "coach"
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
  const metricLabels = loadingMetricLabels(variant);

  return (
    <PageShell>
      <div className="grid gap-5">
        <section className="premium-card overflow-hidden rounded-lg border border-[#DDE8DE] bg-white">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <LoadingPill label="Loading read" />
                <LoadingPill label={variantLabel(variant)} />
              </div>
              <div className="mt-8 h-14 max-w-2xl rounded-lg bg-[#EAF2EC]" />
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-4">
                {metricLabels.map((label) => (
                  <div key={label} className="rounded-lg border border-[#DDE8DE] bg-[#F8FAF8] p-3">
                    <div className="h-3 w-20 rounded-full bg-[#DDE8DE]" />
                    <div className="mt-3 h-7 w-16 rounded-md bg-[#CFE1D2]" />
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#DDE8DE] bg-[#F8FAF8] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{title}</p>
                  <div className="mt-2 h-3 w-36 rounded-full bg-[#DDE8DE]" />
                </div>
                <Target className="size-5 text-[#087A3D]" />
              </div>
              <div className="mt-7 grid place-items-center">
                <div className="grid size-36 place-items-center rounded-full bg-[conic-gradient(#087A3D_70deg,#E7EFE9_0deg)] p-2">
                  <div className="grid size-full place-items-center rounded-full bg-white">
                    <Activity className="size-8 animate-pulse text-[#087A3D]" />
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-10 rounded-lg bg-white/80 ring-1 ring-[#DDE8DE]" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {[Flag, Target, Activity, Flag].map((Icon, index) => (
            <div
              key={index}
              className="premium-card rounded-lg border border-[#DDE8DE] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-3 w-24 rounded-full bg-[#DDE8DE]" />
                  <div className="mt-5 h-9 w-20 rounded-md bg-[#EAF2EC]" />
                </div>
                <span className="grid size-10 place-items-center rounded-lg bg-[#F0FAF3] text-[#087A3D]">
                  <Icon className="size-5" />
                </span>
              </div>
              <div
                className={cn("mt-5 h-2 rounded-full bg-[#EAF2EC]", index % 2 ? "w-3/4" : "w-full")}
              />
            </div>
          ))}
        </section>
      </div>
    </PageShell>
  );
}

function LoadingPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#E8F7EE] px-3 py-1 text-xs font-semibold text-[#087A3D]">
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
    case "coach":
      return "Coach desk";
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

function loadingMetricLabels(variant: NonNullable<GolfLoadingProps["variant"]>) {
  switch (variant) {
    case "billing":
    case "partners":
    case "providers":
    case "settings":
      return ["Plan", "Access", "Status", "Actions"];
    case "feed":
    case "friends":
    case "groups":
    case "profile":
    case "socialSafety":
      return ["Privacy", "Activity", "Network", "Safety"];
    case "leaderboard":
    case "challenges":
    case "tournaments":
    case "achievements":
      return ["Rank", "Proof", "Progress", "Action"];
    case "import":
    case "rapsodo":
      return ["Source", "Mapping", "Quality", "History"];
    case "practice":
    case "trainingLoad":
      return ["Load", "Focus", "Blocks", "Recovery"];
    case "equipment":
      return ["Bag", "Change", "Impact", "Notes"];
    case "handicap":
      return ["Index", "Rounds", "Proof", "Trend"];
    case "simulatorLab":
      return ["Course", "Hole", "Overlay", "Timeline"];
    default:
      return ["Trust", "Round ready", "Carry", "Pattern"];
  }
}
