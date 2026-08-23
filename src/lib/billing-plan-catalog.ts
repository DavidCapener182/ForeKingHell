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
      "Unlimited imports and history",
      "Advanced bag and progress views",
      "Private course boards, tournaments and challenges",
      "Share-card customisation",
      "10 AI credits per month",
      "Weekly recaps, practice recaps, captions and session roast",
      "2 scorecard extracts per month",
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
    description: "AI coaching, Data Chat, course strategy and deeper launch-monitor analytics.",
    features: [
      "AI coach and Ask Coach chat",
      "Data Chat from your golf history",
      "100 AI credits per month",
      "30 AI chat messages per day",
      "AI course strategy and practice reviews",
      "10 scorecard extracts per month",
      "Friend comparison and challenge analytics",
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
    description: "Player seats, coach dashboards, hosted events and evidence review.",
    features: [
      "Up to 25 player seats",
      "Coach dashboard and player summaries",
      "Private leagues and player groups",
      "Major-style tournaments",
      "Evidence review queue",
      "300 pooled AI credits",
      "60 AI chat messages per day",
      "25 scorecard extracts per month",
      "Export standings",
      "Custom pricing above 25 players",
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
