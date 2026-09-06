"use server";

import { z } from "zod";
import { eq, and, count, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import {
  championships, races, raceEntrants, drivers, teams, pointsPresets, bets,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { POINTS, FL_POINT } from "@/lib/store";

const createChampionshipSchema = z.object({
  name: z.string().trim().min(1),
  rounds: z.number().int().positive(),
});

// Creates the championship plus its two outright "races" (drivers and
// constructors markets), seeded with every currently-active driver/team and
// open for betting immediately, same as the original design's intent.
export async function createChampionship(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = createChampionshipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid championship." };
  const { name, rounds } = parsed.data;

  const championshipId = createId();
  const driversRaceId = createId();
  const constructorsRaceId = createId();
  const raceDatetime = new Date(Date.now() + 1400 * 3600e3);
  const qualifyingLock = new Date(Date.now() + 1340 * 3600e3);
  const circuit = `${name} · 0 of ${rounds} rounds complete`;

  await db.transaction(async (tx) => {
    const activeDrivers = await tx.select({ id: drivers.id }).from(drivers).where(eq(drivers.status, "active"));
    const activeTeams = await tx.select({ id: teams.id }).from(teams).where(eq(teams.status, "active"));

    await tx.insert(races).values([
      {
        id: driversRaceId, kind: "season", market: "drivers", name: `${name} Drivers' Championship`,
        circuit, raceDatetime, qualifyingLock, status: "open", rakePct: 0,
      },
      {
        id: constructorsRaceId, kind: "season", market: "constructors", name: `${name} Constructors' Championship`,
        circuit, raceDatetime, qualifyingLock, status: "open", rakePct: 0,
      },
    ]);
    if (activeDrivers.length) {
      await tx.insert(raceEntrants).values(activeDrivers.map(d => ({ raceId: driversRaceId, entrantId: d.id })));
    }
    if (activeTeams.length) {
      await tx.insert(raceEntrants).values(activeTeams.map(t => ({ raceId: constructorsRaceId, entrantId: t.id })));
    }

    await tx.insert(championships).values({
      id: championshipId, name, rounds, roundsDone: 0, status: "open",
      points: POINTS, fastestLapPoint: FL_POINT, dropWorst: 0,
      driversMarketId: driversRaceId, constructorsMarketId: constructorsRaceId,
    });

    await logAction(tx, {
      adminId: admin.id, actionType: "Championship created", targetType: "championship", targetId: championshipId,
      note: `${rounds} scheduled rounds · drivers and constructors markets opened`,
    });
  });

  return { ok: true, championshipId };
}

const setMarketEntrantsSchema = z.object({
  raceId: z.string().min(1),
  entrantIds: z.array(z.string()),
});

// A championship's outright markets are seeded once at creation time from
// whichever drivers/teams were active then (see createChampionship above).
// This is the only way to add or remove entrants afterward — e.g. a
// championship created before the full roster existed, or a new driver/team
// added mid-season. Adding is always safe; removing is blocked if the
// entrant already has bets on this market, so no bet is ever orphaned.
export async function setMarketEntrants(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = setMarketEntrantsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid entrant list." };
  const { raceId, entrantIds } = parsed.data;

  return await db.transaction(async (tx) => {
    const [race] = await tx.select().from(races).where(eq(races.id, raceId));
    if (!race || race.kind !== "season") return { ok: false, error: "Not a championship market." };
    if (race.status === "settled") return { ok: false, error: "This market has already settled." };

    const currentRows = await tx.select({ entrantId: raceEntrants.entrantId }).from(raceEntrants).where(eq(raceEntrants.raceId, raceId));
    const current = new Set(currentRows.map(r => r.entrantId));
    const next = new Set(entrantIds);
    const removed = [...current].filter(id => !next.has(id));

    if (removed.length) {
      const clash = await tx.select({ id: bets.id }).from(bets).where(and(eq(bets.raceId, raceId), inArray(bets.entrantId, removed)));
      if (clash.length) return { ok: false, error: "Can't remove an entrant who already has bets on this market." };
    }

    await tx.delete(raceEntrants).where(eq(raceEntrants.raceId, raceId));
    if (entrantIds.length) {
      await tx.insert(raceEntrants).values(entrantIds.map(entrantId => ({ raceId, entrantId })));
    }

    const added = [...next].filter(id => !current.has(id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Market entrants updated", targetType: "race", targetId: raceId,
      note: `${added.length} added, ${removed.length} removed`,
    });
    return { ok: true };
  });
}

const toggleRaceCountsSchema = z.object({
  raceId: z.string().min(1),
  field: z.enum(["countsDrivers", "countsConstructors"]),
});

export async function toggleRaceCounts(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = toggleRaceCountsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { raceId, field } = parsed.data;

  await db.transaction(async (tx) => {
    const [race] = await tx.select().from(races).where(eq(races.id, raceId));
    if (!race) throw new Error("Race not found.");
    const turningOn = !race[field];
    await tx.update(races).set({ [field]: turningOn }).where(eq(races.id, raceId));
    const label = field === "countsDrivers" ? "Drivers' points" : "Constructors' points";
    await logAction(tx, {
      adminId: admin.id,
      actionType: turningOn ? "Race points scope enabled" : "Race points scope disabled",
      targetType: "race", targetId: raceId,
      note: `${race.name} · ${label.toLowerCase()} ${turningOn ? "enabled" : "disabled"}`,
    });
  });

  return { ok: true };
}

const toggleRoundSchema = z.object({
  raceId: z.string().min(1),
  championshipId: z.string().min(1),
});

export async function toggleRound(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = toggleRoundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { raceId, championshipId } = parsed.data;

  await db.transaction(async (tx) => {
    const [race] = await tx.select().from(races).where(eq(races.id, raceId));
    const [champ] = await tx.select().from(championships).where(eq(championships.id, championshipId));
    if (!race || !champ) throw new Error("Race or championship not found.");

    const inChamp = race.championshipId === championshipId;
    if (inChamp) {
      await tx.update(races).set({ championshipId: null, round: null, countsDrivers: false, countsConstructors: false }).where(eq(races.id, raceId));
    } else {
      const [{ value: roundCount }] = await tx.select({ value: count() }).from(races).where(eq(races.championshipId, championshipId));
      await tx.update(races).set({
        championshipId, round: (roundCount || 0) + 1, countsDrivers: true, countsConstructors: true,
      }).where(eq(races.id, raceId));
    }

    await logAction(tx, {
      adminId: admin.id,
      actionType: inChamp ? "Round removed from season" : "Round added to season",
      targetType: "race", targetId: raceId,
      note: `${race.name} · ${champ.name}`,
    });
  });

  return { ok: true };
}

const setPointsScaleSchema = z.object({
  championshipId: z.string().min(1),
  points: z.array(z.number().int().min(0)).min(1),
  fastestLapPoint: z.number().int().min(0),
});

export async function setPointsScale(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = setPointsScaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid points scale." };
  const { championshipId, points, fastestLapPoint } = parsed.data;

  await db.transaction(async (tx) => {
    const [champ] = await tx.select().from(championships).where(eq(championships.id, championshipId));
    if (!champ) throw new Error("Championship not found.");
    await tx.update(championships).set({ points, fastestLapPoint }).where(eq(championships.id, championshipId));
    await logAction(tx, {
      adminId: admin.id, actionType: "Points system changed", targetType: "championship", targetId: championshipId,
      note: `${champ.name} · ${points.join("-")}${fastestLapPoint ? " +" + fastestLapPoint + " FL" : ""} · applies to future settlements only`,
    });
  });

  return { ok: true };
}

const savePointsPresetSchema = z.object({
  name: z.string().trim().min(1),
  points: z.array(z.number().int().min(0)).min(1),
  fastestLapPoint: z.number().int().min(0),
});

export async function savePointsPreset(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = savePointsPresetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preset." };
  const p = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(pointsPresets).values({ id: createId(), name: p.name, points: p.points, fastestLapPoint: p.fastestLapPoint });
    await logAction(tx, {
      adminId: admin.id, actionType: "Points preset created", targetType: "points_preset",
      note: `${p.name} · ${p.points.join("-")}${p.fastestLapPoint ? " +" + p.fastestLapPoint + " FL" : ""}`,
    });
  });

  return { ok: true };
}

