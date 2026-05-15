"use server";

import { redirect } from "next/navigation";

import { submitCourseRecordAttempt } from "@/lib/course-records";

export async function submitCourseRecordAttemptAction(formData: FormData) {
  const recordId = formString(formData, "recordId");

  if (!recordId) {
    return;
  }

  const attemptId = await submitCourseRecordAttempt({
    recordId,
    sessionId: formString(formData, "sessionId"),
    screenshotPath: formString(formData, "screenshotPath"),
    extractedScorecardTotal: formNumber(formData, "extractedScorecardTotal"),
    scorecardProofToken: formString(formData, "scorecardProofToken"),
  });

  redirect(`/course-records/${recordId}?attempt=${attemptId}`);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  const parsed = value === null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
