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

export type OwnerScope = { userId: string };
export type PageRequest = { limit: number; cursor?: string | null };
export type PageResult<T> = { items: T[]; nextCursor: string | null };

export interface ShotService {
  list(scope: OwnerScope, page: PageRequest): Promise<PageResult<Shot>>;
  review(
    scope: OwnerScope,
    input: { shotIds: string[]; action: "exclude" | "restore"; reason: string },
  ): Promise<Shot[]>;
}

export interface SessionService {
  list(scope: OwnerScope, page: PageRequest): Promise<PageResult<Session>>;
  recommendations(scope: OwnerScope, sessionId: string): Promise<Recommendation[]>;
}

export interface BagService {
  clubs(scope: OwnerScope): Promise<Array<Club & { versions: ClubVersion[] }>>;
}

export interface CourseService {
  course(courseId: string): Promise<(Course & { holes: Hole[] }) | null>;
  strategy(scope: OwnerScope, courseId: string, holeNumber: number): Promise<Strategy | null>;
}

export interface PracticeService {
  plans(scope: OwnerScope): Promise<PracticePlan[]>;
}

export interface RoundService {
  rounds(scope: OwnerScope): Promise<Round[]>;
}

export interface GoalService {
  goals(scope: OwnerScope): Promise<Goal[]>;
}
