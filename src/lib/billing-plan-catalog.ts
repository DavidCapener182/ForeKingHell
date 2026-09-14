export const billingIntervals = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export type PlanKey = "free" | "plus" | "pro" | "coach" | "full";

export type BillingPlan = {
  key: PlanKey;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  audience: string;
  description: string;
  features: string[];
  priceEnv: Partial<Record<BillingInterval, string>>;
  internal?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    key: "free",
    name: "Free",
    monthlyPrice: "£0",
    yearlyPrice: "£0",
    audience: "Rapsodo CSV starters",
    description: "Starter importing, trust checks, public records and basic social play.",
    features: [
      "5 monthly imports",
      "Import Quality and Data Health",
      "Basic bag and stock yardage views",
      "Public course records",
      "Monthly public boards",
      "Basic friend and profile features",
      "Manual rounds, practice and course play",
    ],
    priceEnv: {},
  },
  {
    key: "plus",
    name: "Plus",
    monthlyPrice: "£6.99",
    yearlyPrice: "£69",
    audience: "Players tracking long-term improvement",
    description: "Unlimited history, private competition, share cards and light AI review.",
    features: [
      "Everything in Free",
      "Unlimited imports",
      "Detailed club analytics, progress and strokes-gained analysis",
      "Training trends, equipment experiments and saved comparisons",
      "Selective reports with sharing controls",
      "Private course boards; create private tournaments and challenges",
      "Portrait share-card exports",
      "10 AI credits per month",
      "Weekly recaps, practice recaps, captions and session roast",
      "Up to 2 scorecard extracts per month (uses AI credits)",
    ],
    priceEnv: {
      monthly: "STRIPE_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_PLUS_YEARLY_PRICE_ID",
    },
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: "£12.99",
    yearlyPrice: "£119",
    audience: "Launch-monitor power users",
    description: "AI coaching, Data Chat, course strategy and player comparison.",
    features: [
      "Everything in Plus",
      "AI coach and Ask Coach chat",
      "Data Chat from your golf history",
      "100 AI credits per month",
      "30 AI chat messages per day",
      "AI course strategy and challenge copy",
      "Up to 10 scorecard extracts per month (uses AI credits)",
      "Player comparison and social intelligence",
      "Square and TrackMan beta adapters when enabled",
    ],
    priceEnv: {
      monthly: "STRIPE_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_PRO_YEARLY_PRICE_ID",
    },
  },
  {
    key: "coach",
    name: "Coach / Club",
    monthlyPrice: "£49",
    yearlyPrice: "£499",
    audience: "Coaches, societies and simulator venues",
    description: "A connected coach workspace, player feedback and hosted major tournaments.",
    features: [
      "Everything in Pro",
      "Coach workspace for players who grant access",
      "Player summaries, private notes and assignments",
      "Player feedback and evidence requests",
      "Host major-style tournaments",
      "300 AI credits per month for your account",
      "60 AI chat messages per day",
      "Up to 25 scorecard extracts per month (uses AI credits)",
    ],
    priceEnv: {
      monthly: "STRIPE_COACH_MONTHLY_PRICE_ID",
      yearly: "STRIPE_COACH_YEARLY_PRICE_ID",
    },
  },
  {
    key: "full",
    name: "Lifetime Full",
    monthlyPrice: "Lifetime",
    yearlyPrice: "No renewal",
    audience: "Internal owner grant",
    description: "Permanent full access for owner and operator accounts that run the site.",
    features: [
      "Unlimited imports",
      "AI coach",
      "Data Chat",
      "Internal AI safety cap",
      "Major-style tournaments",
      "All provider adapters",
      "Admin operations",
    ],
    priceEnv: {},
    internal: true,
  },
];
