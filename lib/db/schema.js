import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());

// ---------- enums ----------

export const raceStatusEnum = pgEnum("race_status", [
  "upcoming", "open", "locked", "live", "finished", "held", "settled",
]);
export const raceKindEnum = pgEnum("race_kind", ["race", "season"]);
export const betStatusEnum = pgEnum("bet_status", ["pending", "won", "lost", "void"]);
export const txTypeEnum = pgEnum("tx_type", [
  "deposit", "bet", "win", "payout", "withdrawal", "adjustment",
]);
export const txStatusEnum = pgEnum("tx_status", [
  "pending", "approved", "paid", "held", "rejected", "refunded",
  "credited", "locked", "applied", "void", "settled",
]);
export const clsStatusEnum = pgEnum("cls_status", ["finished", "dns", "dnf", "dsq"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const driverStatusEnum = pgEnum("driver_status", ["active", "reserve", "retired"]);
export const teamStatusEnum = pgEnum("team_status", ["active", "withdrawn"]);
export const rulingTypeEnum = pgEnum("ruling_type", [
  "void_race", "adjust", "settle_as_entered", "hold",
]);

// ---------- roles & users ----------

export const roles = pgTable("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  desc: text("desc"),
  perms: text("perms").array().notNull().default([]), // subset of PERM keys from lib/store.js PERMS
  builtin: boolean("builtin").notNull().default(false),
  seeded: boolean("seeded").notNull().default(false), // the one un-deletable Owner role
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  ign: text("ign"), // in-game character name
  status: userStatusEnum("status").notNull().default("active"),
  roleId: text("role_id").references(() => roles.id),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  confirmedBalance: integer("confirmed_balance").notNull().default(0),
  flags: text("flags").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// ---------- roster ----------

export const teams = pgTable("teams", {
  id: id(),
  name: text("name").notNull(),
  abbr: text("abbr").notNull(),
  color: text("color").notNull(),
  status: teamStatusEnum("status").notNull().default("active"),
});

export const drivers = pgTable("drivers", {
  id: id(),
  name: text("name").notNull(),
  abbr: text("abbr").notNull(),
  teamId: text("team_id").references(() => teams.id),
  color: text("color").notNull(),
  status: driverStatusEnum("status").notNull().default("active"),
});

// ---------- championships ----------

export const championships = pgTable("championships", {
  id: id(),
  name: text("name").notNull(),
  rounds: integer("rounds").notNull(),
  roundsDone: integer("rounds_done").notNull().default(0),
  status: text("status").notNull().default("open"),
  points: integer("points").array().notNull(),
  fastestLapPoint: integer("fastest_lap_point").notNull().default(0),
  dropWorst: integer("drop_worst").notNull().default(0),
  driversMarketId: text("drivers_market_id").unique(),
  constructorsMarketId: text("constructors_market_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- races & betting ----------

export const races = pgTable("races", {
  id: id(),
  kind: raceKindEnum("kind").notNull().default("race"),
  market: text("market"), // "drivers" | "constructors", only for kind=season
  name: text("name").notNull(),
  circuit: text("circuit"),
  raceDatetime: timestamp("race_datetime").notNull(),
  qualifyingLock: timestamp("qualifying_lock").notNull(),
  status: raceStatusEnum("status").notNull().default("upcoming"),
  rakePct: integer("rake_pct").notNull().default(0),
  championshipId: text("championship_id").references(() => championships.id),
  round: integer("round"),
  countsDrivers: boolean("counts_drivers").notNull().default(false),
  countsConstructors: boolean("counts_constructors").notNull().default(false),
  fastestLapDriverId: text("fastest_lap_driver_id"),
  result: text("result"), // p1 entrant id, denormalized convenience
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

export const raceEntrants = pgTable("race_entrants", {
  raceId: text("race_id").notNull().references(() => races.id),
  entrantId: text("entrant_id").notNull(), // Driver.id or Team.id depending on race.kind/market
}, (t) => ({
  pk: primaryKey({ columns: [t.raceId, t.entrantId] }),
}));

export const bets = pgTable("bets", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  raceId: text("race_id").notNull().references(() => races.id),
  entrantId: text("entrant_id").notNull(),
  stake: integer("stake").notNull(),
  status: betStatusEnum("status").notNull().default("pending"),
  payoutAmount: integer("payout_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  raceEntrantIdx: index("bets_race_entrant_idx").on(t.raceId, t.entrantId),
  userIdx: index("bets_user_idx").on(t.userId),
}));

export const classifications = pgTable("classifications", {
  raceId: text("race_id").notNull().references(() => races.id),
  entrantId: text("entrant_id").notNull(),
  position: integer("position"), // null when status != finished
  status: clsStatusEnum("status").notNull().default("finished"),
  reason: text("reason"),
}, (t) => ({
  pk: primaryKey({ columns: [t.raceId, t.entrantId] }),
}));

export const disputes = pgTable("disputes", {
  id: id(),
  raceId: text("race_id").notNull().references(() => races.id),
  adminId: text("admin_id").notNull(),
  rulingType: rulingTypeEnum("ruling_type").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- wallet ledger ----------

export const transactions = pgTable("transactions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  type: txTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // signed
  status: txStatusEnum("status").notNull(),
  note: text("note"),
  proofUrl: text("proof_url"),
  destination: text("destination"), // withdrawal handoff description
  raceId: text("race_id"),
  betId: text("bet_id"),
  adminId: text("admin_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (t) => ({
  typeStatusIdx: index("transactions_type_status_idx").on(t.type, t.status),
  userIdx: index("transactions_user_idx").on(t.userId),
}));

// ---------- audit & misc ----------

export const adminActionLog = pgTable("admin_action_log", {
  id: id(),
  adminId: text("admin_id").notNull().references(() => users.id),
  actionType: text("action_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index("admin_action_log_created_at_idx").on(t.createdAt),
}));

export const pointsPresets = pgTable("points_presets", {
  id: id(),
  name: text("name").notNull(),
  points: integer("points").array().notNull(),
  fastestLapPoint: integer("fastest_lap_point").notNull(),
  builtin: boolean("builtin").notNull().default(false),
});

// ---------- relations (for db.query.*.findMany({ with: {...} }) —
// collapses what would otherwise be several sequential round-trips into
// one SQL statement; see lib/data/races.js and lib/data/roster.js) ----------

export const racesRelations = relations(races, ({ many }) => ({
  entrants: many(raceEntrants),
  classifications: many(classifications),
}));
export const raceEntrantsRelations = relations(raceEntrants, ({ one }) => ({
  race: one(races, { fields: [raceEntrants.raceId], references: [races.id] }),
}));
export const classificationsRelations = relations(classifications, ({ one }) => ({
  race: one(races, { fields: [classifications.raceId], references: [races.id] }),
}));
export const teamsRelations = relations(teams, ({ many }) => ({
  drivers: many(drivers),
}));
export const driversRelations = relations(drivers, ({ one }) => ({
  team: one(teams, { fields: [drivers.teamId], references: [teams.id] }),
}));
