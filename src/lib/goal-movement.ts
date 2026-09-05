import type { SeasonGoal } from "@/lib/product-preferences-model";

export type GoalMovement = {
  id: string;
  goalId: string;
  title: string;
  from: number;
  to: number;
  unit: string;
  recordedAt: string;
};

/** Value edits are recorded as updates, never inferred as measured improvement. */
export function recordGoalMovements(
  previous: SeasonGoal[],
  next: SeasonGoal[],
  history: unknown,
  now: Date,
): GoalMovement[] {
  const changes = next.flatMap((goal) => {
    const before = previous.find((item) => item.id === goal.id);
    if (
      !before ||
      before.type !== goal.type ||
      before.club !== goal.club ||
      before.unit !== goal.unit ||
      before.currentValue === goal.currentValue
    )
      return [];
    if (![before.currentValue, goal.currentValue].every(Number.isFinite)) return [];
    return [
      {
        id: `${goal.id}:${now.toISOString()}`,
        goalId: goal.id,
        title: goal.title,
        from: before.currentValue,
        to: goal.currentValue,
        unit: goal.unit,
        recordedAt: now.toISOString(),
      },
    ];
  });
  const retained = readGoalMovements(history).filter((event) =>
    next.some((goal) => goal.id === event.goalId),
  );
  return [...changes, ...retained].slice(0, 48);
}

export function readGoalMovements(value: unknown): GoalMovement[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((event): event is GoalMovement => {
      if (!event || typeof event !== "object") return false;
      return (
        [event.id, event.goalId, event.title, event.unit, event.recordedAt].every(
          (item) => typeof item === "string",
        ) &&
        Number.isFinite(event.from) &&
        Number.isFinite(event.to) &&
        event.from !== event.to &&
        Number.isFinite(Date.parse(event.recordedAt))
      );
    })
    .slice(0, 48);
}
