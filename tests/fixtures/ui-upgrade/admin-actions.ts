export async function adminFormAction(_previous: unknown, data: FormData) {
  const target = window as unknown as { adminCalls?: unknown[] };
  target.adminCalls ??= [];
  target.adminCalls.push(Object.fromEntries(data));
  return target.adminCalls.length === 1
    ? { ok: false, error: "Synthetic action unavailable" }
    : { ok: true, message: "Admin access granted." };
}
