let calls = 0;
export async function socialIntelligenceFormAction(_previous: unknown, data: FormData) {
  calls++;
  (window as unknown as { generationCalls: unknown[] }).generationCalls ??= [];
  (window as unknown as { generationCalls: unknown[] }).generationCalls.push(
    Object.fromEntries(data.entries()),
  );
  return calls === 1
    ? { ok: false, error: "Synthetic generation unavailable. Retry with the same scope." }
    : { ok: true };
}
