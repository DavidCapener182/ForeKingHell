export async function partnerFormAction(_previous: unknown, data: FormData) {
  const w = window as unknown as { partnerCalls: Record<string, unknown>[] };
  w.partnerCalls ??= [];
  w.partnerCalls.push(Object.fromEntries(data));
  return w.partnerCalls.length === 1
    ? { ok: false, error: "Synthetic creation unavailable" }
    : { ok: true, message: "Offer created." };
}
