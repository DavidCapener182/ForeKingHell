import { createRoot } from "react-dom/client";
import { SettingsWorkspace } from "@/app/settings/settings-workspace";
import { SettingsDirtyForm } from "@/app/settings/settings-dirty-form";
import { SettingsInvitationDialog } from "@/app/settings/settings-access-actions";
import { updateUserSettingsFormAction } from "@/app/settings/actions";
createRoot(document.getElementById("root")!).render(
  <SettingsWorkspace
    initialSection="general"
    items={[
      {
        id: "general",
        label: "General",
        description: "Identity and units",
        content: (
          <SettingsDirtyForm action={updateUserSettingsFormAction}>
              <input type="hidden" name="settingsSection" value="general" />
            <label>
              Display name
              <input name="name" defaultValue="Saved name" />
            </label>
            <label>
              Preferred units
              <select name="preferredUnits" defaultValue="yards">
                <option value="yards">Yards</option>
                <option value="metres">Metres</option>
              </select>
            </label>
          </SettingsDirtyForm>
        ),
      },
      {
        id: "sharing",
        label: "Sharing",
        description: "Named account access",
        content: <SettingsInvitationDialog />,
      },
    ]}
  />,
);
