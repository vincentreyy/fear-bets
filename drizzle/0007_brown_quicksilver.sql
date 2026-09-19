CREATE TABLE "point_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"race_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"admin_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;