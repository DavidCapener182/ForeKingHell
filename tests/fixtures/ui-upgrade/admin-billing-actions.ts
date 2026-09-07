export async function resolveAdminGrantTargetAction(data: FormData) {
  if (data.get("email") !== "target@example.invalid")
    return { ok: false, error: "No user exists for that email address." };
  return {
    ok: true,
    target: {
      id: "target-id",
      displayName: "Resolved synthetic player",
      email: "target@example.invalid",
    },
  };
}
export async function adminFormAction(_previous: unknown, data: FormData) {
  const target = window as unknown as { grantCalls?: unknown[] };
  target.grantCalls ??= [];
  target.grantCalls.push(Object.fromEntries(data));
  return target.grantCalls.length === 1
    ? { ok: false, error: "Synthetic grant unavailable" }
    : { ok: true, message: "Lifetime full access granted." };
}
