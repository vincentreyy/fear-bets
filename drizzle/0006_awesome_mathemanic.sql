ALTER TABLE "championships" ADD COLUMN "min_laps_point" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classifications" ADD COLUMN "laps_completed" integer;--> statement-breakpoint
ALTER TABLE "points_presets" ADD COLUMN "min_laps_point" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "min_laps_for_points" integer;