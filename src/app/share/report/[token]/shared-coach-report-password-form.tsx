import { unlockCoachReportAction } from "@/app/share/report/[token]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SharedCoachReportPasswordForm({
  token,
  invalid,
  headingLevel,
}: {
  token: string;
  invalid: boolean;
  headingLevel: "h1" | "h2";
}) {
  const action = unlockCoachReportAction.bind(null, token);
  const Heading = headingLevel;

  return (
    <>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        Protected performance report
      </p>
      <Heading className="mt-2 font-display text-3xl font-semibold">
        Enter the report password
      </Heading>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The golfer protected this frozen report. The share token alone does not unlock it.
      </p>
      <form action={action} className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            autoFocus
            className="min-h-11"
            required
          />
        </label>
        {invalid ? (
          <Alert variant="destructive">
            <AlertDescription className="text-sm font-semibold text-destructive">
              That password did not match.
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="min-h-11">
          Open report
        </Button>
      </form>
    </>
  );
}
