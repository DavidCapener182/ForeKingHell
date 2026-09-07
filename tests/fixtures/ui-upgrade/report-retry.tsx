import { createRoot } from "react-dom/client";
import { ReportBuilder } from "@/app/coach/reports/report-builder";
import { coachReportSectionIds } from "@/lib/coach-report";
const copy = Object.fromEntries(
  coachReportSectionIds.map((id) => [
    id,
    {
      title: id.replaceAll("_", " "),
      detail: "Synthetic selected evidence",
      checked: id === "recent_sessions",
    },
  ]),
) as Parameters<typeof ReportBuilder>[0]["copy"];
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <h1>Report retry fixture</h1>
    <ReportBuilder copy={copy} templates={[{ value: "coach", label: "Coach" }]} />
  </main>,
);
