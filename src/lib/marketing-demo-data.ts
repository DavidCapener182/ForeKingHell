/**
 * Public-only, fictional product fixtures. These values must never be joined to
 * a signed-in account or written to the application database.
 */
export const marketingDemoClubs = [
  {
    key: "driver",
    label: "Driver",
    carry: 242,
    range: "234–249 yd",
    confidence: "High",
    sample: 46,
    freshness: "6 days ago",
    pattern: "6 yd right",
    practice: "Start line: 12 balls to a 30 yd fairway window",
  },
  {
    key: "seven-iron",
    label: "7 Iron",
    carry: 158,
    range: "153–163 yd",
    confidence: "Medium",
    sample: 24,
    freshness: "9 days ago",
    pattern: "Short-left when strike drops",
    practice: "Strike ladder: 18 balls, carry-first scoring",
  },
  {
    key: "wedge",
    label: "Wedge",
    carry: 96,
    range: "92–99 yd",
    confidence: "High",
    sample: 38,
    freshness: "6 days ago",
    pattern: "Tight carry window",
    practice: "Distance ladder: 15 balls across three targets",
  },
] as const;

export type MarketingDemoClub = (typeof marketingDemoClubs)[number];

export const marketingTourSteps = [
  {
    id: "import",
    eyebrow: "01 · Import a measured session",
    title: "Keep the row. Check the signal.",
    description:
      "Bring in a Rapsodo CSV, match clubs and see duplicate or data-quality checks before conclusions are made.",
    detail: "Original import evidence remains traceable.",
    metric: "46 measured shots",
  },
  {
    id: "review",
    eyebrow: "02 · Review what happened",
    title: "A verdict with its evidence attached.",
    description:
      "Review the latest session as good, mixed or weak evidence, with raw and clean shots kept distinct.",
    detail: "Driver start line is the clearest current opportunity.",
    metric: "Mixed evidence",
  },
  {
    id: "trust",
    eyebrow: "03 · Trust the right club number",
    title: "Use a carry you can explain.",
    description:
      "Median carry, dispersion, sample size, freshness and confidence sit together—so a yardage never pretends to be firmer than it is.",
    detail: "Driver carry 242 yd · high confidence.",
    metric: "242 yd",
  },
  {
    id: "change",
    eyebrow: "04 · Understand what changed",
    title: "Spot the pattern, not the noise.",
    description:
      "Compare sessions for direction and strike changes, then separate an improvement, a regression and a data-health warning.",
    detail: "Carry is steady. Start line is drifting right.",
    metric: "+6 yd right",
  },
  {
    id: "practice",
    eyebrow: "05 · Build the right practice session",
    title: "Give the range work a measurable job.",
    description:
      "Practice Planner turns the strongest evidence into a session length, ball count and target, then compares the plan with imported results.",
    detail: "30 min · 36 balls · start-line window.",
    metric: "30 min plan",
  },
  {
    id: "course",
    eyebrow: "06 · Take the plan to the course",
    title: "Choose a safe target from your own bag.",
    description:
      "Course Strategy and the Course Twin pilot connect trusted clubs, safe targets and common misses to each hole decision.",
    detail: "Pilot route · modelled placement is labelled.",
    metric: "Safe target",
  },
] as const;

export const marketingFaqs = [
  {
    question: "Which launch monitors are supported?",
    answer:
      "Rapsodo CSV import is available. Cloud sync depends on the connected environment and adapter configuration. Square remains beta and TrackMan remains coming soon unless their adapters are enabled for your account.",
  },
  {
    question: "How is club confidence calculated?",
    answer:
      "Confidence is displayed alongside club conclusions using the available sample size, freshness and consistency of the imported evidence. It is there to qualify a decision, not to hide uncertainty.",
  },
  {
    question: "Does the app change or delete imported data?",
    answer:
      "The product preserves traceable import evidence. Cleaning, matching and derived summaries are presented alongside the source so you can review the basis for a conclusion.",
  },
  {
    question: "What does Data Chat have access to?",
    answer:
      "Data Chat answers from your own in-app records such as shots, bag, rounds and practice context. It is read-only: it cannot change yardages, handicap, billing or records.",
  },
  {
    question: "Can I use it on mobile?",
    answer:
      "Yes. The authenticated companion keeps Today, Practice, Strategy, Review and Bag one tap away, with import, account and settings actions behind focused profile controls.",
  },
  {
    question: "What is Course Twin?",
    answer:
      "Course Twin is a pilot for connecting your trusted bag data with a mapped course decision. Measured launch-monitor rows remain distinct from reconstructed flight, placement and modelled outcomes.",
  },
  {
    question: "Can I track real and simulator rounds separately?",
    answer:
      "Yes. Rounds and scorecards support their own context so review can distinguish play formats while retaining the evidence behind each record.",
  },
  {
    question: "Is the product still in beta?",
    answer:
      "Yes. LM World Tour is in beta. Availability for providers and advanced features can depend on the account plan and current configuration.",
  },
  {
    question: "How is my data handled?",
    answer:
      "Golf data is scoped to the account, and the app provides visibility, sharing, export and deletion controls where they are implemented. Read the privacy page for the current product notice.",
  },
] as const;
