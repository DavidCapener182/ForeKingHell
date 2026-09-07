import type { SharedRoundData } from "./page";
import { SharedRoundWorkbench } from "./shared-round-workbench";
export function SharedRoundCompanion({ round }: { round: SharedRoundData }) {
  return <SharedRoundWorkbench round={round} />;
}
