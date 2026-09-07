"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DataQualityIssue } from "@/lib/analysis-workspace";
type Result = { ok: true } | { ok: false; error: string };
export function WorkspaceFormSheet({
  title,
  actionLabel,
  action,
  disabled,
  children,
}: {
  title: string;
  actionLabel: string;
  action: (data: FormData) => Promise<Result>;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const router = useRouter();
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <SheetTrigger asChild>
        <Button disabled={disabled}>{title}</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Keep the selected evidence scope. Errors retain your fields for correction.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy.current) return;
            const data = new FormData(event.currentTarget);
            busy.current = true;
            setPending(true);
            setError(null);
            try {
              const result = await action(data);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            } catch {
              setError(
                "We could not confirm saving. Your fields remain available; retry when ready.",
              );
            } finally {
              busy.current = false;
              setPending(false);
            }
          }}
        >
          <fieldset
            disabled={pending || disabled}
            className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4"
          >
            {children}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </fieldset>
          <div className="flex flex-wrap gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={pending || disabled}>
              {pending ? "Saving…" : actionLabel}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </SheetClose>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
export function WorkspaceDelete({
  name,
  id,
  field,
  action,
}: {
  name: string;
  id: string;
  field: string;
  action: (data: FormData) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Delete {name}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent overlayClassName="z-[90]" className="z-[100]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes only this saved item. Source sessions and shots stay unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep saved item</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              setError(null);
              const data = new FormData();
              data.set(field, id);
              try {
                const result = await action(data);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              } catch {
                setError("Deletion was not confirmed. Retry when ready.");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Deleting…" : "Confirm deletion"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function WorkspaceDetails({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-auto min-h-11 whitespace-normal text-left">
          Inspect {title}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 min-h-11">
            Close details
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
export function QualityIssues({ issues }: { issues: DataQualityIssue[] }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const visible = issues.filter(
    (issue) =>
      (severity === "all" || issue.severity === severity) &&
      `${issue.title} ${issue.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Search issues
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Severity
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
      <p className="text-sm" role="status">
        {visible.length} issue groups
      </p>
      <div className="hidden overflow-x-auto rounded-xl border bg-card lg:block">
        <table className="w-full text-left text-sm">
          <caption className="p-3 text-left">
            Current issue groups; repairs remain scoped to their source records.
          </caption>
          <thead>
            <tr>
              <th className="p-3">Issue</th>
              <th className="p-3">Priority</th>
              <th className="p-3 text-right">Affected records</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((issue) => (
              <tr key={issue.key} className="border-t">
                <th scope="row" className="p-3 font-medium">
                  {issue.title}
                </th>
                <td className="p-3 capitalize">{issue.severity}</td>
                <td className="p-3 text-right tabular-nums">{issue.count}</td>
                <td className="p-3">
                  <WorkspaceDetails
                    title={issue.title}
                    description={`${issue.count} affected records · ${issue.severity} priority`}
                  >
                    <p className="text-sm leading-6">{issue.detail}</p>
                    <Button asChild className="mt-4">
                      <Link href={issue.href}>{issue.action}</Link>
                    </Button>
                  </WorkspaceDetails>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y rounded-xl border bg-card lg:hidden">
        {visible.map((issue) => (
          <li key={issue.key} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h3 className="font-semibold">
                {issue.title} · {issue.count}
              </h3>
              <p className="mt-1 text-sm capitalize">{issue.severity} priority</p>
            </div>
            <WorkspaceDetails
              title={issue.title}
              description={`${issue.count} affected records · ${issue.severity} priority`}
            >
              <p className="text-sm leading-6">{issue.detail}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Inspect and repair the affected source records. Other warnings remain independently
                tracked.
              </p>
              <Button asChild className="mt-4">
                <Link href={issue.href}>{issue.action}</Link>
              </Button>
            </WorkspaceDetails>
          </li>
        ))}
        {!visible.length && (
          <li className="p-4 text-sm">
            {issues.length
              ? "No issues match these filters."
              : "No issues found in the inspected evidence."}
          </li>
        )}
      </ul>
    </div>
  );
}
export function WorkspaceChoice({
  items,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  if (!items.length) return null;
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Equipment change
        <select
          className="min-h-11 w-full rounded-lg border bg-background px-3"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {items.find((item) => item.id === selected)?.content}
    </div>
  );
}
