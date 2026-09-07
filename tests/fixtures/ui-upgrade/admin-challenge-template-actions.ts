export async function saveAdminChallengeTemplateAction(_previous: unknown, data: FormData) {
  const w = window as unknown as { templateCalls: Record<string, unknown>[] };
  w.templateCalls ??= [];
  w.templateCalls.push(Object.fromEntries(data));
  return w.templateCalls.length === 1
    ? { ok: false, error: "Synthetic save unavailable" }
    : { ok: true, message: "Template created." };
}
