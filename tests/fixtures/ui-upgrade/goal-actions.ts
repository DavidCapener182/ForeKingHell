export const calls: Array<{ action: string; creationId: string; title: string }> = [];
export async function save(action: string, data: FormData) {
  const n = calls.filter((call) => call.action === action).length;
  calls.push({
    action,
    creationId: String(data.get("creationId") ?? ""),
    title: String(data.get("title") ?? ""),
  });
  window.dispatchEvent(new Event("fixture-goal-calls"));
  await new Promise((resolve) => setTimeout(resolve, 500));
  return n % 2 === 0
    ? { ok: false as const, error: "Fixture write failed. Your draft is retained." }
    : { ok: true as const };
}
export const addGoalWithStateAction = (data: FormData) => save("add", data);
export const updateGoalWithStateAction = (data: FormData) => save("update", data);
export const deleteGoalWithStateAction = (data: FormData) => save("delete", data);
export const saveSeasonPlanWithStateAction = (data: FormData) => save("season", data);
