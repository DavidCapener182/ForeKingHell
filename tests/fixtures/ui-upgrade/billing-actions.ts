export async function createCheckoutFormAction(_previous: unknown, data: FormData) {
  const target = window as unknown as { billingCalls?: unknown[] };
  target.billingCalls ??= [];
  target.billingCalls.push(Object.fromEntries(data));
  return { ok: false, error: "Synthetic checkout unavailable", url: undefined };
}
export async function openCustomerPortalFormAction() {
  const target = window as unknown as { portalCalls?: number };
  target.portalCalls = (target.portalCalls ?? 0) + 1;
  return { ok: false, error: "Synthetic portal unavailable", url: undefined };
}
