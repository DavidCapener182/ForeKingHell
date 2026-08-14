"use client";

import { useState } from "react";
import {
  Activity,
  CalendarDays,
  CreditCard,
  History,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserRound,
  Zap,
} from "lucide-react";

import {
  deactivateAdminAccessAction,
  grantAdminAccessAction,
  grantLifetimeFullAction,
} from "@/app/admin/actions";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";

type AdminUserRowData = {
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
  auditEvents: Array<{
    id: string;
    actionLabel: string;
    createdLabel: string;
  }>;
};

export function AdminUserActions({
  user,
  canManageOwners,
  isCurrentUser,
}: {
  user: AdminUserRowData;
  canManageOwners: boolean;
  isCurrentUser: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const canManageRole = !isCurrentUser && (canManageOwners || !user.adminRole);
  const canDeactivate = canManageOwners && Boolean(user.adminRole) && !isCurrentUser;

  function openDetails() {
    setDetailsOpen(true);
  }

  return (
    <>
      <TableRow
        tabIndex={0}
        data-state={detailsOpen ? "selected" : undefined}
        className="group cursor-pointer border-b outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button, a, input, [role=menuitem], [data-no-row-select]")) return;
          openDetails();
        }}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            openDetails();
          }
        }}
      >
        <TableCell
          data-column="user"
          className="sticky left-0 z-[5] bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)] transition-colors group-hover:bg-muted group-data-[state=selected]:bg-muted"
        >
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={openDetails}
            aria-label={`Open account details for ${user.displayName}`}
          >
            <Avatar>
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{user.displayName}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {user.username ? `@${user.username}` : "No username"}
              </span>
            </span>
          </button>
        </TableCell>
        <TableCell data-column="email" className="text-muted-foreground">
          {user.email ?? "No email"}
        </TableCell>
        <TableCell data-column="plan">
          <PlanPill plan={user.activePlan} />
        </TableCell>
        <TableCell data-column="activity">
          <p className="font-medium text-foreground">{user.sessionCount} sessions</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{user.feedCount} feed cards</p>
        </TableCell>
        <TableCell data-column="admin">
          {user.adminRole ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{titleCase(user.adminRole)}</Badge>
              <Badge variant="outline">{titleCase(user.adminStatus ?? "active")}</Badge>
            </div>
          ) : user.adminStatus ? (
            <Badge variant="outline">{titleCase(user.adminStatus)}</Badge>
          ) : (
            <span className="text-muted-foreground">No admin role</span>
          )}
        </TableCell>
        <TableCell data-column="created" className="text-xs text-muted-foreground">
          {user.createdLabel}
        </TableCell>
        <TableCell data-column="action" className="text-right" data-no-row-select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.displayName}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Account actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={openDetails}>
                <UserRound className="size-4" /> View account
              </DropdownMenuItem>
              {canManageOwners && user.activePlan !== "full" ? (
                <DropdownMenuItem onSelect={openDetails}>
                  <Zap className="size-4" /> Manage plan
                </DropdownMenuItem>
              ) : null}
              {canManageRole ? (
                <DropdownMenuItem onSelect={openDetails}>
                  <UserCog className="size-4" /> Manage admin role
                </DropdownMenuItem>
              ) : null}
              {canDeactivate ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeactivateOpen(true)}>
                    <ShieldOff className="size-4" /> Deactivate admin
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                  {initials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">{user.displayName}</SheetTitle>
                <SheetDescription className="truncate">
                  {user.email ?? "No email address"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="grid gap-6 px-5 py-5">
            <SheetSection title="Identity" icon={UserRound}>
              <dl className="grid gap-2 sm:grid-cols-2">
                <Detail label="Email" value={user.email ?? "No email"} />
                <Detail label="Username" value={user.username ? `@${user.username}` : "Not set"} />
                <Detail label="User ID" value={user.id} mono />
                <Detail label="Created" value={user.createdLabel} />
              </dl>
            </SheetSection>

            <Separator />

            <SheetSection title="Plan" icon={CreditCard}>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/35 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Current access plan</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Lifetime full is a permanent entitlement.
                  </p>
                </div>
                <PlanPill plan={user.activePlan} />
              </div>
            </SheetSection>

            <SheetSection title="Roles" icon={ShieldCheck}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={user.adminRole ? "secondary" : "outline"}>
                  {user.adminRole ? titleCase(user.adminRole) : "No admin role"}
                </Badge>
                {user.adminStatus ? (
                  <Badge variant="outline">{titleCase(user.adminStatus)}</Badge>
                ) : null}
                {isCurrentUser ? <Badge variant="outline">Your account</Badge> : null}
              </div>
            </SheetSection>

            <Separator />

            <SheetSection title="Recent activity" icon={Activity}>
              <div className="grid grid-cols-2 gap-2">
                <Detail
                  label="Recorded sessions"
                  value={user.sessionCount.toLocaleString("en-GB")}
                />
                <Detail label="Feed cards" value={user.feedCount.toLocaleString("en-GB")} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                These are observed account totals in the current admin snapshot; this view does not
                infer last-seen status.
              </p>
            </SheetSection>

            <SheetSection title="Account controls" icon={UserCog}>
              <div className="grid gap-3 rounded-lg border border-border/80 p-3">
                {canManageOwners && user.activePlan !== "full" && user.email ? (
                  <form
                    action={grantLifetimeFullAction}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <input type="hidden" name="returnTo" value="/admin/users" />
                    <input type="hidden" name="email" value={user.email} />
                    <div>
                      <p className="text-sm font-medium">Grant lifetime full</p>
                      <p className="text-xs text-muted-foreground">
                        Permanent plan and entitlement change.
                      </p>
                    </div>
                    <AdminConfirmSubmitButton
                      type="submit"
                      size="sm"
                      confirmTitle="Grant lifetime full access"
                      confirmMessage={`Grant lifetime full access to ${user.email}? This creates a permanent full-plan entitlement and writes admin billing state.`}
                      confirmActionLabel="Grant full access"
                    >
                      <Zap className="size-4" /> Grant full
                    </AdminConfirmSubmitButton>
                  </form>
                ) : null}

                {canManageRole && user.email ? (
                  <form action={grantAdminAccessAction} className="grid gap-2">
                    <input type="hidden" name="returnTo" value="/admin/users" />
                    <input type="hidden" name="email" value={user.email} />
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`role-${user.id}`}>Admin role</Label>
                        <Select name="role" defaultValue={user.adminRole ?? "operator"}>
                          <SelectTrigger id={`role-${user.id}`} className="w-full bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operator">Operator</SelectItem>
                            {canManageOwners ? <SelectItem value="owner">Owner</SelectItem> : null}
                          </SelectContent>
                        </Select>
                      </div>
                      <AdminConfirmSubmitButton
                        type="submit"
                        variant="outline"
                        size="sm"
                        confirmTitle="Grant admin access"
                        confirmMessage={`Apply the selected admin role to ${user.email}? Owner and operator roles can change platform operations.`}
                        confirmActionLabel="Apply admin role"
                      >
                        <ShieldCheck className="size-4" /> Apply role
                      </AdminConfirmSubmitButton>
                    </div>
                  </form>
                ) : null}

                {canDeactivate ? (
                  <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Deactivate admin access</p>
                      <p className="text-xs text-muted-foreground">
                        Keeps the player account and golf data.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeactivateOpen(true)}
                    >
                      <ShieldOff className="size-4" /> Deactivate
                    </Button>
                  </div>
                ) : null}

                {user.activePlan === "full" && !canManageRole && !canDeactivate ? (
                  <p className="text-sm text-muted-foreground">
                    No account controls are available for your current role.
                  </p>
                ) : null}
              </div>
            </SheetSection>

            <Separator />

            <SheetSection title="Audit context" icon={History}>
              {user.auditEvents.length > 0 ? (
                <ol className="grid gap-2">
                  {user.auditEvents.map((event) => (
                    <li key={event.id} className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-sm font-medium text-foreground">{event.actionLabel}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" /> {event.createdLabel}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No account-specific admin changes were found in the recent audit window.
                </p>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Access changes on this Sheet write admin audit entries. Use the full audit register
                for wider operational history.
              </p>
            </SheetSection>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {user.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their active admin role and writes an audit entry. Their player account
              and golf data are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep access</AlertDialogCancel>
            <form action={deactivateAdminAccessAction}>
              <input type="hidden" name="userId" value={user.id} />
              <AlertDialogAction type="submit" variant="destructive">
                Deactivate admin
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AdminAccessDialog({ canManageOwners }: { canManageOwners: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserCog className="size-4" /> Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant account access</DialogTitle>
          <DialogDescription>
            Apply a plan entitlement or admin role by verified account email.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {canManageOwners ? (
            <form action={grantLifetimeFullAction} className="grid gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Lifetime full plan</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Creates permanent full-plan entitlements.
                </p>
              </div>
              <input type="hidden" name="returnTo" value="/admin/users" />
              <div className="grid gap-1.5">
                <Label htmlFor="lifetime-email">Account email</Label>
                <Input
                  id="lifetime-email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <AdminConfirmSubmitButton
                type="submit"
                confirmTitle="Grant lifetime full access"
                confirmMessage="Grant lifetime full access to this email? This creates a permanent full-plan entitlement and writes admin billing state."
                confirmActionLabel="Grant full access"
              >
                <Zap className="size-4" /> Grant lifetime full
              </AdminConfirmSubmitButton>
            </form>
          ) : null}

          <form action={grantAdminAccessAction} className="grid gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Admin role</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Operator handles routine work; owner has full admin access.
              </p>
            </div>
            <input type="hidden" name="returnTo" value="/admin/users" />
            <div className="grid gap-1.5">
              <Label htmlFor="admin-email">Account email</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-role">Admin role</Label>
              <Select name="role" defaultValue="operator">
                <SelectTrigger id="admin-role" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operator</SelectItem>
                  {canManageOwners ? <SelectItem value="owner">Owner</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <AdminConfirmSubmitButton
              type="submit"
              variant="outline"
              confirmTitle="Grant admin access"
              confirmMessage="Grant admin access to this email? Owner and operator roles can change platform operations."
              confirmActionLabel="Grant admin"
            >
              <ShieldCheck className="size-4" /> Grant admin role
            </AdminConfirmSubmitButton>
          </form>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function SheetSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/35 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  return (
    <Badge variant={plan === "full" ? "default" : plan === "free" ? "outline" : "secondary"}>
      {titleCase(plan)}
    </Badge>
  );
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}
