import { ScanSearch, Target, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

import styles from "./marketing.module.css";

const steps = [
  {
    icon: Upload,
    title: "Bring in the measured session",
    detail:
      "Upload a supported launch-monitor file or use an available provider connection. Original rows stay reviewable.",
  },
  {
    icon: ScanSearch,
    title: "Review what the evidence can support",
    detail:
      "Check club mapping, sample size and confidence before a result becomes a trusted golf number.",
  },
  {
    icon: Target,
    title: "Take one clear practice job",
    detail:
      "Turn the session verdict into a focused practice block, then compare the next measured session with it.",
  },
] as const;

export function ImportPracticeGuide() {
  return (
    <section className={styles.betaSection} aria-labelledby="import-practice-guide-title">
      <div>
        <p className={styles.eyebrow}>How it works</p>
        <h2 id="import-practice-guide-title">From measured shots to the next practice job.</h2>
        <p>
          LM World Tour keeps the evidence trail visible, separates measured facts from coaching
          judgement and gives the next session a purpose.
        </p>
      </div>

      <Card className={styles.betaPanel}>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Import → review → practise
          </Badge>
          <CardTitle>Three evidence-led steps</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-0">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div key={step.title}>
                <Item className="px-0 py-4" size="sm">
                  <ItemMedia className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Step {index + 1}</Badge>
                      <ItemTitle>{step.title}</ItemTitle>
                    </div>
                    <ItemDescription>{step.detail}</ItemDescription>
                  </ItemContent>
                </Item>
                {index < steps.length - 1 ? <Separator /> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
