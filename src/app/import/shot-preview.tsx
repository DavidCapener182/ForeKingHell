"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
} from "@/components/premium";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

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
          Showing the first {shots.length} parsed shots across the selected batch. Distance values are stored in yards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTableFrame
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
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Shot</TableHead>
                {isCourseUpload ? <TableHead>Hole</TableHead> : null}
                <TableHead>Club</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Carry yd</TableHead>
                <TableHead className="text-right">Total yd</TableHead>
                <TableHead className="text-right">Ball mph</TableHead>
                <TableHead className="text-right">Launch</TableHead>
                <TableHead className="text-right">Side yd</TableHead>
                {isCourseUpload ? <TableHead className="text-right">Remain</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.length > 0 ? (
                shots.map((shot) => (
                  <TableRow key={`${shot.fileName}-${shot.rowNumber}-${shot.clubKey}`}>
                    <TableCell className="max-w-40 truncate">{shot.fileName}</TableCell>
                    <TableCell>{shot.fileShotNumber}</TableCell>
                    {isCourseUpload ? (
                      <TableCell>
                        {shot.courseShot ? `${shot.courseShot.holeNumber}.${shot.courseShot.holeShotNumber}` : "--"}
                      </TableCell>
                    ) : null}
                    <TableCell className="font-medium">{shot.clubLabel}</TableCell>
                    <TableCell>{shot.clubBrand ?? "--"}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.carryYd)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.totalYd)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.ballSpeedMph)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.launchAngleDeg)}</TableCell>
                    <TableCell className="text-right">{formatMetric(shot.sideCarryYd)}</TableCell>
                    {isCourseUpload ? (
                      <TableCell className="text-right">
                        {formatMetric(shot.courseShot?.distanceRemainingYd ?? null)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isCourseUpload ? 11 : 9} className="h-24 text-center text-muted-foreground">
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
