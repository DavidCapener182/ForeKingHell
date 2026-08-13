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
import { ModerationRowActions } from "@/app/admin/moderation-row-actions";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  AdminMetric,
  AdminMobileShell,
  AdminNav,
  AdminNotice,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  StatusBadge,
} from "@/app/admin/admin-components";
import { BottomSheet, MobileStatusAction, MobileTabBar } from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { DataTableFrame, PageShell } from "@/components/premium";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Checkbox } from "@/components/ui/checkbox";
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
    view?: string;
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
  const mobileView = parseAdminModerationMobileView(params?.view);
  const moderationTimelineItems = [
    ...data.reports.map((report) => ({
      sortKey: (report.resolvedAt ?? report.createdAt).getTime(),
      item: {
        id: `report-${report.id}`,
        timestamp: formatDateTime(report.resolvedAt ?? report.createdAt),
        title: `Report: ${label(report.reason)}`,
        description: report.details ?? `${report.targetType} · ${report.targetId}`,
        status: label(report.status),
        kind: report.status === "open" ? ("warning" as const) : ("reviewed" as const),
      },
    })),
    ...data.events.map((event) => ({
      sortKey: (event.resolvedAt ?? event.createdAt).getTime(),
      item: {
        id: `event-${event.id}`,
        timestamp: formatDateTime(event.resolvedAt ?? event.createdAt),
        title: `Event: ${label(event.eventType)}`,
        description: event.reason ?? `${event.targetType} · ${event.targetId}`,
        status: label(event.status),
        kind: event.status === "open" ? ("warning" as const) : ("reviewed" as const),
      },
    })),
  ]
    .sort((left, right) => right.sortKey - left.sortKey)
    .slice(0, 8)
    .map(({ item }) => item);

  return (
    <PageShell>
      <AdminMobileShell
        title="Moderation"
        active="/admin/moderation"
        status={params?.adminStatus}
        error={params?.adminError}
      >
        <AdminMobileModeration
          reports={sortedReports}
          events={sortedEvents}
          openReportCount={openReports.length}
          openEventCount={openEvents.length}
          mobileView={mobileView}
        />
      </AdminMobileShell>

      <div className="hidden gap-3 lg:grid">
        <AdminNav active="/admin/moderation" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <DesktopWorkbenchLayout scope="admin-moderation" className="hidden lg:grid">
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
              <DataTableFrame
                mainTable
                mainTableLabel="User reports table"
                stickyFirstColumn
                className="overflow-x-auto"
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
                            <Checkbox
                              name="reportId"
                              value={report.id}
                              form="admin-report-bulk-form"
                              disabled={report.status !== "open"}
                              aria-label={`Select report ${label(report.reason)}`}
                              className="size-4 disabled:opacity-40"
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
                            <ModerationRowActions
                              record={{
                                kind: "report",
                                id: report.id,
                                label: label(report.reason),
                                status: report.status,
                                targetType: report.targetType,
                                targetId: report.targetId,
                                details: report.details ?? "No details supplied",
                                createdLabel: formatDateTime(report.createdAt),
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DataTableFrame>
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
              <DataTableFrame
                label="Moderation events table"
                stickyFirstColumn
                className="overflow-x-auto"
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
                            <Checkbox
                              name="eventId"
                              value={event.id}
                              form="admin-event-bulk-form"
                              disabled={event.status !== "open"}
                              aria-label={`Select event ${label(event.eventType)}`}
                              className="size-4 disabled:opacity-40"
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
                            <ModerationRowActions
                              record={{
                                kind: "event",
                                id: event.id,
                                label: label(event.eventType),
                                status: event.status,
                                targetType: event.targetType,
                                targetId: event.targetId,
                                details: event.reason ?? "No reason supplied",
                                createdLabel: formatDateTime(event.createdAt),
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DataTableFrame>
            </div>
          </AdminSection>
        </section>

        <AdminSection
          title="Moderation audit history"
          description="Latest source-backed report and event records in chronological context."
        >
          <StatusTimeline
            label="Moderation audit history"
            items={moderationTimelineItems}
            empty={<p className="text-sm text-muted-foreground">No moderation history yet.</p>}
          />
        </AdminSection>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type AdminModerationMobileView = "reports" | "events" | "resolved";
type MobileModerationRecord =
  | { kind: "report"; record: AdminModerationReport }
  | { kind: "event"; record: AdminModerationEvent };

function AdminMobileModeration({
  reports,
  events,
  openReportCount,
  openEventCount,
  mobileView,
}: {
  reports: AdminModerationReport[];
  events: AdminModerationEvent[];
  openReportCount: number;
  openEventCount: number;
  mobileView: AdminModerationMobileView;
}) {
  const unresolvedCount = openReportCount + openEventCount;
  const openReports: MobileModerationRecord[] = reports
    .filter((report) => report.status === "open")
    .map((record) => ({ kind: "report", record }));
  const openEvents: MobileModerationRecord[] = events
    .filter((event) => event.status === "open")
    .map((record) => ({ kind: "event", record }));
  const resolvedRecords: MobileModerationRecord[] = [
    ...reports
      .filter((report) => report.status !== "open")
      .map((record) => ({ kind: "report" as const, record })),
    ...events
      .filter((event) => event.status !== "open")
      .map((record) => ({ kind: "event" as const, record })),
  ].sort((left, right) => right.record.createdAt.getTime() - left.record.createdAt.getTime());
  const visibleRecords =
    mobileView === "reports" ? openReports : mobileView === "events" ? openEvents : resolvedRecords;
  const primaryRecords = visibleRecords.slice(0, 10);
  const olderRecords = visibleRecords.slice(10);

  return (
    <>
      <MobileStatusAction
        label="Unresolved safety work"
        value={unresolvedCount}
        detail={`${openReportCount} open reports · ${openEventCount} open moderation events`}
      />

      <MobileTabBar
        activeKey={mobileView}
        ariaLabel="Filter moderation records"
        tabs={[
          {
            key: "reports",
            label: `Reports ${openReportCount}`,
            href: "/admin/moderation?view=reports",
          },
          {
            key: "events",
            label: `Events ${openEventCount}`,
            href: "/admin/moderation?view=events",
          },
          {
            key: "resolved",
            label: "Resolved",
            href: "/admin/moderation?view=resolved",
          },
        ]}
      />

      <section className="grid gap-2" aria-label="Mobile moderation queue">
        <IOSSectionHeader
          title={mobileView === "resolved" ? "Resolved records" : "Priority queue"}
          description={
            mobileView === "resolved"
              ? `${resolvedRecords.length} closed safety records`
              : "Open records requiring an operator decision"
          }
        />
        <MobileModerationRows records={primaryRecords} />
        {olderRecords.length > 0 ? (
          <IOSDisclosureGroup
            label="More moderation records"
            items={[
              {
                value: "more-moderation-records",
                title: "More records",
                summary: olderRecords.length,
                description: "Earlier records in this filter",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileModerationRows records={olderRecords} />,
              },
            ]}
          />
        ) : null}
      </section>
    </>
  );
}

function MobileModerationRows({ records }: { records: MobileModerationRecord[] }) {
  return (
    <IOSGroupedList label="Moderation record rows">
      {records.length > 0 ? (
        records.map((item) => {
          const isReport = item.kind === "report";
          const title = isReport ? label(item.record.reason) : label(item.record.eventType);
          const severity = isReport ? "User report" : label(item.record.severity);

          return (
            <IOSListRow
              key={`${item.kind}-${item.record.id}`}
              label={title}
              detail={`${item.kind === "report" ? "Report" : "Event"} · ${formatDateTime(item.record.createdAt)} · ${label(item.record.targetType)}`}
              status={
                <IOSInlineStatus
                  label={`${severity} · ${label(item.record.status)}`}
                  tone={
                    !isReport && item.record.severity === "high"
                      ? "critical"
                      : item.record.status === "open"
                        ? "attention"
                        : "neutral"
                  }
                />
              }
              trailing={<MobileModerationRecordSheet item={item} />}
            />
          );
        })
      ) : (
        <IOSListRow
          label="No records in this queue"
          detail="Switch filters to inspect another moderation state."
          status={<IOSInlineStatus label="No action required" tone="positive" />}
        />
      )}
    </IOSGroupedList>
  );
}

function MobileModerationRecordSheet({ item }: { item: MobileModerationRecord }) {
  const isReport = item.kind === "report";
  const title = isReport ? label(item.record.reason) : label(item.record.eventType);
  const detail = isReport
    ? (item.record.details ?? "No details supplied")
    : (item.record.reason ?? "No reason supplied");

  return (
    <BottomSheet label="Review" title={isReport ? "Review report" : "Review event"}>
      <div className="grid gap-4">
        <IOSGroupedList label="Moderation record detail">
          <IOSListRow label="Record" value={title} />
          <IOSListRow label="Status" value={label(item.record.status)} />
          <IOSListRow label="Created" value={formatDateTime(item.record.createdAt)} />
          <IOSListRow label="Target type" value={label(item.record.targetType)} />
          <IOSListRow
            label="Target ID"
            detail={<span className="[overflow-wrap:anywhere]">{item.record.targetId}</span>}
          />
          <IOSListRow label="Evidence" detail={detail} />
        </IOSGroupedList>
        {item.record.status === "open" ? (
          <form action={isReport ? resolveSocialReportAction : resolveModerationEventAction}>
            <input type="hidden" name={isReport ? "reportId" : "eventId"} value={item.record.id} />
            <AdminConfirmSubmitButton
              className="min-h-11 w-full"
              confirmMessage={`Resolve ${isReport ? "report" : "moderation event"} ${title}? This closes the record and writes an admin audit entry.`}
            >
              Resolve record
            </AdminConfirmSubmitButton>
          </form>
        ) : (
          <IOSInlineStatus label="This record is already closed" tone="positive" />
        )}
      </div>
    </BottomSheet>
  );
}

function parseAdminModerationMobileView(value: string | undefined): AdminModerationMobileView {
  return value === "events" || value === "resolved" ? value : "reports";
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
    <a
      href={adminModerationSortHref({
        eventSortState,
        reportSortState: { metric, dir: nextDir },
      })}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin reports by ${label}, ${adminModerationSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </a>
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
    <a
      href={adminModerationSortHref({
        eventSortState: { metric, dir: nextDir },
        reportSortState,
      })}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin moderation events by ${label}, ${adminModerationSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </a>
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
