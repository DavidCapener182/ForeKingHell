import { BarChart3, Brain, Flag, Gauge, Map, ShieldCheck, Trophy } from "lucide-react";

import { Reveal } from "./reveal";
import styles from "./marketing.module.css";

const groups = [
  {
    key: "review",
    icon: BarChart3,
    title: "Review",
    outcome: "See the session, round and evidence that matters now.",
    features: [
      "Today and latest-session review",
      "Sessions and rounds",
      "Raw and trusted shot evidence",
      "Handicap and scorecards",
    ],
  },
  {
    key: "analyse",
    icon: Gauge,
    title: "Analyse",
    outcome: "Turn measured shots into a bag and performance picture you can use.",
    features: [
      "Shot explorer and flight patterns",
      "Bag map and stock yardages",
      "Session comparison and progress",
      "Strokes gained and Performance Lab",
    ],
  },
  {
    key: "improve",
    icon: Brain,
    title: "Improve",
    outcome: "Give the next practice session a job and a way to review it.",
    features: [
      "Coach and Practice Planner",
      "Quick Range and Speed Centre",
      "Training Load and Goals",
      "Data Chat",
    ],
  },
  {
    key: "play",
    icon: Map,
    title: "Play",
    outcome: "Carry the trusted number into a safer pre-round decision.",
    features: [
      "Courses and Course Strategy",
      "Course Twin pilot",
      "Course records",
      "Pre- and post-round review",
    ],
  },
  {
    key: "compete",
    icon: Trophy,
    title: "Compete",
    outcome: "Keep competition and community connected to actual golf activity.",
    features: [
      "Challenges and tournaments",
      "Leaderboards and groups",
      "Friends and achievements",
      "Activity feed",
    ],
  },
  {
    key: "trust",
    icon: ShieldCheck,
    title: "Trust",
    outcome: "Keep every golf decision connected to the evidence behind it.",
    features: [
      "Original imports stay reviewable",
      "Sample size and freshness stay visible",
      "AI explains records without changing them",
      "Measured and modelled outcomes stay distinct",
    ],
  },
] as const;

export function FeatureShowcase() {
  return (
    <section id="features" className={styles.featuresSection} aria-labelledby="features-title">
      <Reveal className={styles.sectionIntro}>
        <p className={styles.eyebrow}>A complete golf system</p>
        <h2 id="features-title">The evidence travels further than a dashboard.</h2>
        <p>
          Review, analyse, improve, play and compete are organised around what a golfer needs to
          decide next.
        </p>
      </Reveal>
      <div className={styles.featureGrid}>
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <Reveal className={styles.featureCard} key={group.key}>
              <span className={styles.featureIconWrap}>
                <Icon className={styles.featureIcon} aria-hidden />
              </span>
              <div>
                <h3>{group.title}</h3>
                <p>{group.outcome}</p>
              </div>
              <ul>
                {group.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>
      <div id="community" className={styles.communityProof}>
        <Flag className="size-5" />
        <p>
          <strong>Community stays grounded in golf activity.</strong> Challenges, records, groups
          and the feed sit behind the core import → insight → practice journey, not in front of it.
        </p>
      </div>
    </section>
  );
}
