"use server";

import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { races, raceEntrants, drivers, championships } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

const createRaceSchema = z.object({
  name: z.string().trim().min(1),
  circuit: z.string().trim().optional(),
  raceDatetime: z.coerce.date(),
  qualifyingLock: z.coerce.date(),
  rakePct: z.number().int().min(0).max(100).default(0),
  championshipId: z.string().optional().nullable(),
  round: z.number().int().positive().optional().nullable(),
  countsDrivers: z.boolean().default(false),
  countsConstructors: z.boolean().default(false),
  driverIds: z.array(z.string()).optional(), // defaults to every active driver
});

export async function createRace(input) {
  const admin = await requirePermission("manage_races");
  const parsed = createRaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid race." };
  const p = parsed.data;

  if (p.qualifyingLock >= p.raceDatetime) {
    return { ok: false, error: "Betting must close before the race starts." };
  }

  const raceId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(races).values({
      id: raceId,
      kind: "race",
      name: p.name,
      circuit: p.circuit || null,
      raceDatetime: p.raceDatetime,
      qualifyingLock: p.qualifyingLock,
      status: "open",
      rakePct: p.rakePct,
      championshipId: p.championshipId || null,
      round: p.round || null,
      countsDrivers: p.championshipId ? p.countsDrivers : false,
      countsConstructors: p.championshipId ? p.countsConstructors : false,
    });

    const driverIds = p.driverIds && p.driverIds.length
      ? p.driverIds
      : (await tx.select({ id: drivers.id }).from(drivers).where(eq(drivers.status, "active"))).map(d => d.id);

    if (driverIds.length) {
      await tx.insert(raceEntrants).values(driverIds.map(entrantId => ({ raceId, entrantId })));
    }

    await logAction(tx, {
      adminId: admin.id,
      actionType: "Race created",
      targetType: "race",
      targetId: raceId,
      note: `${p.name} · betting opened, ${driverIds.length} drivers on grid`,
    });
  });

  return { ok: true, raceId };
}

const editRaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  circuit: z.string().trim().optional(),
  raceDatetime: z.coerce.date(),
  qualifyingLock: z.coerce.date(),
  rakePct: z.number().int().min(0).max(100),
  championshipId: z.string().optional().nullable(),
  round: z.number().int().positive().optional().nullable(),
  countsDrivers: z.boolean().default(false),
  countsConstructors: z.boolean().default(false),
  status: z.enum(["upcoming", "open", "locked", "live", "finished"]),
  driverIds: z.array(z.string()).optional(), // only applied while status stays "upcoming"
});

export async function editRace(input) {
  const admin = await requirePermission("manage_races");
  const parsed = editRaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid race." };
  const p = parsed.data;

  if (p.qualifyingLock >= p.raceDatetime) {
    return { ok: false, error: "Betting must close before the race starts." };
  }

  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(races).where(eq(races.id, p.id));
    if (!before) throw new Error("Race not found.");
    if (before.status === "settled") throw new Error("A settled race can't be edited.");

    await tx.update(races).set({
      name: p.name,
      circuit: p.circuit || null,
      raceDatetime: p.raceDatetime,
      qualifyingLock: p.qualifyingLock,
      rakePct: p.rakePct,
      championshipId: p.championshipId || null,
      round: p.round || null,
      countsDrivers: p.championshipId ? p.countsDrivers : false,
      countsConstructors: p.championshipId ? p.countsConstructors : false,
      status: p.status,
    }).where(eq(races.id, p.id));

    // The grid only freezes while the race is still Upcoming — once betting
    // has opened, no bet can end up pointing at a driver removed later.
    if (before.status === "upcoming" && p.driverIds) {
      await tx.delete(raceEntrants).where(eq(raceEntrants.raceId, p.id));
      if (p.driverIds.length) {
        await tx.insert(raceEntrants).values(p.driverIds.map(entrantId => ({ raceId: p.id, entrantId })));
      }
    }

    const diffs = [];
    if (before.name !== p.name) diffs.push("name → " + p.name);
    if (before.rakePct !== p.rakePct) diffs.push(`rake ${before.rakePct}% → ${p.rakePct}%`);
    if (before.status !== p.status) diffs.push(`status ${before.status} → ${p.status}`);

    await logAction(tx, {
      adminId: admin.id,
      actionType: "Race edited",
      targetType: "race",
      targetId: p.id,
      before: { name: before.name, status: before.status, rakePct: before.rakePct },
      after: { name: p.name, status: p.status, rakePct: p.rakePct },
      note: diffs.length ? diffs.join(" · ") : "No field changes",
    });

    // Locking the last race of a championship's grid (by start time — round
    // numbers are just an insertion-order counter, not a chronological
    // marker) also locks that championship's own drivers/constructors
    // outright markets, so bettors can't keep betting on the title after the
    // final round's grid is already known.
    if (before.status !== "locked" && p.status === "locked" && p.championshipId) {
      const siblings = await tx.select({ id: races.id, dt: races.raceDatetime })
        .from(races).where(and(eq(races.championshipId, p.championshipId), eq(races.kind, "race")));
      const isLast = siblings.every(s => s.id === p.id || s.dt <= p.raceDatetime);

      if (isLast) {
        const [champ] = await tx.select().from(championships).where(eq(championships.id, p.championshipId));
        const marketIds = [champ?.driversMarketId, champ?.constructorsMarketId].filter(Boolean);
        if (marketIds.length) {
          const locked = await tx.update(races).set({ status: "locked" })
            .where(and(inArray(races.id, marketIds), eq(races.status, "open")))
            .returning({ id: races.id });
          if (locked.length) {
            await logAction(tx, {
              adminId: admin.id, actionType: "Championship markets locked", targetType: "championship", targetId: p.championshipId,
              note: `${champ.name} · locked automatically — "${p.name}" was the final round to lock`,
            });
          }
        }
      }
    }
  });

  return { ok: true };
}

const renameRaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  circuit: z.string().trim().optional(),
});

export async function renameRace(input) {
  const admin = await requirePermission("manage_races");
  const parsed = renameRaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid name." };
  const p = parsed.data;

  await db.transaction(async (tx) => {
    await tx.update(races).set({
      name: p.name,
      ...(p.circuit !== undefined ? { circuit: p.circuit } : {}),
    }).where(eq(races.id, p.id));

    await logAction(tx, {
      adminId: admin.id,
      actionType: "Race renamed",
      targetType: "race",
      targetId: p.id,
      note: "Name corrected",
    });
  });

  return { ok: true };
}
