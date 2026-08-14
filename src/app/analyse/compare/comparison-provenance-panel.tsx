"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProvenanceMetric = {
  key: string;
  label: string;
  source: string;
  method: string;
  confidenceLabel: string;
};

export function ComparisonProvenancePanel({ metrics }: { metrics: ProvenanceMetric[] }) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="How this comparison was calculated"
      description="Source, method and confidence for every result shown in the table."
      trigger={
        <Button type="button" variant="outline" size="sm">
          <Info className="size-4" aria-hidden="true" />
          Evidence & method
        </Button>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Source and method</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.key}>
                <TableCell className="font-medium">{metric.label}</TableCell>
                <TableCell className="max-w-md text-muted-foreground">
                  <span className="block">{metric.source}</span>
                  <span className="mt-1 block">{metric.method}</span>
                </TableCell>
                <TableCell>{metric.confidenceLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResponsiveDetailPanel>
  );
}
