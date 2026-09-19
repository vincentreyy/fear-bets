ALTER TABLE "championships" ADD COLUMN "pole_point" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "points_presets" ADD COLUMN "pole_point" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "pole_driver_id" text;