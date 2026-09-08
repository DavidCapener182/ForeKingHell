import Link from "next/link";
import { ShieldCheck, Upload } from "lucide-react";
import { ImportPracticeContextBanner } from "@/app/import/import-practice-context-banner";
import { getImportPracticeContext } from "@/lib/import-practice-context";
import { getImportFileHistory } from "@/lib/import-file-history";
import { ImportFileLibrary } from "@/app/import/import-file-library";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { ImportSourceChooser } from "@/app/import/import-source-chooser";
import { ImportForm } from "@/app/import/import-form";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { ImportQualityFeaturePanel } from "@/components/features/feature-panels";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DesktopWorkflowHelpItem } from "@/components/app/desktop-workbench";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type ImportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const importWorkflowHelpItems = [
  {
    title: "Rapsodo first",
    detail:
      "Direct launch-monitor sessions should become the evidence source before scorecard proof, records or challenges.",
  },
  {
    title: "Trust before action",
    detail:
      "Check duplicate status, club mapping and session links before the data feeds bag yardages or coach priorities.",
  },
  {
    title: "Proof stays secondary",
    detail:
      "Only offer records, tournaments and challenge submissions after a saved import has enough context to cite.",
  },
] satisfies DesktopWorkflowHelpItem[];

export default async function ImportWorkbenchPage({ searchParams }: ImportPageProps) {
  const userId = await requireCurrentUserId();
  const params = (await searchParams) ?? {};
  const [library, rapsodoStatus, featureData] = await Promise.all([
    getImportFileHistory(userId, params),
    getRapsodoConnectionStatusAction(),
    getFeatureIdeasData(),
  ]);
  const validPlan = await getImportPracticeContext(userId, params?.practicePlanId);
  const startWithSampleData = params?.source === "sample";
  const connectionStatus = rapsodoStatus.ok
    ? rapsodoStatus.data
    : {
        connected: false,
        expiresAt: null,
        profile: null,
      };
  return (
    <PageShell>
      <UntitledPageHeader
        title="Import"
        description="Choose a source, review the current batch and save your session."
        actions={
          <Button asChild variant="outline">
            <a href="#import-library">Recent imports</a>
          </Button>
        }
      />
      <div className="grid min-w-0 gap-5">
        <ImportPracticeContextBanner plan={validPlan} />
        <ImportSourceChooser
          connected={connectionStatus.connected}
          initialSource={startWithSampleData ? "sample" : "csv"}
        />

        <div id="csv-import" className="min-w-0 scroll-mt-28">
          <ImportForm
            practicePlanId={validPlan?.id ?? null}
            defaultDistanceUnit={library.preferredDistanceUnit}
            startWithSampleData={startWithSampleData}
          />
        </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            Import help and data quality
          </summary>
          <div className="grid gap-3 pt-3">
            {importWorkflowHelpItems.map((item) => (
              <div key={item.title}>
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <FirstRunRapsodoOnboarding
            connected={connectionStatus.connected}
            fileCount={library.activeCount}
            practicePlanId={validPlan?.id ?? null}
          />
          <div id="import-quality" className="mt-4 scroll-mt-28">
            <ImportQualityFeaturePanel data={featureData} />
          </div>
        </details>
        <div id="import-library" className="min-w-0 scroll-mt-28">
          <ImportFileLibrary history={library} params={params} />
        </div>
      </div>
    </PageShell>
  );
}

function FirstRunRapsodoOnboarding({
  connected,
  fileCount,
  practicePlanId,
}: {
  connected: boolean;
  fileCount: number;
  practicePlanId: string | null;
}) {
  if (fileCount > 0) {
    return null;
  }

  return (
    <Alert id="rapsodo-first-run" className="scroll-mt-28" data-import-first-run-alert>
      <ShieldCheck className="size-4" aria-hidden />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Start with measured data
        <Badge variant={connected ? "default" : "outline"}>
          {connected ? "Rapsodo connected" : "Choose a source"}
        </Badge>
      </AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          The workflow above guides preview, club mapping and review. Your first job is only to
          connect R-Cloud or choose a CSV; imported data stays private until you change sharing.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="premium-action rounded-lg">
            <Link
              href={`/rapsodo${practicePlanId ? `?practicePlanId=${encodeURIComponent(practicePlanId)}` : ""}`}
            >
              <Upload className="size-4" />
              {connected ? "Load Rapsodo session" : "Connect Rapsodo"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link
              href={`/import?source=csv${practicePlanId ? `&practicePlanId=${encodeURIComponent(practicePlanId)}` : ""}#csv-import`}
            >
              Choose CSV instead
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
