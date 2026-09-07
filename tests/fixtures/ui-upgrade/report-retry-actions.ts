export async function createCoachReportWithStateAction(data: FormData) {
  const state = window as unknown as { reportAttempts: string[] };
  state.reportAttempts ??= [];
  state.reportAttempts.push(String(data.get("requestId")));
  if (state.reportAttempts.length === 1) throw new Error("Synthetic response lost after commit");
  return { ok: true as const, recovered: true, reportId: "synthetic-report" };
}
