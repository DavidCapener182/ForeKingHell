import type { ShotMasterDetailRow } from "@/app/shots/shots-master-detail-table";

export type TodayChartShot = {
  id: string;
  clubType: string;
  clubLabel: string;
  shotNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  launchAngleDeg: number | null;
  ballSpeedMph: number | null;
  detail?: ShotMasterDetailRow | null;
};
