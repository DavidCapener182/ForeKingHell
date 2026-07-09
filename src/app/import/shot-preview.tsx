"use client";

import { Badge } from "@/components/ui/badge";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataPair, DataTableFrame, MobileDataCard, MobileDataList } from "@/components/premium";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const importShotPreviewColumns: DesktopWorkbenchColumn[] = [
  { id: "file", label: "File", locked: true },
  { id: "shot", label: "Shot" },
  { id: "hole", label: "Hole" },
  { id: "club", label: "Club" },
  { id: "brand", label: "Brand" },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "ball-speed", label: "Ball speed" },
  { id: "launch", label: "Launch" },
  { id: "side", label: "Side" },
  { id: "remain", label: "Remain" },
];

const importShotPreviewSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Import library",
    href: "/import#files",
    detail: "Return to file status, parse results and saved import batches.",
  },
  {
    title: "Shot explorer",
    href: "/shots",
    detail: "Review imported rows once this batch is saved.",
  },
  {
    title: "Provider health",
    href: "/providers",
    detail: "Check sync status before blaming the CSV data.",
  },
];

export type ShotPreviewRow = {
  fileName: string;
  rowNumber: number;
  clubKey: string;
  clubLabel: string;
  clubBrand: string | null;
  fileShotNumber: number;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  sideCarryYd: number | null;
  courseShot: {
    holeNumber: number;
    holeShotNumber: number;
    distanceRemainingYd: number | null;
  } | null;
};

export function ShotPreview({
  shots,
  isCourseUpload,
}: {
  shots: ShotPreviewRow[];
  isCourseUpload: boolean;
}) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Step 3: Review shots</CardTitle>
        <CardDescription>
          Showing the first {shots.length} parsed shots across the selected batch. Distance values
          are stored in yards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DesktopTableWorkbenchControls
          viewKey="import-shot-preview"
          scope="import-shot-preview"
          currentViewLabel="Import shot preview"
          resultLabel={`${shots.length} parsed rows`}
          columns={importShotPreviewColumns}
          suggestedViews={importShotPreviewSuggestedViews}
          exportTableId="import-shot-preview"
          exportFileName="forekinghell-import-shot-preview.csv"
          className="mb-3"
        />
        <DataTableFrame
          stickyFirstColumn
          mobile={
            <MobileDataList>
              {shots.length > 0 ? (
                shots.map((shot) => (
                  <MobileDataCard
                    key={`${shot.fileName}-${shot.rowNumber}-${shot.clubKey}`}
                    title={`${shot.clubLabel} shot ${shot.fileShotNumber}`}
                    subtitle={shot.fileName}
                    action={
                      isCourseUpload ? (
                        <Badge variant="outline">
                          {shot.courseShot
                            ? `${shot.courseShot.holeNumber}.${shot.courseShot.holeShotNumber}`
                            : "No hole"}
                        </Badge>
                      ) : null
                    }
                  >
                    <DataPair label="Brand" value={shot.clubBrand ?? "--"} />
                    <DataPair label="Carry yd" value={formatMetric(shot.carryYd)} />
                    <DataPair label="Total yd" value={formatMetric(shot.totalYd)} />
                    <DataPair label="Ball mph" value={formatMetric(shot.ballSpeedMph)} />
                    <DataPair label="Launch" value={formatMetric(shot.launchAngleDeg)} />
                    <DataPair label="Side yd" value={formatMetric(shot.sideCarryYd)} />
                    {isCourseUpload ? (
                      <DataPair
                        label="Remain"
                        value={formatMetric(shot.courseShot?.distanceRemainingYd ?? null)}
                      />
                    ) : null}
                  </MobileDataCard>
                ))
              ) : (
                <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                  Select one or more CSV files to preview shots.
                </div>
              )}
            </MobileDataList>
          }
          label="Import shot preview table"
        >
          <Table
            data-workbench-scope="import-shot-preview"
            data-workbench-export-table="import-shot-preview"
            aria-describedby="import-shot-preview-summary"
          >
            <TableCaption id="import-shot-preview-summary" className="sr-only">
              Parsed shot preview before import. Distances are stored in yards and course uploads
              include hole mapping when available.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="file"
                  className="sticky left-0 z-20 min-w-40 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  File
                </TableHead>
                <TableHead data-column="shot">Shot</TableHead>
                {isCourseUpload ? <TableHead data-column="hole">Hole</TableHead> : null}
                <TableHead data-column="club">Club</TableHead>
                <TableHead data-column="brand">Brand</TableHead>
                <TableHead data-column="carry" className="text-right">
                  Carry yd
                </TableHead>
                <TableHead data-column="total" className="text-right">
                  Total yd
                </TableHead>
                <TableHead data-column="ball-speed" className="text-right">
                  Ball mph
                </TableHead>
                <TableHead data-column="launch" className="text-right">
                  Launch
                </TableHead>
                <TableHead data-column="side" className="text-right">
                  Side yd
                </TableHead>
                {isCourseUpload ? (
                  <TableHead data-column="remain" className="text-right">
                    Remain
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.length > 0 ? (
                shots.map((shot) => (
                  <TableRow
                    key={`${shot.fileName}-${shot.rowNumber}-${shot.clubKey}`}
                    tabIndex={0}
                    className="focus-aaa outline-none"
                  >
                    <TableCell
                      data-column="file"
                      className="sticky left-0 z-10 max-w-40 truncate bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      {shot.fileName}
                    </TableCell>
                    <TableCell data-column="shot">{shot.fileShotNumber}</TableCell>
                    {isCourseUpload ? (
                      <TableCell data-column="hole">
                        {shot.courseShot
                          ? `${shot.courseShot.holeNumber}.${shot.courseShot.holeShotNumber}`
                          : "--"}
                      </TableCell>
                    ) : null}
                    <TableCell data-column="club" className="font-medium">
                      {shot.clubLabel}
                    </TableCell>
                    <TableCell data-column="brand">{shot.clubBrand ?? "--"}</TableCell>
                    <TableCell data-column="carry" className="text-right">
                      {formatMetric(shot.carryYd)}
                    </TableCell>
                    <TableCell data-column="total" className="text-right">
                      {formatMetric(shot.totalYd)}
                    </TableCell>
                    <TableCell data-column="ball-speed" className="text-right">
                      {formatMetric(shot.ballSpeedMph)}
                    </TableCell>
                    <TableCell data-column="launch" className="text-right">
                      {formatMetric(shot.launchAngleDeg)}
                    </TableCell>
                    <TableCell data-column="side" className="text-right">
                      {formatMetric(shot.sideCarryYd)}
                    </TableCell>
                    {isCourseUpload ? (
                      <TableCell data-column="remain" className="text-right">
                        {formatMetric(shot.courseShot?.distanceRemainingYd ?? null)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={isCourseUpload ? 11 : 9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Select one or more CSV files to preview shots.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}
