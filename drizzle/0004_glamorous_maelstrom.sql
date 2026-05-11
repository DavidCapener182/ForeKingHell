CREATE TABLE "fkh_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"country" varchar(80),
	"provider" varchar(80) DEFAULT 'manual' NOT NULL,
	"external_id" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"tee_set_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"stroke_index" integer,
	"yards" integer NOT NULL,
	"tee_lat" double precision NOT NULL,
	"tee_lng" double precision NOT NULL,
	"green_lat" double precision NOT NULL,
	"green_lng" double precision NOT NULL,
	"centerline_geojson" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tee_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"par" integer NOT NULL,
	"course_rating" double precision,
	"slope_rating" integer,
	"yards" integer,
	"meters" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD COLUMN "tee_set_id" uuid;--> statement-breakpoint
ALTER TABLE "fkh_holes" ADD CONSTRAINT "fkh_holes_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_holes" ADD CONSTRAINT "fkh_holes_tee_set_id_fkh_tee_sets_id_fk" FOREIGN KEY ("tee_set_id") REFERENCES "public"."fkh_tee_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_tee_sets" ADD CONSTRAINT "fkh_tee_sets_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_courses_provider_external_idx" ON "fkh_courses" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "fkh_courses_name_idx" ON "fkh_courses" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_holes_tee_set_hole_idx" ON "fkh_holes" USING btree ("tee_set_id","hole_number");--> statement-breakpoint
CREATE INDEX "fkh_holes_course_idx" ON "fkh_holes" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tee_sets_course_name_idx" ON "fkh_tee_sets" USING btree ("course_id","name");--> statement-breakpoint
CREATE INDEX "fkh_tee_sets_course_idx" ON "fkh_tee_sets" USING btree ("course_id");--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD CONSTRAINT "fkh_sessions_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD CONSTRAINT "fkh_sessions_tee_set_id_fkh_tee_sets_id_fk" FOREIGN KEY ("tee_set_id") REFERENCES "public"."fkh_tee_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
WITH seeded_course AS (
	INSERT INTO "fkh_courses" ("name", "country", "provider", "external_id", "updated_at")
	VALUES ('TPC Sawgrass - THE PLAYERS Stadium Course', 'USA', 'seed', 'tpc-sawgrass-stadium', now())
	ON CONFLICT ("provider", "external_id") DO UPDATE SET
		"name" = excluded."name",
		"country" = excluded."country",
		"updated_at" = now()
	RETURNING "id"
), seeded_tee_set AS (
	INSERT INTO "fkh_tee_sets" ("course_id", "name", "par", "course_rating", "slope_rating", "yards", "meters", "updated_at")
	SELECT "id", 'White', 72, 70.8, 138, 6086, 5565, now()
	FROM seeded_course
	ON CONFLICT ("course_id", "name") DO UPDATE SET
		"par" = excluded."par",
		"course_rating" = excluded."course_rating",
		"slope_rating" = excluded."slope_rating",
		"yards" = excluded."yards",
		"meters" = excluded."meters",
		"updated_at" = now()
	RETURNING "id", "course_id"
)
INSERT INTO "fkh_holes" (
	"course_id", "tee_set_id", "hole_number", "par", "stroke_index", "yards",
	"tee_lat", "tee_lng", "green_lat", "green_lng", "centerline_geojson", "updated_at"
)
SELECT
	seeded_tee_set."course_id",
	seeded_tee_set."id",
	h."hole_number",
	h."par",
	h."stroke_index",
	h."yards",
	h."tee_lat",
	h."tee_lng",
	h."green_lat",
	h."green_lng",
	h."centerline_geojson",
	now()
