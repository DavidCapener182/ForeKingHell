import { describe, expectTypeOf, it } from "vitest";

import type {
  Club,
  ClubVersion,
  Course,
  Goal,
  Hole,
  PracticePlan,
  Recommendation,
  Round,
  Session,
  Shot,
  Strategy,
} from "@/domain/models";
import type {
  BagService,
  CourseService,
  GoalService,
  PracticeService,
  RoundService,
  SessionService,
  ShotService,
} from "@/domain/services";

describe("canonical typed domain", () => {
  it("exports every master-plan entity and its service boundary", () => {
    expectTypeOf<Shot>().toHaveProperty("sessionId");
    expectTypeOf<Session>().toHaveProperty("userId");
    expectTypeOf<Club>().toHaveProperty("normalizedClubKey");
    expectTypeOf<ClubVersion>().toHaveProperty("effectiveFrom");
    expectTypeOf<Course>().toHaveProperty("name");
    expectTypeOf<Hole>().toHaveProperty("holeNumber");
    expectTypeOf<Strategy>().toHaveProperty("recommended");
    expectTypeOf<PracticePlan>().toHaveProperty("status");
    expectTypeOf<Round>().toHaveProperty("currentHole");
    expectTypeOf<Goal>().toHaveProperty("targetValue");
    expectTypeOf<Recommendation>().toHaveProperty("evidence");

    expectTypeOf<ShotService>().toHaveProperty("review");
    expectTypeOf<SessionService>().toHaveProperty("recommendations");
    expectTypeOf<BagService>().toHaveProperty("clubs");
    expectTypeOf<CourseService>().toHaveProperty("strategy");
    expectTypeOf<PracticeService>().toHaveProperty("plans");
    expectTypeOf<RoundService>().toHaveProperty("rounds");
    expectTypeOf<GoalService>().toHaveProperty("goals");
  });
});
