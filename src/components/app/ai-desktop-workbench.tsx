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
  defaultTab = "diagnosis",
  className,
}: {
  diagnosis: ReactNode;
  evidence: ReactNode;
  ask: ReactNode;
  context: ReactNode;
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
        ["diagnosis", diagnosis],
        ["evidence", evidence],
        ["ask", ask],
      ].map(([value, content]) => (
        <TabsContent key={value as string} value={value as string}>
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-[42rem] overflow-hidden rounded-xl border bg-card"
          >
            <ResizablePanel defaultSize={72} minSize={52}>
              <ScrollArea className="h-[min(72dvh,58rem)]">
                <div className="grid min-w-0 gap-5 p-4 lg:p-5">{content}</div>
              </ScrollArea>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={28} minSize={20} maxSize={42}>
              <ScrollArea className="h-[min(72dvh,58rem)]">
                <aside className="min-w-0 p-4" aria-label="Evidence and context">
                  {context}
                </aside>
              </ScrollArea>
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>
      ))}
    </Tabs>
  );
}
