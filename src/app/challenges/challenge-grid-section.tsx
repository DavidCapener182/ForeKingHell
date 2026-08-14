import type { ReactNode } from "react";

export function ChallengeGridSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 content-start gap-3" data-challenge-grid-section>
      <header className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
