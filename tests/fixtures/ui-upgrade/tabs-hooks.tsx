import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
function Fixture() {
  const [selected, setSelected] = useState("one");
  const [disabled, setDisabled] = useState(false);
  return (
    <main>
      <label>
        <input
          type="checkbox"
          checked={disabled}
          onChange={(event) => setDisabled(event.target.checked)}
        />
        Disable tabs
      </label>
      <UntitledTabs
        label="Evidence sections"
        keepMounted
        disabled={disabled}
        selectedKey={selected}
        onSelectionChange={setSelected}
        items={[
          {
            id: "one",
            label: "Saved practice evidence",
            content: (
              <label>
                Practice draft
                <input aria-label="Practice draft" />
              </label>
            ),
          },
          { id: "two", label: "Club comparison evidence", content: <p>Comparison content</p> },
          { id: "three", label: "Historical source records", content: <p>Source content</p> },
          { id: "four", label: "Detailed review and corrections", content: <p>Review content</p> },
        ]}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
