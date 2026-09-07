import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmSubmitButton } from "../../../src/components/app/confirm-submit-button";
import { DirtyFormBar } from "../../../src/components/app/dirty-form-bar";
import { Input } from "../../../src/components/ui/input";
import { Textarea } from "../../../src/components/ui/textarea";
import { Button } from "../../../src/components/ui/button";
import {
  UntitledSelect,
  UntitledTextField,
  UntitledSubmitButton,
} from "../../../src/components/untitled-ui/form-controls";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../src/components/ui/dialog";

function Fixture() {
  const [draft, setDraft] = useState("Fixture round");
  const [result, setResult] = useState("No submission");
  const [calls, setCalls] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [error, setError] = useState(false);
  const [adapterResult, setAdapterResult] = useState("");
  const [club, setClub] = useState("driver");
  return (
    <main data-app-surface="companion" style={{ padding: 16 }}>
      <h1>Shared form fixture</h1>
      <form
        action={async (data) => {
          setCalls((value) => value + 1);
          await new Promise((resolve) => setTimeout(resolve, 500));
          setResult(`${data.get("intent")}: ${data.get("name")}`);
          setError(true);
        }}
      >
        <label htmlFor="name">Round name</label>
        <Input
          id="name"
          name="name"
          required
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <label htmlFor="notes">Notes</label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue="Keep my notes after a failed save"
          className="min-h-24"
        />
        <ConfirmSubmitButton
          name="intent"
          value="delete"
          confirmTitle="Delete Fixture round?"
          confirmMessage="This removes Fixture round and its saved scores. Your other rounds stay saved."
          confirmActionLabel="Delete round"
          onClick={() => setClicks((value) => value + 1)}
        >
          Delete fixture
        </ConfirmSubmitButton>
        <DirtyFormBar dirty={draft !== "Fixture round"} onReset={() => setDraft("Fixture round")} />
        {error ? (
          <p role="alert">Fixture save failed. Your draft is still here; try again.</p>
        ) : null}
      </form>
      <output aria-label="Submissions">{calls}</output>
      <output aria-label="Confirmed clicks">{clicks}</output>
      <output aria-label="Result">{result}</output>
      <form
        action={async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 250));
          setAdapterResult(
            `${data.get("player")}|${data.get("club")}|${data.get("adapterIntent")}`,
          );
        }}
      >
        <UntitledTextField label="Player" name="player" required defaultValue="Fixture golfer" />
        <UntitledSelect
          label="Club"
          name="club"
          value={club}
          onValueChange={setClub}
          options={[
            { value: "driver", label: "Driver" },
            { value: "7-iron", label: "7 iron" },
            { value: "unavailable", label: "Unavailable club", disabled: true },
          ]}
        />
        <UntitledSubmitButton name="adapterIntent" value="compare">
          Apply comparison
        </UntitledSubmitButton>
      </form>
      <output aria-label="Adapter result">{adapterResult}</output>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open long form</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Review the full round details</DialogTitle>
          <DialogDescription>
            Every field and action remains reachable when space is limited.
          </DialogDescription>
          {Array.from({ length: 18 }, (_, index) => (
            <label key={index}>
              Hole {index + 1}
              <Input name={`hole-${index}`} defaultValue="4" />
            </label>
          ))}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
