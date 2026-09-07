export const progressTabs = [
  { value: "performance", label: "Performance" },
  { value: "goals", label: "Goals" },
  { value: "load", label: "Load" },
  { value: "timeline", label: "Timeline" },
] as const;

export type ProgressTab = (typeof progressTabs)[number]["value"];

export function progressTab(value: string | null): ProgressTab {
  return progressTabs.find((tab) => tab.value === value)?.value ?? "performance";
}

export function progressTabUrl(href: string, tab: ProgressTab) {
  const url = new URL(href);
  url.searchParams.set("tab", tab);
  return `${url.pathname}${url.search}${url.hash}`;
}
