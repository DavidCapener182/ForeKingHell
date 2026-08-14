"use client";

import type { ReactNode } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function AiDesktopWorkbench({
  diagnosis,
  evidence,
  ask,
  context,
  diagnosisContext,
  evidenceContext,
  askContext,
  askStandalone = false,
  defaultTab = "diagnosis",
  className,
}: {
  diagnosis: ReactNode;
  evidence: ReactNode;
  ask: ReactNode;
  context: ReactNode;
  diagnosisContext?: ReactNode;
  evidenceContext?: ReactNode;
  askContext?: ReactNode;
  askStandalone?: boolean;
  defaultTab?: "diagnosis" | "evidence" | "ask";
  className?: string;
}) {
  return (
    <Tabs
      defaultValue={defaultTab}
      className={cn("min-w-0 gap-4", className)}
      data-ai-desktop-workbench
    >
      <TabsList variant="line" aria-label="AI workbench modes">
        <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
        <TabsTrigger value="ask">Ask</TabsTrigger>
      </TabsList>
      {[
        ["diagnosis", diagnosis, diagnosisContext ?? context],
        ["evidence", evidence, evidenceContext ?? context],
        ["ask", ask, askContext ?? context],
      ].map(([value, content, panelContext]) => {
        const isStandaloneAsk = value === "ask" && askStandalone;

        return (
          <TabsContent key={value as string} value={value as string}>
            {isStandaloneAsk ? (
              <div className="min-w-0">{content}</div>
            ) : (
              <ResizablePanelGroup
                orientation="horizontal"
                className="min-h-[42rem] overflow-hidden rounded-xl border bg-card"
              >
                <ResizablePanel defaultSize="72" minSize="58" maxSize="80">
                  <ScrollArea className="h-[min(72dvh,58rem)]">
                    <div className="grid min-w-0 gap-5 p-4 lg:p-5">{content}</div>
                  </ScrollArea>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="28" minSize="20" maxSize="42">
                  <ScrollArea className="h-[min(72dvh,58rem)]">
                    <aside className="min-w-0 p-4" aria-label="Evidence and context">
                      {panelContext}
                    </aside>
                  </ScrollArea>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
