// One-time bootstrap for a fresh database:
//  - the Owner role (every permission, un-deletable) + a first admin account
//    — there's no self-registration and no admin signup, so this is the
//    only way the very first admin gets created (spec: "seed one Owner
//    role at setup since no admin exists yet to create the first role").
//  - two more starter roles (Finance Admin, Race Admin) so Role Management
//    isn't empty on first login.
//  - a starter grid of teams/drivers, one open race, and one championship —
//    without mocks, an empty database means an empty, useless UI.
require("dotenv/config");
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { eq } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
const { createId } = require("@paralleldrive/cuid2");

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

const ALL_PERMS = [
  "approve_deposits", "approve_payouts", "approve_withdrawals", "adjust_balances",
  "manage_races", "enter_results", "resolve_disputes", "manage_championships",
  "manage_users", "manage_roles", "view_audit_log",
];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const FL_POINT = 1;

const TEAMS = [
  { name: "Vireo Racing", abbr: "VIR", color: "#4b9cd3" },
  { name: "Apex Meridian", abbr: "APX", color: "#e0783c" },
  { name: "Kestrel GP", abbr: "KES", color: "#8f6fd6" },
  { name: "Halcyon Motorsport", abbr: "HAL", color: "#2dbdb6" },
  { name: "Northgate Racing", abbr: "NOR", color: "#c94f6d" },
];

const DRIVERS = [
  { name: "Kaz Almeida", abbr: "KAL", team: "Vireo Racing" },
  { name: "Rook Delaney", abbr: "RDL", team: "Apex Meridian" },
  { name: "Silas Torrent", abbr: "STO", team: "Kestrel GP" },
  { name: "Nova Kaminski", abbr: "NKA", team: "Vireo Racing" },
  { name: "Dex Marlowe", abbr: "DMA", team: "Halcyon Motorsport" },
  { name: "Ines Vaziri", abbr: "IVA", team: "Apex Meridian" },
  { name: "Bruno Castellan", abbr: "BCA", team: "Kestrel GP" },
  { name: "Odette Ferrand", abbr: "OFE", team: "Halcyon Motorsport" },
  { name: "Ty Okonkwo", abbr: "TOK", team: "Northgate Racing" },
  { name: "Marek Sylvane", abbr: "MSY", team: "Northgate Racing" },
];

function randomTempPassword() {
  return "temp-" + Math.random().toString(36).slice(2, 10);
}

const H = (hours) => new Date(Date.now() + hours * 3600e3);

async function main() {
  // Load the schema lazily via require so this plain Node script (run with
  // `node`, not through Next.js) doesn't need the "@/" path alias.
  const {
    roles, users, teams, drivers, races, raceEntrants, championships,
  } = require("./schema");

  let [owner] = await db.select().from(roles).where(eq(roles.name, "Owner"));
  if (!owner) {
    [owner] = await db.insert(roles).values({
      id: createId(), name: "Owner",
      desc: "Full control, including creating roles and promoting users.",
      perms: ALL_PERMS, builtin: true, seeded: true,
    }).returning();
  }

  const [financeAdmin] = await db.select().from(roles).where(eq(roles.name, "Finance Admin"));
  if (!financeAdmin) {
    await db.insert(roles).values({
      id: createId(), name: "Finance Admin",
      desc: "Money movement only. Cannot touch race results.",
      perms: ["approve_deposits", "approve_payouts", "approve_withdrawals", "manage_users", "view_audit_log"],
      builtin: true,
    });
  }
  const [raceAdmin] = await db.select().from(roles).where(eq(roles.name, "Race Admin"));
  if (!raceAdmin) {
    await db.insert(roles).values({
      id: createId(), name: "Race Admin",
      desc: "Race lifecycle and settlement. No access to balances.",
      perms: ["manage_races", "enter_results", "resolve_disputes", "manage_championships", "view_audit_log"],
      builtin: true,
    });
  }

  const [existingAdmin] = await db.select().from(users).where(eq(users.roleId, owner.id));
  if (!existingAdmin) {
    const tempPassword = randomTempPassword();
    const [admin] = await db.insert(users).values({
      id: createId(), username: "owner",
      passwordHash: await bcrypt.hash(tempPassword, 12),
      displayName: "Owner", roleId: owner.id, mustChangePassword: true,
    }).returning();

    console.log("Seeded Owner role and first admin account:");
    console.log(`  username: ${admin.username}`);
    console.log(`  temporary password: ${tempPassword}`);
    console.log("Log in and change the password immediately — this is printed once and not stored anywhere else.");
  } else {
    console.log(`Owner role already has an admin: @${existingAdmin.username}.`);
  }

  const existingTeams = await db.select().from(teams);
  let teamRows = existingTeams;
  if (!existingTeams.length) {
    teamRows = await db.insert(teams).values(
      TEAMS.map(t => ({ id: createId(), name: t.name, abbr: t.abbr, color: t.color, status: "active" }))
    ).returning();
    console.log(`Seeded ${teamRows.length} teams.`);
  }
  const teamIdByName = Object.fromEntries(teamRows.map(t => [t.name, t.id]));

  const existingDrivers = await db.select().from(drivers);
  let driverRows = existingDrivers;
  if (!existingDrivers.length) {
    driverRows = await db.insert(drivers).values(
      DRIVERS.map(d => ({
        id: createId(), name: d.name, abbr: d.abbr,
        teamId: teamIdByName[d.team], color: teamRows.find(t => t.name === d.team)?.color || "#555",
        status: "active",
      }))
    ).returning();
    console.log(`Seeded ${driverRows.length} drivers.`);
  }

  const existingRaces = await db.select().from(races);
  if (!existingRaces.length) {
    const raceId = createId();
    await db.insert(races).values({
      id: raceId, kind: "race", name: "Los Santos Night GP", circuit: "Harbor Street Circuit · 58 laps",
      raceDatetime: H(29), qualifyingLock: H(26), status: "open", rakePct: 0,
    });
    await db.insert(raceEntrants).values(driverRows.map(d => ({ raceId, entrantId: d.id })));
    console.log("Seeded one open race: Los Santos Night GP.");

    const champId = createId();
    const driversRaceId = createId();
    const constructorsRaceId = createId();
    await db.insert(races).values([
      {
        id: driversRaceId, kind: "season", market: "drivers", name: "Season 1 Drivers' Championship",
        circuit: "Season 1 · 0 of 14 rounds complete", raceDatetime: H(1400), qualifyingLock: H(1340),
        status: "open", rakePct: 0,
      },
      {
        id: constructorsRaceId, kind: "season", market: "constructors", name: "Season 1 Constructors' Championship",
        circuit: "Season 1 · 0 of 14 rounds complete", raceDatetime: H(1400), qualifyingLock: H(1340),
        status: "open", rakePct: 0,
      },
    ]);
    await db.insert(raceEntrants).values(driverRows.map(d => ({ raceId: driversRaceId, entrantId: d.id })));
    await db.insert(raceEntrants).values(teamRows.map(t => ({ raceId: constructorsRaceId, entrantId: t.id })));
    await db.insert(championships).values({
      id: champId, name: "Season 1", rounds: 14, roundsDone: 0, status: "open",
      points: POINTS, fastestLapPoint: FL_POINT, dropWorst: 0,
      driversMarketId: driversRaceId, constructorsMarketId: constructorsRaceId,
    });
    console.log("Seeded Season 1 championship with drivers/constructors outright markets.");
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
