CREATE TYPE "public"."bet_status" AS ENUM('pending', 'won', 'lost', 'void');--> statement-breakpoint
CREATE TYPE "public"."cls_status" AS ENUM('finished', 'dns', 'dnf', 'dsq');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('active', 'reserve', 'retired');--> statement-breakpoint
CREATE TYPE "public"."race_kind" AS ENUM('race', 'season');--> statement-breakpoint
CREATE TYPE "public"."race_status" AS ENUM('upcoming', 'open', 'locked', 'live', 'finished', 'held', 'settled');--> statement-breakpoint
CREATE TYPE "public"."ruling_type" AS ENUM('void_race', 'adjust', 'settle_as_entered', 'hold');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."tx_status" AS ENUM('pending', 'approved', 'paid', 'held', 'rejected', 'refunded', 'credited', 'locked', 'applied', 'void', 'settled');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('deposit', 'bet', 'win', 'payout', 'withdrawal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "admin_action_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"action_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"race_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"stake" integer NOT NULL,
	"status" "bet_status" DEFAULT 'pending' NOT NULL,
	"payout_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championship_lineups" (
	"championship_id" text NOT NULL,
	"team_id" text NOT NULL,
	"seat" integer NOT NULL,
	"driver_id" text NOT NULL,
	CONSTRAINT "championship_lineups_championship_id_team_id_seat_pk" PRIMARY KEY("championship_id","team_id","seat")
);
--> statement-breakpoint
CREATE TABLE "championships" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rounds" integer NOT NULL,
	"rounds_done" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"points" integer[] NOT NULL,
	"fastest_lap_point" integer DEFAULT 0 NOT NULL,
	"drop_worst" integer DEFAULT 0 NOT NULL,
	"drivers_market_id" text,
	"constructors_market_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "championships_drivers_market_id_unique" UNIQUE("drivers_market_id"),
	CONSTRAINT "championships_constructors_market_id_unique" UNIQUE("constructors_market_id")
);
--> statement-breakpoint
CREATE TABLE "classifications" (
	"race_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"position" integer,
	"status" "cls_status" DEFAULT 'finished' NOT NULL,
	"reason" text,
	CONSTRAINT "classifications_race_id_entrant_id_pk" PRIMARY KEY("race_id","entrant_id")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"race_id" text NOT NULL,
	"admin_id" text NOT NULL,
	"ruling_type" "ruling_type" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbr" text NOT NULL,
	"team_id" text,
	"color" text NOT NULL,
	"status" "driver_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"points" integer[] NOT NULL,
	"fastest_lap_point" integer NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_entrants" (
	"race_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	CONSTRAINT "race_entrants_race_id_entrant_id_pk" PRIMARY KEY("race_id","entrant_id")
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "race_kind" DEFAULT 'race' NOT NULL,
	"market" text,
	"name" text NOT NULL,
	"circuit" text,
	"race_datetime" timestamp NOT NULL,
	"qualifying_lock" timestamp NOT NULL,
	"status" "race_status" DEFAULT 'upcoming' NOT NULL,
	"rake_pct" integer DEFAULT 0 NOT NULL,
	"championship_id" text,
	"round" integer,
	"counts_drivers" boolean DEFAULT false NOT NULL,
	"counts_constructors" boolean DEFAULT false NOT NULL,
	"fastest_lap_driver_id" text,
	"result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"desc" text,
	"perms" text[] DEFAULT '{}' NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"seeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbr" text NOT NULL,
	"color" text NOT NULL,
	"status" "team_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "tx_type" NOT NULL,
	"amount" integer NOT NULL,
	"status" "tx_status" NOT NULL,
	"note" text,
	"proof_url" text,
	"destination" text,
	"race_id" text,
	"bet_id" text,
	"admin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"ign" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"role_id" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"confirmed_balance" integer DEFAULT 0 NOT NULL,
	"flags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "admin_action_log" ADD CONSTRAINT "admin_action_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_lineups" ADD CONSTRAINT "championship_lineups_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_lineups" ADD CONSTRAINT "championship_lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_lineups" ADD CONSTRAINT "championship_lineups_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entrants" ADD CONSTRAINT "race_entrants_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_action_log_created_at_idx" ON "admin_action_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bets_race_entrant_idx" ON "bets" USING btree ("race_id","entrant_id");--> statement-breakpoint
CREATE INDEX "bets_user_idx" ON "bets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "championship_lineups_driver_unique" ON "championship_lineups" USING btree ("championship_id","driver_id");--> statement-breakpoint
CREATE INDEX "transactions_type_status_idx" ON "transactions" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");