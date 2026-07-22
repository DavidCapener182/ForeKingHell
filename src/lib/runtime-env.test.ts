import { describe, expect, it } from "vitest";

import { assertProductionEnvironment, productionEnvironmentIssues } from "@/lib/runtime-env";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:password@db.example.test/app",
  NEXT_PUBLIC_SITE_URL: "https://golf.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  SCORECARD_PROOF_SECRET: "s".repeat(32),
  CRON_SECRET: "c".repeat(32),
} satisfies NodeJS.ProcessEnv;

describe("production environment validation", () => {
  it("accepts a complete production configuration", () => {
    expect(productionEnvironmentIssues(valid)).toEqual([]);
    expect(() => assertProductionEnvironment(valid)).not.toThrow();
  });

  it("reports missing, weak and malformed values together", () => {
    expect(
      productionEnvironmentIssues({
        NODE_ENV: "production",
        DATABASE_URL: "sqlite:test.db",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        SCORECARD_PROOF_SECRET: "short",
        CRON_SECRET: "short",
      }),
    ).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required",
        "SUPABASE_SERVICE_ROLE_KEY is required",
        "DATABASE_URL must be a PostgreSQL URL",
        "NEXT_PUBLIC_SITE_URL must be an HTTPS URL",
        "SCORECARD_PROOF_SECRET must contain at least 32 characters",
      ]),
    );
  });

  it("requires a complete secure Course Twin worker configuration when enabled", () => {
    expect(
      productionEnvironmentIssues({
        ...valid,
        COURSE_TWIN_BUILDER_URL: "http://builder.internal",
        COURSE_TWIN_WORKER_SECRET: "short",
      }),
    ).toEqual(
      expect.arrayContaining([
        "COURSE_TWIN_CALLBACK_BASE_URL is required when Course Twin builder dispatch is configured",
        "COURSE_TWIN_BUILDER_URL must be an HTTPS URL",
        "COURSE_TWIN_WORKER_SECRET must contain at least 32 characters",
      ]),
    );
  });
});
