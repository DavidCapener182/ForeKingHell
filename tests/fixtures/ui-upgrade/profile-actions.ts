export async function updateSocialProfileFormAction(_previous: unknown, data: FormData) {
  const state = window as unknown as { profileCalls: Record<string, FormDataEntryValue>[] };
  state.profileCalls ??= [];
  state.profileCalls.push(Object.fromEntries(data));
  return state.profileCalls.length === 1
    ? { ok: false, error: "Synthetic profile save failed; retry." }
    : { ok: true };
}
