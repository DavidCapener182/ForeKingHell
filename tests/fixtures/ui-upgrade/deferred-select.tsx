import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UntitledSelect } from "../../../src/components/untitled-ui/form-controls";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../../../src/components/ui/dialog";
const options = [
  { value: "driver", label: "Driver" },
  { value: "iron", label: "7 iron" },
  { value: "blocked", label: "Unavailable", disabled: true },
];
function Fixture() {
  const [value, setValue] = useState("driver");
  const [result, setResult] = useState("");
  const required = location.search.includes("required");
  return (
    <main style={{ padding: 24 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResult(String(new FormData(event.currentTarget).get("club")));
        }}
      >
        <UntitledSelect
          label="Club"
          name="club"
          value={required ? undefined : value}
          onValueChange={required ? undefined : setValue}
          required={required}
          options={options}
          description="Choose your club"
        />
        <button type="submit">Submit</button>
        <button type="button">Other focus</button>
        <output aria-label="Result">{result}</output>
      </form>
      <Dialog>
        <DialogTrigger>Open modal</DialogTrigger>
        <DialogContent>
          <DialogTitle>Club editor</DialogTitle>
          <DialogDescription>Select inside the dialog</DialogDescription>
          <UntitledSelect
            label="Modal club"
            name="modalClub"
            defaultValue="driver"
            options={options}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
