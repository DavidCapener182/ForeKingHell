CREATE TABLE public.fkh_billing_trials (
 user_id uuid PRIMARY KEY REFERENCES public.fkh_users(id) ON DELETE CASCADE,
 pro_trial_eligible_after_import_at timestamptz,
 pro_trial_started_at timestamptz,
 pro_trial_ends_at timestamptz,
 pro_trial_consumed_at timestamptz,
 stripe_subscription_id varchar(120),
 checkout_request_id uuid,
 checkout_requested_at timestamptz,
 checkout_session_id varchar(120),
 checkout_url text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX fkh_billing_trials_consumed_idx ON public.fkh_billing_trials(pro_trial_consumed_at);
--> statement-breakpoint
CREATE TABLE public.fkh_course_twin_round_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
 tee_label varchar(80),
 intent varchar(24) NOT NULL DEFAULT 'normal' CHECK (intent IN ('safe','normal','aggressive')),
 holes_json jsonb NOT NULL DEFAULT '[]',
 evidence_basis varchar(40) NOT NULL DEFAULT 'latest-reliable',
 manifest_package_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX fkh_course_twin_round_plans_user_course_idx ON public.fkh_course_twin_round_plans(user_id,course_id,created_at DESC);
--> statement-breakpoint
ALTER TABLE public.fkh_billing_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_billing_trials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_round_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_round_plans FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.fkh_billing_trials, public.fkh_course_twin_round_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fkh_billing_trials, public.fkh_course_twin_round_plans TO service_role;
-- Client reads and writes are deliberately unavailable: trial consumption and Pro-gated plan saves use authenticated server operations.
