import { createRoot } from "react-dom/client";
import {
  PeopleDirectory,
  type PeopleDirectoryRow,
} from "../../../src/app/friends/people-directory";
import { GroupMemberList } from "../../../src/app/groups/group-member-list";
import { SharedSessionLedger } from "../../../src/app/shared/shared-session-ledger";
import { SocialTaskForm } from "../../../src/app/social-intelligence/social-task-form";

// SYNTHETIC ACCEPTANCE FIXTURE: no live account data, auth, network or writes.
const recommended = {
  id: "synthetic-player",
  status: "suggested",
  section: "recommended",
  profile: {
    userId: "synthetic-player",
    username: "fixture-golfer",
    displayName: "Synthetic golfer",
    avatarUrl: null,
    relationship: "none",
    homeCourse: "Synthetic test course",
    handicapBand: null,
  },
} as PeopleDirectoryRow;
createRoot(document.getElementById("root")!).render(
  <main className="grid min-w-0 gap-6 bg-background p-4 text-foreground sm:p-6">
    <header>
      <p className="text-xs font-semibold text-primary">SYNTHETIC SOCIAL PAGE FIXTURE</p>
      <h1 className="text-2xl font-semibold">Social page review</h1>
      <p>Real components with synthetic observations. No account data or actions.</p>
    </header>
    <section
      aria-label="Synthetic friend directory"
      className="min-w-0 rounded-xl border bg-card p-4"
    >
      <PeopleDirectory rows={[recommended]} query="no-match" activeTab="discover" />
    </section>
    <section aria-label="Synthetic group roster" className="min-w-0 rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-xl font-semibold">Group members</h2>
      <GroupMemberList
        members={[
          {
            userId: "fixture-zero",
            username: "fixture-zero",
            displayName: "Synthetic zero-points golfer",
            avatarUrl: null,
            role: "member",
            points: 0,
            summary: "Recorded round: zero weekly points",
          },
          {
            userId: "fixture-unavailable",
            username: "fixture-unavailable",
            displayName: "Synthetic unrecorded golfer",
            avatarUrl: null,
            role: "member",
          },
        ]}
      />
    </section>
    <section
      aria-label="Synthetic shared sessions"
      className="min-w-0 rounded-xl border bg-card p-4"
    >
      <SharedSessionLedger
        total={2}
        rows={[
          {
            id: "synthetic-full",
            date: "2026-10-18T12:00:00Z",
            type: "round",
            courseName: "Synthetic test course",
            fileName: null,
            holesPlayed: 18,
            totalScore: 84,
          },
          {
            id: "synthetic-partial",
            date: "2026-10-17T12:00:00Z",
            type: "round",
            courseName: null,
            fileName: "Synthetic partial scorecard",
            holesPlayed: 6,
            totalScore: null,
          },
        ]}
      />
    </section>
    <section
      aria-label="Synthetic recap readiness"
      className="min-w-0 rounded-xl border bg-card p-4"
    >
      <h2 className="mb-3 text-xl font-semibold">Recap readiness</h2>
      <SocialTaskForm task="generate" sourceCount={0} sourcePeriod="No source activity" />
      <SocialTaskForm task="report" sourceCount={0} sourcePeriod="" />
    </section>
  </main>,
);
