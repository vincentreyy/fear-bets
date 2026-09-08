CREATE TYPE "public"."house_ledger_type" AS ENUM('rake', 'deposit', 'withdrawal', 'manual_in', 'manual_out');--> statement-breakpoint
CREATE TABLE "house_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "house_ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"race_id" text,
	"transaction_id" text,
	"admin_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "house_ledger" ADD CONSTRAINT "house_ledger_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;