export async function adminFormAction(_previous: unknown, data: FormData) {
  const target = window as unknown as {
    moderationCalls?: { operation: unknown; ids: unknown[] }[];
  };
  target.moderationCalls ??= [];
  target.moderationCalls.push({ operation: data.get("operation"), ids: data.getAll("reportId") });
  return target.moderationCalls.length === 1
    ? { ok: false, error: "Synthetic resolution unavailable" }
    : { ok: true, resolvedCount: 1, message: "1 report resolved." };
}
