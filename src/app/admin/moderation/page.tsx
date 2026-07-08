import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Flag,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";

import {
  bulkResolveModerationEventsAction,
  bulkResolveSocialReportsAction,
  resolveModerationEventAction,
  resolveSocialReportAction,
} from "@/app/admin/actions";
import { AdminBulkActionSubmit } from "@/app/admin/admin-bulk-action-submit";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  AdminMetric,
  AdminNav,
  AdminNotice,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  StatusBadge,
} from "@/app/admin/admin-components";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { getAdminModerationData } from "@/lib/admin";

export const dynamic = "force-dynamic";

const adminReportColumns: DesktopWorkbenchColumn[] = [
  { id: "select", label: "Select", locked: true },
  { id: "status", label: "Status" },
  { id: "reason", label: "Reason", locked: true },
  { id: "target", label: "Target" },
  { id: "details", label: "Details" },
  { id: "created", label: "Created" },
  { id: "action", label: "Action", locked: true },
];

const adminEventColumns: DesktopWorkbenchColumn[] = [
  { id: "select", label: "Select", locked: true },
  { id: "status", label: "Status" },
  { id: "event", label: "Event", locked: true },
  { id: "target", label: "Target" },
  { id: "reason", label: "Reason" },
  { id: "created", label: "Created" },
  { id: "action", label: "Action", locked: true },
];

const adminModerationSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Open safety work",
    href: "/admin/moderation",
    detail: "Review unresolved reports and moderation events.",
  },
  {
    title: "User lookup",
    href: "/admin/users",
    detail: "Move from report target to account and role review.",
  },
  {
    title: "Social safety console",
    href: "/social-intelligence",
    detail: "Open the privacy and recap-facing safety surface.",
  },
];

type AdminModerationPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
    reportSort?: string;
    reportDir?: string;
    eventSort?: string;
    eventDir?: string;
  }>;
};

type AdminModerationData = Awaited<ReturnType<typeof getAdminModerationData>>;
type AdminModerationReport = AdminModerationData["reports"][number];
type AdminModerationEvent = AdminModerationData["events"][number];
type AdminModerationSortDirection = "asc" | "desc";
type AdminReportSortMetric = "status" | "reason" | "target" | "details" | "created";
type AdminEventSortMetric = "status" | "event" | "target" | "reason" | "created";
type AdminReportSortState = {
  metric: AdminReportSortMetric;
  dir: AdminModerationSortDirection;
};
type AdminEventSortState = {
  metric: AdminEventSortMetric;
  dir: AdminModerationSortDirection;
};

const adminReportSortLabels: Record<AdminReportSortMetric, string> = {
  status: "Status",
  reason: "Reason",
  target: "Target",
  details: "Details",
  created: "Created",
};

const adminEventSortLabels: Record<AdminEventSortMetric, string> = {
  status: "Status",
  event: "Event",
  target: "Target",
  reason: "Reason",
  created: "Created",
};

const adminReportSortDefaultDirections: Record<
  AdminReportSortMetric,
  AdminModerationSortDirection
> = {
  status: "asc",
  reason: "asc",
  target: "asc",
  details: "asc",
  created: "desc",
};

const adminEventSortDefaultDirections: Record<AdminEventSortMetric, AdminModerationSortDirection> =
  {
    status: "asc",
    event: "asc",
    target: "asc",
    reason: "asc",
    created: "desc",
  };