FROM seeded_tee_set
CROSS JOIN (
	VALUES
    (1, 4, 11, 360, 30.2001584, -81.3953623, 30.2036352, -81.3949269, '{"type":"LineString","coordinates":[[-81.3953623,30.2001584],[-81.3953266,30.202269],[-81.395013,30.2033441],[-81.3950063,30.203364],[-81.3949269,30.2036352]]}'::jsonb),
    (2, 5, 15, 469, 30.2042657, -81.3955991, 30.1999262, -81.3964533, '{"type":"LineString","coordinates":[[-81.3955991,30.2042657],[-81.3962068,30.2019596],[-81.3963393,30.200867],[-81.3963556,30.2007322],[-81.3964533,30.1999262]]}'::jsonb),
    (3, 3, 17, 134, 30.1994215, -81.3966160, 30.1997896, -81.3982895, '{"type":"LineString","coordinates":[[-81.396616,30.1994215],[-81.3967671,30.1994546],[-81.3982895,30.1997896]]}'::jsonb),
    (4, 4, 9, 324, 30.1991912, -81.3990366, 30.1961136, -81.3979827, '{"type":"LineString","coordinates":[[-81.3990366,30.1991912],[-81.3988423,30.1987328],[-81.3987605,30.19854],[-81.3986381,30.1982513],[-81.398607,30.1981778],[-81.3985875,30.198132],[-81.3983807,30.1976442],[-81.3981781,30.1971664],[-81.3979827,30.1961136]]}'::jsonb),
    (5, 4, 3, 422, 30.1952588, -81.3988234, 30.1942420, -81.3946528, '{"type":"LineString","coordinates":[[-81.3988234,30.1952588],[-81.3965772,30.1949778],[-81.3958296,30.1948842],[-81.3951918,30.1945362],[-81.3951468,30.1945116],[-81.3946528,30.194242]]}'::jsonb),
    (6, 4, 13, 333, 30.1935632, -81.3949452, 30.1915589, -81.3978358, '{"type":"LineString","coordinates":[[-81.3949452,30.1935632],[-81.3959024,30.1929475],[-81.3968496,30.1923382],[-81.3978358,30.1915589]]}'::jsonb),
    (7, 4, 1, 382, 30.1908353, -81.3974692, 30.1929135, -81.3939378, '{"type":"LineString","coordinates":[[-81.3974692,30.1908353],[-81.3952191,30.1923177],[-81.3944052,30.1927174],[-81.3943658,30.1927339],[-81.3943385,30.192743],[-81.3939378,30.1929135]]}'::jsonb),
    (8, 3, 7, 168, 30.1920367, -81.3941156, 30.1924537, -81.3919114, '{"type":"LineString","coordinates":[[-81.3941156,30.1920367],[-81.3919114,30.1924537]]}'::jsonb),
    (9, 5, 5, 522, 30.1929826, -81.3921133, 30.1970601, -81.3948207, '{"type":"LineString","coordinates":[[-81.3921133,30.1929826],[-81.3937142,30.1947462],[-81.3942612,30.1963222],[-81.3948207,30.1970601]]}'::jsonb),
    (10, 4, 12, 351, 30.1986893, -81.3920419, 30.2007762, -81.3890960, '{"type":"LineString","coordinates":[[-81.3920419,30.1986893],[-81.3898607,30.1996756],[-81.389096,30.2007762]]}'::jsonb),
    (11, 5, 8, 469, 30.2015849, -81.3876145, 30.1971395, -81.3892637, '{"type":"LineString","coordinates":[[-81.3876145,30.2015849],[-81.388985,30.1992716],[-81.3889404,30.1976431],[-81.3892637,30.1971395]]}'::jsonb),
    (12, 4, 16, 296, 30.1971208, -81.3880690, 30.1998004, -81.3875849, '{"type":"LineString","coordinates":[[-81.388069,30.1971208],[-81.3879451,30.1974648],[-81.3874233,30.1990779],[-81.3875849,30.1998004]]}'::jsonb),
    (13, 3, 18, 141, 30.2011846, -81.3866059, 30.1997423, -81.3865015, '{"type":"LineString","coordinates":[[-81.3866059,30.2011846],[-81.3865015,30.1997423]]}'::jsonb),
    (14, 4, 4, 377, 30.1994344, -81.3860803, 30.1958880, -81.3878318, '{"type":"LineString","coordinates":[[-81.3860803,30.1994344],[-81.3868176,30.1980122],[-81.3872513,30.1972146],[-81.3875287,30.1968672],[-81.3878318,30.195888]]}'::jsonb),
    (15, 4, 6, 366, 30.1950199, -81.3877582, 30.1977624, -81.3905828, '{"type":"LineString","coordinates":[[-81.3877582,30.1950199],[-81.3895064,30.1961949],[-81.3901418,30.1966265],[-81.3905828,30.1977624]]}'::jsonb),
    (16, 5, 10, 470, 30.1981602, -81.3918520, 30.1943752, -81.3896764, '{"type":"LineString","coordinates":[[-81.391852,30.1981602],[-81.3910785,30.1959509],[-81.3899937,30.1949998],[-81.3896764,30.1943752]]}'::jsonb),
    (17, 3, 14, 115, 30.1936662, -81.3901763, 30.1946297, -81.3908673, '{"type":"LineString","coordinates":[[-81.3901763,30.1936662],[-81.3908673,30.1946297]]}'::jsonb),
    (18, 4, 2, 387, 30.1945793, -81.3917812, 30.1976691, -81.3939078, '{"type":"LineString","coordinates":[[-81.3917812,30.1945793],[-81.3927151,30.1967776],[-81.3939078,30.1976691]]}'::jsonb)
) AS h("hole_number", "par", "stroke_index", "yards", "tee_lat", "tee_lng", "green_lat", "green_lng", "centerline_geojson")
ON CONFLICT ("tee_set_id", "hole_number") DO UPDATE SET
	"par" = excluded."par",
	"stroke_index" = excluded."stroke_index",
	"yards" = excluded."yards",
	"tee_lat" = excluded."tee_lat",
	"tee_lng" = excluded."tee_lng",
	"green_lat" = excluded."green_lat",
	"green_lng" = excluded."green_lng",
	"centerline_geojson" = excluded."centerline_geojson",
	"updated_at" = now();--> statement-breakpoint
UPDATE "fkh_sessions"
SET
	"course_id" = seeded_course."id",
	"tee_set_id" = seeded_tee_set."id"
FROM "fkh_courses" seeded_course
JOIN "fkh_tee_sets" seeded_tee_set ON seeded_tee_set."course_id" = seeded_course."id"
WHERE
	seeded_course."provider" = 'seed'
	AND seeded_course."external_id" = 'tpc-sawgrass-stadium'
	AND seeded_tee_set."name" = 'White'
	AND (
		"fkh_sessions"."course_name" ILIKE '%sawgrass%'
		OR "fkh_sessions"."course_name" ILIKE '%stadium%'
	);
