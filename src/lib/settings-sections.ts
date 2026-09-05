export type SettingsSection =
  | "general"
  | "appearance"
  | "privacy"
  | "sharing"
  | "notifications"
  | "data"
  | "offline"
  | "billing"
  | "danger";

export const settingsSections: Array<{
  value: SettingsSection;
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "General",
    description: "Account details, measurement units and dashboard shortcuts.",
  },
  {
    value: "appearance",
    label: "Appearance",
    description: "Theme and information density across your account.",
  },
  {
    value: "privacy",
    label: "Privacy",
    description: "Choose what other golfers and invited coaches can see.",
  },
  {
    value: "sharing",
    label: "Sharing",
    description: "Manage collaborators, invitations and shared accounts.",
  },
  {
    value: "notifications",
    label: "Notifications",
    description: "Control which updates reach you and how they are delivered.",
  },
  {
    value: "data",
    label: "Connected Data",
    description: "Review launch-monitor connections, imports and data health.",
  },
  {
    value: "offline",
    label: "Offline",
    description: "Control what this device keeps for retry when a connection drops.",
  },
  {
    value: "billing",
    label: "Billing",
    description: "Review your plan, subscription and invoices.",
  },
  {
    value: "danger",
    label: "Danger Zone",
    description: "Reset golf history or permanently delete this account.",
  },
];

export function isSettingsSection(value: string | null | undefined): value is SettingsSection {
  return settingsSections.some((section) => section.value === value);
}
