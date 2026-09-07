export async function updateUserSettingsFormAction(_previous: unknown, data: FormData) {
  const s = window as unknown as { settingsCalls: Record<string, FormDataEntryValue>[] };
  s.settingsCalls ??= [];
  s.settingsCalls.push(Object.fromEntries(data));
  return s.settingsCalls.length === 1
    ? { ok: false, error: "Synthetic settings failure; draft retained." }
    : { ok: true };
}
export async function settingsAccessFormAction(_previous: unknown, data: FormData) {
  const s = window as unknown as { accessCalls: Record<string, FormDataEntryValue>[] };
  s.accessCalls ??= [];
  s.accessCalls.push(Object.fromEntries(data));
  return { ok: true, inviteToken: "synthetic-invite-token" };
}
