const requiredProductionSecrets = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SCORECARD_PROOF_SECRET",
  "CRON_SECRET",
] as const;

export function productionEnvironmentIssues(env: NodeJS.ProcessEnv) {
  const issues: string[] = [];

  for (const name of requiredProductionSecrets) {
    if (!env[name]?.trim()) issues.push(`${name} is required`);
  }

  for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
    const value = env[name]?.trim();
    if (value && !isHttpsUrl(value)) issues.push(`${name} must be an HTTPS URL`);
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl && !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    issues.push("DATABASE_URL must be a PostgreSQL URL");
  }

  for (const name of ["SCORECARD_PROOF_SECRET", "CRON_SECRET"] as const) {
    const value = env[name]?.trim();
    if (value && value.length < 32) issues.push(`${name} must contain at least 32 characters`);
  }

  const courseTwinWorkerVariables = [
    "COURSE_TWIN_BUILDER_URL",
    "COURSE_TWIN_CALLBACK_BASE_URL",
    "COURSE_TWIN_WORKER_SECRET",
  ] as const;
  if (courseTwinWorkerVariables.some((name) => env[name]?.trim())) {
    for (const name of courseTwinWorkerVariables) {
      if (!env[name]?.trim())
        issues.push(`${name} is required when Course Twin builder dispatch is configured`);
    }
    for (const name of ["COURSE_TWIN_BUILDER_URL", "COURSE_TWIN_CALLBACK_BASE_URL"] as const) {
      const value = env[name]?.trim();
      if (value && !isHttpsUrl(value)) issues.push(`${name} must be an HTTPS URL`);
    }
    const secret = env.COURSE_TWIN_WORKER_SECRET?.trim();
    if (secret && secret.length < 32)
      issues.push("COURSE_TWIN_WORKER_SECRET must contain at least 32 characters");
  }

  return issues;
}

export function assertProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production" || env.FKH_SKIP_ENV_VALIDATION === "1") return;
  const issues = productionEnvironmentIssues(env);
  if (issues.length > 0) {
    throw new Error(`Invalid production environment:\n- ${issues.join("\n- ")}`);
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
