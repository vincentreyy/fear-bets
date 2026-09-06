"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { drivers, teams } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

const driverSchema = z.object({
  name: z.string().trim().min(1),
  teamId: z.string().min(1),
  abbr: z.string().trim().min(1).max(3),
  status: z.enum(["active", "reserve", "retired"]).default("active"),
});

export async function addDriver(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid driver." };
  const p = parsed.data;

  const driverId = createId();
  await db.transaction(async (tx) => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, p.teamId));
    if (!team) throw new Error("Team not found.");
    await tx.insert(drivers).values({
      id: driverId, name: p.name, abbr: p.abbr.toUpperCase(), teamId: p.teamId, color: team.color, status: p.status,
    });
    await logAction(tx, {
      adminId: admin.id, actionType: "Driver added", targetType: "driver", targetId: driverId,
      note: `${p.name} · joined ${team.name}`,
    });
  });

  return { ok: true, driverId };
}

const editDriverSchema = driverSchema.extend({ id: z.string().min(1) });

export async function editDriver(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = editDriverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid driver." };
  const p = parsed.data;

  await db.transaction(async (tx) => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, p.teamId));
    if (!team) throw new Error("Team not found.");
    await tx.update(drivers).set({
      name: p.name, abbr: p.abbr.toUpperCase(), teamId: p.teamId, color: team.color, status: p.status,
    }).where(eq(drivers.id, p.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Driver edited", targetType: "driver", targetId: p.id,
      note: `Team ${team.name} · status ${p.status}`,
    });
  });

  return { ok: true };
}

export async function toggleDriverStatus(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing driver id." };

  await db.transaction(async (tx) => {
    const [driver] = await tx.select().from(drivers).where(eq(drivers.id, parsed.data.id));
    if (!driver) throw new Error("Driver not found.");
    const next = driver.status === "retired" ? "active" : "retired";
    await tx.update(drivers).set({ status: next }).where(eq(drivers.id, driver.id));
    await logAction(tx, {
      adminId: admin.id,
      actionType: next === "retired" ? "Driver retired" : "Driver reinstated",
      targetType: "driver", targetId: driver.id,
      note: next === "retired" ? "Removed from active grid" : "Back on the active grid",
    });
  });

  return { ok: true };
}

const teamSchema = z.object({
  name: z.string().trim().min(1),
  abbr: z.string().trim().min(1).max(3),
  color: z.string().trim().min(1),
});

export async function addTeam(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid team." };
  const p = parsed.data;

  const teamId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(teams).values({ id: teamId, name: p.name, abbr: p.abbr.toUpperCase(), color: p.color, status: "active" });
    await logAction(tx, {
      adminId: admin.id, actionType: "Team added", targetType: "team", targetId: teamId,
      note: `${p.name} · active, eligible for constructors' markets`,
    });
  });

  return { ok: true, teamId };
}

export async function toggleTeamStatus(input) {
  const admin = await requirePermission("manage_championships");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing team id." };

  await db.transaction(async (tx) => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, parsed.data.id));
    if (!team) throw new Error("Team not found.");
    const next = team.status === "active" ? "withdrawn" : "active";
    await tx.update(teams).set({ status: next }).where(eq(teams.id, team.id));
    await logAction(tx, {
      adminId: admin.id,
      actionType: next === "withdrawn" ? "Team withdrawn" : "Team reinstated",
      targetType: "team", targetId: team.id,
      note: next === "withdrawn" ? "Drops out of new constructor markets; history intact" : "Eligible for constructor markets again",
    });
  });

  return { ok: true };
}
