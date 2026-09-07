export type LoginActionState = { status: "idle" | "error" | "success"; message: string | null };
export async function signInWithPasswordAction(
  _state: LoginActionState,
  data: FormData,
): Promise<LoginActionState> {
  const w = window as unknown as { authCalls: Record<string, string>[] };
  w.authCalls ??= [];
  w.authCalls.push({ email: String(data.get("email")), next: String(data.get("next")) });
  return { status: "error", message: "Synthetic invalid credentials. Try again." };
}
export async function sendMagicLinkAction(): Promise<LoginActionState> {
  throw new TypeError("Failed to fetch");
}
export async function signInWithOAuthAction() {
  throw new Error("No live OAuth in fixture");
}
