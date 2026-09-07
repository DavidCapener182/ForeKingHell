"use client";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraftForm } from "@/components/untitled-ui/draft-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
const subscribeReady = () => () => {};
function useWorkspaceReady() {
  return useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
}
export function AssignedPlayerPicker({
  players,
  selectedId,
}: {
  players: Array<{ id: string; name: string; detail: string }>;
  selectedId: string;
}) {
  const ready = useWorkspaceReady();
  const [search, setSearch] = useState("");
  const selected = players.find((player) => player.id === selectedId);
  const matches = players.filter((player) =>
    `${player.name} ${player.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="grid gap-3">
      <p className="break-words font-semibold">
        Selected player: {selected?.name ?? "Unavailable"}
      </p>
      <p className="text-sm">Coach access · assigned players only</p>
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" disabled={!ready}>
            Search assigned players
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Assigned players</SheetTitle>
            <SheetDescription>
              Selecting a player changes this evidence view within your coach permissions.
            </SheetDescription>
          </SheetHeader>
          <label className="grid gap-2 px-4 text-sm">
            Search players
            <Input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="grid min-h-0 gap-2 overflow-y-auto p-4">
            {matches.map((player) => (
              <a
                key={player.id}
                href={`/coach/workspace?playerId=${player.id}`}
                aria-current={player.id === selectedId ? "page" : undefined}
                className="grid min-h-14 gap-1 rounded-lg border p-3"
              >
                <strong>{player.name}</strong>
                <span className="text-sm text-muted-foreground">{player.detail}</span>
              </a>
            ))}
            {!matches.length ? <p>No assigned players match this search.</p> : null}
          </div>
          <SheetClose asChild>
            <Button variant="outline" className="m-4 mt-auto min-h-11">
              Keep selected player
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function WorkspaceDetail({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const ready = useWorkspaceReady();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          disabled={!ready}
          variant="outline"
          className="h-auto min-h-11 whitespace-normal text-left"
        >
          Inspect {title}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 gap-4 overflow-y-auto px-4">{children}</div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 mt-auto min-h-11">
            Close details
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
export function WorkspaceForm({
  action,
  children,
  label,
  interaction = false,
}: {
  action: (data: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  children: ReactNode;
  label: string;
  interaction?: boolean;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [saved, setSaved] = useState(false);
  const [privateNote, setPrivateNote] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (saved)
    return (
      <div role="status" className="grid gap-2">
        <p>Saved for this selected player.</p>
        {interaction ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSaved(false);
              setGeneration((value) => value + 1);
            }}
          >
            Add another interaction
          </Button>
        ) : null}
      </div>
    );
  return (
    <div
      onChangeCapture={(event) => {
        setDirty(true);
        const form = (event.target as HTMLElement).closest("form");
        if (form) setPrivateNote(new FormData(form).get("interactionType") === "private_note");
      }}
    >
      <DraftForm
        key={generation}
        action={action}
        submitLabel={label}
        gridClassName="grid gap-3"
        onSuccess={() => {
          setDirty(false);
          setSaved(true);
          router.refresh();
        }}
        onCancel={
          interaction
            ? () => {
                setDirty(false);
                setGeneration((value) => value + 1);
              }
            : undefined
        }
      >
        {children}
        {interaction ? (
          <p className="rounded-lg border p-3 text-sm">
            {privateNote
              ? "Private coach note: visible to the coach only."
              : "This assignment, feedback or evidence request is visible to the selected player."}{" "}
            Save or cancel your draft before changing players.
          </p>
        ) : null}
      </DraftForm>
    </div>
  );
}
