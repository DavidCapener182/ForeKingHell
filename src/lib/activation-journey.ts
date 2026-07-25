import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  clubs,
  practicePlans,
  providerAccounts,
  sessions,
  shots,
  userProfiles,
  users,
} from "@/db/schema";

export type ActivationStep = {
  id: "source" | "import" | "clubs" | "trust" | "review" | "practice";
  title: string;
  description: string;
  href: string;
  complete: boolean;
};

export type ActivationJourney = {
  available: boolean;
  established: boolean;
  dismissed: boolean;
  steps: ActivationStep[];
  completedCount: number;
  firstTrustedResult: string | null;
};

export async function getActivationJourney(userId: string): Promise<ActivationJourney> {
  if (!process.env.DATABASE_URL?.trim()) return unavailableJourney();

  const db = getDb();
  const [account, profile, providerCount, sessionCount, shotCount, clubCount, practiceCount] =
    await Promise.all([
      db
        .select({ onboardingCompletedAt: users.onboardingCompletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({ primaryLaunchMonitor: userProfiles.primaryLaunchMonitor })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1),
      db
        .select({ value: count() })
        .from(providerAccounts)
        .where(eq(providerAccounts.userId, userId)),
      db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
      db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
      db
        .select({ value: count() })
        .from(clubs)
        .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
      db.select({ value: count() }).from(practicePlans).where(eq(practicePlans.userId, userId)),
    ]);
  const providers = Number(providerCount[0]?.value ?? 0);
  const sessionTotal = Number(sessionCount[0]?.value ?? 0);
  const shotTotal = Number(shotCount[0]?.value ?? 0);
  const clubTotal = Number(clubCount[0]?.value ?? 0);
  const planTotal = Number(practiceCount[0]?.value ?? 0);
  const hasSource = Boolean(profile[0]?.primaryLaunchMonitor?.trim()) || providers > 0;
  const hasImport = sessionTotal > 0 && shotTotal > 0;
  const hasClubs = clubTotal > 0;
  const hasTrust = hasClubs && shotTotal >= 12;
  const steps: ActivationStep[] = [
    {
      id: "source",
      title: "Choose a launch-monitor source",
      description: "Tell the app what you plan to import or connect so the right path is clear.",
      href: "/providers",
      complete: hasSource,
    },
    {
      id: "import",
      title: "Import your first measured session",
      description:
        "Upload a CSV or connect an available source. Your original evidence remains traceable.",
      href: "/import",
      complete: hasImport,
    },
    {
      id: "clubs",
      title: "Match your clubs",
      description: "Club matching makes a shot row useful in your bag and future course decisions.",
      href: "/bag",
      complete: hasClubs,
    },
    {
      id: "trust",
      title: "Find your first usable club signal",
      description:
        "Use the bag view to see whether the sample is large enough to support a confident decision.",
      href: "/bag",
      complete: hasTrust,
    },
    {
      id: "review",
      title: "Review the latest session",
      description: "Check the latest verdict before choosing what to practise next.",
      href: "/today",
      complete: hasImport,
    },
    {
      id: "practice",
      title: "Generate a first practice plan",
      description: "Turn the best available evidence into a measurable range session.",
      href: "/practice",
      complete: planTotal > 0,
    },
  ];
  const completedCount = steps.filter((step) => step.complete).length;
  const established = hasTrust && planTotal > 0 && sessionTotal > 0;
  return {
    available: true,
    established,
    dismissed: Boolean(account[0]?.onboardingCompletedAt),
    steps,
    completedCount,
    firstTrustedResult: hasTrust
      ? `${shotTotal} measured shots across ${clubTotal} active clubs are ready to review.`
      : null,
  };
}

function unavailableJourney(): ActivationJourney {
  return {
    available: false,
    established: false,
    dismissed: false,
    steps: [],
    completedCount: 0,
    firstTrustedResult: null,
  };
}