export default async function AdminModerationPage({ searchParams }: AdminModerationPageProps) {
  const params = await searchParams;
  const reportSortState = parseAdminReportSort(params?.reportSort, params?.reportDir);
  const eventSortState = parseAdminEventSort(params?.eventSort, params?.eventDir);
  const data = await getAdminModerationData();
  const sortedReports = sortAdminReports(data.reports, reportSortState);
  const sortedEvents = sortAdminEvents(data.events, eventSortState);
  const openReports = data.reports.filter((report) => report.status === "open");
  const openEvents = data.events.filter((event) => event.status === "open");

  return (
    <PageShell>
      <MobileRouteHeader title="Platform" group="platform" activeKey="admin" />
      <AdminNav active="/admin/moderation" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <DesktopWorkbenchLayout scope="admin-moderation">
        <AdminPageHeader
          eyebrow="Safety"
          title="Moderation queue"
          description="Review user reports, suspicious social activity and automated moderation events."
          tone="amber"
        />

        <section className="grid gap-3 md:grid-cols-3">
          <AdminMetric
            icon={MessageSquareWarning}
            label="Reports"
            value={data.reports.length}
            detail={`${openReports.length} open`}
          />
          <AdminMetric
            icon={Flag}
            label="Events"
            value={data.events.length}
            detail={`${openEvents.length} open`}
          />
          <AdminMetric
            icon={ShieldCheck}
            label="Resolved"
            value={
              data.reports.length + data.events.length - openReports.length - openEvents.length
            }
            detail="Closed safety records"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <AdminSection
            title="User reports"
            description="Reports created from the Recaps & Safety reporting flow."
          >
            <div data-workbench-scope="admin-moderation-reports">
              <DesktopTableWorkbenchControls
                viewKey="admin-moderation-reports"
                scope="admin-moderation-reports"
                currentViewLabel="User reports queue"
                resultLabel={`${data.reports.length.toLocaleString("en-GB")} reports`}
                columns={adminReportColumns}
                suggestedViews={adminModerationSuggestedViews}
                exportTableId="admin-moderation-reports"
                exportFileName="forekinghell-admin-reports-view.csv"
                className="mb-3"
              />
              <form
                id="admin-report-bulk-form"
                action={bulkResolveSocialReportsAction}
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-950">Bulk actions</p>
                  <p className="text-xs leading-5 text-amber-900/80">
                    Resolve checked open reports. Closed rows are ignored and every change is audit
                    logged.
                  </p>
                </div>
                <AdminBulkActionSubmit
                  actionDescription="This closes the checked open report records and writes an admin audit entry for each change."
                  buttonLabel="Resolve selected reports"
                  fieldName="reportId"
                  formId="admin-report-bulk-form"
                  itemPlural="reports"
                  itemSingular="report"
                />
              </form>
              <div
                id="main-table"
                className="scroll-mt-28 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                tabIndex={-1}
                aria-label="User reports table"
                data-main-table-target="true"
              >
                <table
                  className="w-full min-w-[820px] text-left text-sm"
                  data-workbench-export-table="admin-moderation-reports"
                  aria-describedby="admin-reports-table-summary"
                >
                  <caption id="admin-reports-table-summary" className="sr-only">
                    Admin user reports with selection, status, reason, target, details, creation
                    date and available action.
                  </caption>
                  <thead className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <tr>
                      <th
                        data-column="select"
                        className="sticky left-0 z-30 w-12 bg-white px-3 py-2 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <span className="sr-only">Select</span>
                      </th>
                      <SortableAdminReportHead
                        columnId="status"
                        eventSortState={eventSortState}
                        metric="status"
                        sortState={reportSortState}
                      />
                      <SortableAdminReportHead
                        columnId="reason"
                        eventSortState={eventSortState}
                        metric="reason"
                        sortState={reportSortState}
                        className="sticky left-12 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      />
                      <SortableAdminReportHead
                        columnId="target"
                        eventSortState={eventSortState}
                        metric="target"
                        sortState={reportSortState}
                      />
                      <SortableAdminReportHead
                        columnId="details"
                        eventSortState={eventSortState}
                        metric="details"
                        sortState={reportSortState}
                      />
                      <SortableAdminReportHead
                        columnId="created"
                        eventSortState={eventSortState}
                        metric="created"
                        sortState={reportSortState}
                      />
                      <th data-column="action" className="px-3 py-2 font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-sm text-muted-foreground">
                          No reports yet.
                        </td>
                      </tr>
                    ) : (
                      sortedReports.map((report) => (
                        <tr
                          key={report.id}
                          tabIndex={0}
                          className="focus-aaa border-b outline-none last:border-b-0"
                        >
                          <td
                            data-column="select"
                            className="sticky left-0 z-20 bg-white px-3 py-3 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                          >
                            <input
                              type="checkbox"
                              name="reportId"
                              value={report.id}
                              form="admin-report-bulk-form"
                              disabled={report.status !== "open"}
                              aria-label={`Select report ${label(report.reason)}`}
                              className="size-4 rounded border-border text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
                            />
                          </td>
                          <td data-column="status" className="px-3 py-3">
                            <StatusBadge status={report.status} />
                          </td>
                          <td
                            data-column="reason"
                            className="sticky left-12 z-10 bg-white px-3 py-3 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                          >
                            {label(report.reason)}
                          </td>
                          <td data-column="target" className="px-3 py-3 text-muted-foreground">
                            <p className="font-medium text-foreground">{report.targetType}</p>
                            <p className="mt-1 max-w-[14rem] truncate font-mono text-xs">
                              {report.targetId}
                            </p>
                          </td>
                          <td data-column="details" className="px-3 py-3">
                            <p className="line-clamp-2 max-w-[18rem] text-muted-foreground">
                              {report.details ?? "No details supplied"}
                            </p>
                          </td>
                          <td
                            data-column="created"
                            className="px-3 py-3 text-xs text-muted-foreground"
                          >
                            {formatDateTime(report.createdAt)}
                          </td>
                          <td data-column="action" className="px-3 py-3">
                            {report.status === "open" ? (
                              <form action={resolveSocialReportAction}>
                                <input type="hidden" name="reportId" value={report.id} />
                                <AdminConfirmSubmitButton
                                  confirmMessage={`Resolve report ${label(report.reason)}? This closes the report and writes an admin audit entry.`}
                                  size="sm"
                                >
                                  Resolve
                                </AdminConfirmSubmitButton>
                              </form>
                            ) : (
                              <span className="text-xs text-muted-foreground">Closed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Moderation events"
            description="Automated or operator-created safety records."
          >
            <div data-workbench-scope="admin-moderation-events">
              <DesktopTableWorkbenchControls
                viewKey="admin-moderation-events"
                scope="admin-moderation-events"
                currentViewLabel="Moderation events queue"
                resultLabel={`${data.events.length.toLocaleString("en-GB")} events`}
                columns={adminEventColumns}
                suggestedViews={adminModerationSuggestedViews}
                exportTableId="admin-moderation-events"
                exportFileName="forekinghell-admin-events-view.csv"
                className="mb-3"
              />
              <form
                id="admin-event-bulk-form"
                action={bulkResolveModerationEventsAction}
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-950">Bulk actions</p>
                  <p className="text-xs leading-5 text-amber-900/80">
                    Resolve checked open events. Closed rows are ignored and every change is audit
                    logged.
                  </p>
                </div>
                <AdminBulkActionSubmit
                  actionDescription="This closes the checked open moderation event records and writes an admin audit entry for each change."
                  buttonLabel="Resolve selected events"
                  fieldName="eventId"
                  formId="admin-event-bulk-form"
                  itemPlural="events"
                  itemSingular="event"
                />
              </form>
              <div
                className="scroll-mt-28 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                tabIndex={-1}
                aria-label="Moderation events table"
              >
                <table
                  className="w-full min-w-[820px] text-left text-sm"
                  data-workbench-export-table="admin-moderation-events"
                  aria-describedby="admin-events-table-summary"
                >
                  <caption id="admin-events-table-summary" className="sr-only">
                    Admin moderation events with selection, status, event type, target, reason,
                    creation date and available action.
                  </caption>
                  <thead className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <tr>
                      <th
                        data-column="select"
                        className="sticky left-0 z-30 w-12 bg-white px-3 py-2 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <span className="sr-only">Select</span>
                      </th>
                      <SortableAdminEventHead
                        columnId="status"
                        metric="status"
                        reportSortState={reportSortState}
                        sortState={eventSortState}
                      />
                      <SortableAdminEventHead
                        columnId="event"
                        metric="event"
                        reportSortState={reportSortState}
                        sortState={eventSortState}
                        className="sticky left-12 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      />
                      <SortableAdminEventHead
                        columnId="target"
                        metric="target"
                        reportSortState={reportSortState}
                        sortState={eventSortState}
                      />
                      <SortableAdminEventHead
                        columnId="reason"
                        metric="reason"
                        reportSortState={reportSortState}
                        sortState={eventSortState}
                      />
                      <SortableAdminEventHead
                        columnId="created"
                        metric="created"
                        reportSortState={reportSortState}
                        sortState={eventSortState}
                      />
                      <th data-column="action" className="px-3 py-2 font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-sm text-muted-foreground">
                          No moderation events yet.
                        </td>
                      </tr>
                    ) : (
                      sortedEvents.map((event) => (
                        <tr
                          key={event.id}
                          tabIndex={0}
                          className="focus-aaa border-b outline-none last:border-b-0"
                        >
                          <td
                            data-column="select"
                            className="sticky left-0 z-20 bg-white px-3 py-3 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                          >
                            <input
                              type="checkbox"
                              name="eventId"
                              value={event.id}
                              form="admin-event-bulk-form"
                              disabled={event.status !== "open"}
                              aria-label={`Select event ${label(event.eventType)}`}
                              className="size-4 rounded border-border text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
                            />
                          </td>
                          <td data-column="status" className="px-3 py-3">
                            <StatusBadge status={event.status} />
                          </td>
                          <td
                            data-column="event"
                            className="sticky left-12 z-10 bg-white px-3 py-3 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                          >
                            <p>{label(event.eventType)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {label(event.severity)}
                            </p>
                          </td>
                          <td data-column="target" className="px-3 py-3 text-muted-foreground">
                            <p className="font-medium text-foreground">{event.targetType}</p>
                            <p className="mt-1 max-w-[14rem] truncate font-mono text-xs">
                              {event.targetId}
                            </p>
                          </td>
                          <td data-column="reason" className="px-3 py-3">
                            <p className="line-clamp-2 max-w-[18rem] text-muted-foreground">
                              {event.reason ?? "No reason supplied"}
                            </p>
                          </td>
                          <td
                            data-column="created"
                            className="px-3 py-3 text-xs text-muted-foreground"
                          >
                            {formatDateTime(event.createdAt)}
                          </td>
                          <td data-column="action" className="px-3 py-3">
                            {event.status === "open" ? (
                              <form action={resolveModerationEventAction}>
                                <input type="hidden" name="eventId" value={event.id} />
                                <AdminConfirmSubmitButton
                                  confirmMessage={`Resolve moderation event ${label(event.eventType)}? This closes the event and writes an admin audit entry.`}
                                  size="sm"
                                >
                                  Resolve
                                </AdminConfirmSubmitButton>
                              </form>
                            ) : (
                              <span className="text-xs text-muted-foreground">Closed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </AdminSection>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SortableAdminReportHead({
  className,
  columnId,
  eventSortState,
  metric,
  sortState,
}: {
  className?: string;
  columnId: string;
  eventSortState: AdminEventSortState;
  metric: AdminReportSortMetric;
  sortState: AdminReportSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <th
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminModerationSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminReportHeadLink
        eventSortState={eventSortState}
        metric={metric}
        sortState={sortState}
      />
    </th>
  );
}

function SortableAdminReportHeadLink({
  eventSortState,
  metric,
  sortState,
}: {
  eventSortState: AdminEventSortState;
  metric: AdminReportSortMetric;
  sortState: AdminReportSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: AdminModerationSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : adminReportSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = adminReportSortLabels[metric];

  return (
    <Link
      href={adminModerationSortHref({
        eventSortState,
        reportSortState: { metric, dir: nextDir },
      })}
      prefetch={false}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin reports by ${label}, ${adminModerationSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function SortableAdminEventHead({
  className,
  columnId,
  metric,
  reportSortState,
  sortState,
}: {
  className?: string;
  columnId: string;
  metric: AdminEventSortMetric;
  reportSortState: AdminReportSortState;
  sortState: AdminEventSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <th
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminModerationSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminEventHeadLink
        metric={metric}
        reportSortState={reportSortState}
        sortState={sortState}
      />
    </th>
  );
}

function SortableAdminEventHeadLink({
  metric,
  reportSortState,
  sortState,
}: {
  metric: AdminEventSortMetric;
  reportSortState: AdminReportSortState;
  sortState: AdminEventSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: AdminModerationSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : adminEventSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = adminEventSortLabels[metric];

  return (
    <Link
      href={adminModerationSortHref({
        eventSortState: { metric, dir: nextDir },
        reportSortState,
      })}
      prefetch={false}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin moderation events by ${label}, ${adminModerationSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function adminModerationSortHref({
  eventSortState,
  reportSortState,
}: {
  eventSortState: AdminEventSortState;
  reportSortState: AdminReportSortState;
}) {
  const params = new URLSearchParams();
  params.set("reportSort", reportSortState.metric);
  params.set("reportDir", reportSortState.dir);
  params.set("eventSort", eventSortState.metric);
  params.set("eventDir", eventSortState.dir);

  return `/admin/moderation?${params.toString()}`;
}

function sortAdminReports(reports: AdminModerationReport[], sortState: AdminReportSortState) {
  return [...reports].sort((left, right) => {
    const result = compareAdminReportValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareAdminModerationDates(left.createdAt, right.createdAt, "desc");
  });
}

function compareAdminReportValues(
  left: AdminModerationReport,
  right: AdminModerationReport,
  sortState: AdminReportSortState,
) {
  switch (sortState.metric) {
    case "status":
      return compareAdminModerationNumbers(
        moderationStatusSortWeight(left.status),
        moderationStatusSortWeight(right.status),
        sortState.dir,
      );
    case "reason":
      return compareAdminModerationStrings(label(left.reason), label(right.reason), sortState.dir);
    case "target":
      return compareAdminModerationStrings(
        `${left.targetType} ${left.targetId}`,
        `${right.targetType} ${right.targetId}`,
        sortState.dir,
      );
    case "details":
      return compareAdminModerationStrings(left.details, right.details, sortState.dir);
    case "created":
      return compareAdminModerationDates(left.createdAt, right.createdAt, sortState.dir);
  }
}

function sortAdminEvents(events: AdminModerationEvent[], sortState: AdminEventSortState) {
  return [...events].sort((left, right) => {
    const result = compareAdminEventValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareAdminModerationDates(left.createdAt, right.createdAt, "desc");
  });
}

function compareAdminEventValues(
  left: AdminModerationEvent,
  right: AdminModerationEvent,
  sortState: AdminEventSortState,
) {
  switch (sortState.metric) {
    case "status":
      return compareAdminModerationNumbers(
        moderationStatusSortWeight(left.status),
        moderationStatusSortWeight(right.status),
        sortState.dir,
      );
    case "event":
      return compareAdminModerationStrings(
        `${label(left.eventType)} ${label(left.severity)}`,
        `${label(right.eventType)} ${label(right.severity)}`,
        sortState.dir,
      );
    case "target":
      return compareAdminModerationStrings(
        `${left.targetType} ${left.targetId}`,
        `${right.targetType} ${right.targetId}`,
        sortState.dir,
      );
    case "reason":
      return compareAdminModerationStrings(left.reason, right.reason, sortState.dir);
    case "created":
      return compareAdminModerationDates(left.createdAt, right.createdAt, sortState.dir);
  }
}

function moderationStatusSortWeight(status: string) {
  if (status === "open") return 2;
  if (status === "pending") return 1;
  return 0;
}

function compareAdminModerationNumbers(
  left: number,
  right: number,
  dir: AdminModerationSortDirection,
) {
  return dir === "asc" ? left - right : right - left;
}

function compareAdminModerationDates(left: Date, right: Date, dir: AdminModerationSortDirection) {
  return compareAdminModerationNumbers(left.getTime(), right.getTime(), dir);
}

function compareAdminModerationStrings(
  left: string | null,
  right: string | null,
  dir: AdminModerationSortDirection,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function parseAdminReportSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): AdminReportSortState {
  const metric = parseAdminReportSortMetric(metricValue);

  return {
    metric,
    dir: parseAdminModerationSortDirection(dirValue, adminReportSortDefaultDirections[metric]),
  };
}

function parseAdminReportSortMetric(value: string | undefined): AdminReportSortMetric {
  if (
    value === "status" ||
    value === "reason" ||
    value === "target" ||
    value === "details" ||
    value === "created"
  ) {
    return value;
  }

  return "created";
}

function parseAdminEventSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): AdminEventSortState {
  const metric = parseAdminEventSortMetric(metricValue);

  return {
    metric,
    dir: parseAdminModerationSortDirection(dirValue, adminEventSortDefaultDirections[metric]),
  };
}

function parseAdminEventSortMetric(value: string | undefined): AdminEventSortMetric {
  if (
    value === "status" ||
    value === "event" ||
    value === "target" ||
    value === "reason" ||
    value === "created"
  ) {
    return value;
  }

  return "created";
}

function parseAdminModerationSortDirection(
  value: string | undefined,
  fallback: AdminModerationSortDirection,
): AdminModerationSortDirection {
  return value === "asc" || value === "desc" ? value : fallback;
}

function adminModerationSortAriaValue(dir: AdminModerationSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function adminModerationSortDirectionCopy(
  metric: AdminReportSortMetric | AdminEventSortMetric,
  dir: AdminModerationSortDirection,
) {
  if (metric === "created") {
    return dir === "desc" ? "newest first" : "oldest first";
  }

  return dir === "asc" ? "A to Z" : "Z to A";
}
