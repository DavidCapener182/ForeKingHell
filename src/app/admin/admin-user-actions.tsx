"use client";
import { useState } from "react";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { AdminOperationForm } from "@/app/admin/admin-operation-form";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type AdminUserRowData = {
  id: string;
  displayName: string;
  email: string | null;
  username: string | null;
  activePlan: string;
  sessionCount: number;
  feedCount: number;
  adminRole: string | null;
  adminStatus: string | null;
  createdLabel: string;
  auditEvents: { id: string; actionLabel: string; createdLabel: string }[];
};
export function AdminUserDirectory({
  users,
  canManageOwners,
  currentUserId,
  order,
}: {
  users: AdminUserRowData[];
  canManageOwners: boolean;
  currentUserId: string;
  order: string;
}) {
  const ready = useClientReady();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = users.find((user) => user.id === selectedId) ?? null;
  return (
    <section data-workbench-scope="admin-users" className="grid min-w-0 gap-3">
      <DesktopWorkbenchControls
        viewKey={`admin-users:${currentUserId}`}
        scope="admin-users"
        currentViewLabel="Account search"
        resultLabel={`${users.length} matching loaded accounts`}
        exportFileName="admin-users-filtered.csv"
        columns={[
          { id: "user", label: "Account", locked: true },
          { id: "email", label: "Email" },
          { id: "plan", label: "Plan" },
          { id: "activity", label: "Activity" },
          { id: "admin", label: "Admin role / status" },
          { id: "created", label: "Created" },
          { id: "action", label: "Actions", locked: true },
        ]}
      />
      <div className={layout.desktop}>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Admin user accounts table"
          tabIndex={0}
        >
          <table className="w-full text-left text-sm" data-workbench-export-table="admin-users">
            <caption className="sr-only">
              Selected account search results: identity, plan, activity, administrator role,
              creation and details.
            </caption>
            <thead>
              <tr>
                <th
                  data-column="user"
                  scope="col"
                  aria-sort={
                    order.startsWith("user_")
                      ? order.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  Account
                </th>
                <th data-column="email" scope="col">
                  Email
                </th>
                <th
                  data-column="plan"
                  scope="col"
                  aria-sort={
                    order.startsWith("plan_")
                      ? order.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  Plan
                </th>
                <th
                  data-column="activity"
                  scope="col"
                  aria-sort={
                    order.startsWith("activity_")
                      ? order.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  Activity
                </th>
                <th
                  data-column="admin"
                  scope="col"
                  aria-sort={
                    order.startsWith("admin_")
                      ? order.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  Admin role / status
                </th>
                <th
                  data-column="created"
                  scope="col"
                  aria-sort={
                    order.startsWith("created_")
                      ? order.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  Created
                </th>
                <th data-column="action" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <th scope="row" data-column="user">
                    {user.displayName}
                    <span className="block text-xs font-normal">
                      {user.username ?? "No username"}
                    </span>
                  </th>
                  <td data-column="email" className="break-all">
                    {user.email ?? "No email"}
                  </td>
                  <td data-column="plan">{user.activePlan}</td>
                  <td data-column="activity">
                    {user.sessionCount} sessions · {user.feedCount} feed cards
                  </td>
                  <td data-column="admin">
                    {user.adminRole ?? "No admin role"} · {user.adminStatus ?? "Standard"}
                  </td>
                  <td data-column="created">{user.createdLabel}</td>
                  <td data-column="action">
                    <Button
                      variant="outline"
                      disabled={!ready}
                      onClick={() => setSelectedId(user.id)}
                      aria-label={`Account details for ${user.displayName}`}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={layout.mobile}>
        {users.map((user) => (
          <Button
            key={user.id}
            variant="outline"
            disabled={!ready}
            className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
            onClick={() => setSelectedId(user.id)}
          >
            <span className="min-w-0 break-words">
              <span data-column="user">{user.displayName}</span>
              <span data-column="email" className="block break-all text-xs font-normal">
                {user.email ?? user.id}
              </span>
              <span data-column="plan" className="block text-xs">
                Plan: {user.activePlan}
              </span>
              <span data-column="activity" className="block text-xs">
                {user.sessionCount} sessions · {user.feedCount} feed cards
              </span>
              <span data-column="admin" className="block text-xs">
                {user.adminRole ?? "No admin role"} · {user.adminStatus ?? "Standard"}
              </span>
              <span data-column="created" className="block text-xs">
                Created: {user.createdLabel}
              </span>
            </span>
            <span className="ml-2 shrink-0">Details</span>
          </Button>
        ))}
      </div>
      {!users.length ? (
        <p className="rounded-xl border p-4">
          No accounts match this loaded view. Clear filters or refine your search.
        </p>
      ) : null}
      <ResponsiveDetailPanel
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.displayName ?? "Account details"}
        description="Authorised account information and explicitly reviewed actions."
      >
        {selected ? (
          <div key={selected.id} className="grid gap-5">
            <dl className="grid gap-3">
              {Object.entries({
                "Account ID": selected.id,
                Email: selected.email ?? "No email",
                Username: selected.username ?? "Not set",
                Plan: selected.activePlan,
                "Admin role": selected.adminRole ?? "None",
                "Admin status": selected.adminStatus ?? "Standard",
                Created: selected.createdLabel,
                Sessions: selected.sessionCount,
                "Feed cards": selected.feedCount,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="break-all font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">Activity counts are recorded totals, not last-seen status.</p>
            <>
              {canManageOwners && selected.email && selected.activePlan !== "full" ? (
                <AdminOperationForm
                  operation="grant-lifetime"
                  title="Grant lifetime full"
                  description="Create permanent full-plan access for this account. This does not charge a payment method."
                >
                  <input type="hidden" name="email" value={selected.email} />
                  <input type="hidden" name="userId" value={selected.id} />
                </AdminOperationForm>
              ) : null}
              {selected.email &&
              selected.id !== currentUserId &&
              (canManageOwners || !selected.adminRole) ? (
                <AdminOperationForm
                  operation="grant-admin"
                  title="Apply admin role"
                  description="Operator handles routine administration; owner has full administrative control."
                >
                  <input type="hidden" name="email" value={selected.email} />
                  <input type="hidden" name="userId" value={selected.id} />
                  <label className="grid gap-1 text-sm">
                    Admin role
                    <select
                      name="role"
                      defaultValue={selected.adminRole ?? "operator"}
                      className="min-h-11 rounded-lg border bg-background px-3"
                    >
                      <option value="operator">Operator</option>
                      {canManageOwners ? <option value="owner">Owner</option> : null}
                    </select>
                  </label>
                </AdminOperationForm>
              ) : null}
              {canManageOwners && selected.adminRole && selected.id !== currentUserId ? (
                <AdminOperationForm
                  operation="deactivate-admin"
                  title="Deactivate admin access"
                  description="Remove active administrative access. The player account and golf data remain."
                >
                  <input type="hidden" name="userId" value={selected.id} />
                  <input type="hidden" name="email" value={selected.email ?? ""} />
                </AdminOperationForm>
              ) : null}
            </>
            <section>
              <h3 className="font-semibold">Recent account audit</h3>
              <p className="text-xs text-muted-foreground">
                Loaded audit window only; this is not the entire account history.
              </p>
              <ol className="mt-3 grid gap-2">
                {selected.auditEvents.map((event) => (
                  <li key={event.id} className="rounded-lg border p-3">
                    <p>{event.actionLabel}</p>
                    <p className="text-xs">{event.createdLabel}</p>
                  </li>
                ))}
              </ol>
              {!selected.auditEvents.length ? <p>No events in the loaded audit window.</p> : null}
            </section>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
export function AdminAccessDialog({ canManageOwners }: { canManageOwners: boolean }) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={!ready} onClick={() => setOpen(true)}>
        Grant access
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Grant account access"
        description="Enter an existing account email and review the exact access change."
      >
        <div className="grid gap-4">
          {canManageOwners ? (
            <AdminOperationForm
              operation="grant-lifetime"
              title="Grant lifetime full"
              description="Creates permanent full-plan access for the reviewed account."
            >
              <label className="grid gap-1 text-sm">
                Account email
                <Input type="email" name="email" required />
              </label>
            </AdminOperationForm>
          ) : null}
          <AdminOperationForm
            operation="grant-admin"
            title="Grant admin role"
            description="Owner grants full administrative control. Operator grants routine operational access."
          >
            <label className="grid gap-1 text-sm">
              Account email
              <Input type="email" name="email" required />
            </label>
            <label className="grid gap-1 text-sm">
              Admin role
              <select
                name="role"
                className="min-h-11 rounded-lg border bg-background px-3"
                defaultValue="operator"
              >
                <option value="operator">Operator</option>
                {canManageOwners ? <option value="owner">Owner</option> : null}
              </select>
            </label>
          </AdminOperationForm>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