export async function deletePointsPreset(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing preset id." };

  await db.transaction(async (tx) => {
    const [preset] = await tx.select().from(pointsPresets).where(eq(pointsPresets.id, parsed.data.id));
    if (!preset) throw new Error("Preset not found.");
    if (preset.builtin) throw new Error("Built-in presets can't be deleted.");
    await tx.delete(pointsPresets).where(eq(pointsPresets.id, preset.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Points preset deleted", targetType: "points_preset",
      note: `${preset.name} · championships already using it keep their scale`,
    });
  });

  return { ok: true };
}

const renameChampionshipSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});

export async function renameChampionship(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = renameChampionshipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid name." };
  const { id, name } = parsed.data;

  await db.transaction(async (tx) => {
    const [champ] = await tx.select().from(championships).where(eq(championships.id, id));
    if (!champ) throw new Error("Championship not found.");
    await tx.update(championships).set({ name }).where(eq(championships.id, id));

    const circuit = `${name} · ${champ.roundsDone} of ${champ.rounds} rounds complete`;
    if (champ.driversMarketId) {
      await tx.update(races).set({ name: `${name} Drivers' Championship`, circuit }).where(eq(races.id, champ.driversMarketId));
    }
    if (champ.constructorsMarketId) {
      await tx.update(races).set({ name: `${name} Constructors' Championship`, circuit }).where(eq(races.id, champ.constructorsMarketId));
    }

    await logAction(tx, {
      adminId: admin.id, actionType: "Championship renamed", targetType: "championship", targetId: id,
      note: `${name} · season and both outright market titles updated`,
    });
  });

  return { ok: true };
}
