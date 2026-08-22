import Link from "next/link";
import { ArrowRight, CircleCheck, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

import { marketingJoinBetaHref } from "@/lib/marketing-links";
import styles from "./marketing.module.css";

export function BetaAccessSection() {
  return (
    <section className={styles.betaSection} aria-labelledby="beta-title">
      <div>
        <p className={styles.eyebrow}>Beta access</p>
        <h2 id="beta-title">Bring your own evidence. Start with the clearest next action.</h2>
        <p>
          Try the post-session loop: import or connect available launch-monitor data, map clubs,
          review confidence, build a practice session and plan for the course.
        </p>
      </div>
      <Card className={styles.betaPanel}>
        <CardHeader>
          <CardTitle>Provider and beta readiness</CardTitle>
          <Badge variant="secondary" className="w-fit">
            Evidence first
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          <ProviderItem title="Rapsodo CSV" detail="Import is available" status="Available" />
          <ProviderItem
            title="Rapsodo cloud"
            detail="Depends on current environment configuration"
            status="Configured only"
          />
          <ProviderItem
            title="Square / TrackMan"
            detail="Square is beta; TrackMan remains coming soon unless enabled"
            status="Limited"
          />
          <Item variant="muted" size="sm">
            <CircleCheck className="size-4 shrink-0 text-primary" />
            <ItemContent>
              <ItemTitle>Plan and configuration</ItemTitle>
              <ItemDescription>Feature availability can depend on both.</ItemDescription>
            </ItemContent>
          </Item>
        </CardContent>
        <CardFooter className={styles.betaActions}>
          <Button asChild>
            <Link href={marketingJoinBetaHref} className="t-learn">
              Join the beta <ArrowRight className="t-learn-chevron size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">
              Sign in <LogIn className="size-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}

function ProviderItem({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <Item variant="outline" size="sm">
      <CircleCheck className="size-4 shrink-0 text-primary" />
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
      <Badge variant="outline">{status}</Badge>
    </Item>
  );
}
