export async function listOfflineActions(accountId: string) {
  if (accountId === "other") return [];
  if (window.sessionStorage.getItem("queue-state") !== "queued")
    throw new Error("Synthetic storage failure");
  return [{ status: "dead_letter" }];
}
