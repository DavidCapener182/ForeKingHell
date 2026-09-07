export async function submitCourseRecordAttemptAction(data: FormData) {
  const calls = JSON.parse(document.documentElement.dataset.attemptCalls ?? "[]");
  calls.push(Object.fromEntries(data));
  document.documentElement.dataset.attemptCalls = JSON.stringify(calls);
  if (calls.length === 1) throw new Error("Synthetic save failure. Draft retained.");
  document.documentElement.dataset.attemptSaved = "true";
}
