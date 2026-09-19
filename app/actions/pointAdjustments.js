"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { races, raceEntrants, pointAdjustments } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

const awardSchema = z.object({
  raceId: z.string().min(1),
  entrantId: z.string().min(1),
  points: z.number().int().refine(n => n !== 0, "Enter a non-zero point value."),
  reason: z.string().trim().min(1, "A reason is required."),
});

// A discretionary steward ruling — a flat, signed point correction that's
// independent of the settlement math entirely (see lib/settlement.js and
// lib/data/roster.js, which sum these separately). Deliberately not gated on
// race.status: it never touches bets, payouts, or the rake ledger, so unlike
// editRace/pole/min-laps it's meant to be usable on an already-settled race —
// that's the whole reason this is its own table instead of a classifications
// edit.
export async function awardPointsAdjustment(input) {
  const admin = await requirePermission("resolve_disputes");
  const parsed = awardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid adjustment." };
  const { raceId, entrantId, points, reason } = parsed.data;

  await db.transaction(async (tx) => {
    const [race] = await tx.select().from(races).where(eq(races.id, raceId));
    if (!race) throw new Error("Race not found.");

    const grid = await tx.select({ entrantId: raceEntrants.entrantId }).from(raceEntrants).where(eq(raceEntrants.raceId, raceId));
    if (!grid.some(g => g.entrantId === entrantId)) {
      throw new Error("That entrant isn't on this race's grid.");
    }

    await tx.insert(pointAdjustments).values({
      id: createId(), raceId, entrantId, points, reason, adminId: admin.id,
    });

    await logAction(tx, {
      adminId: admin.id,
      actionType: "Steward point adjustment",
      targetType: "race",
      targetId: raceId,
      note: `${points > 0 ? "+" : ""}${points} pt · ${entrantId} · ${reason}`,
    });
  });

  return { ok: true };
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deletePointsAdjustment(input) {
  const admin = await requirePermission("resolve_disputes");
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing adjustment id." };

  await db.transaction(async (tx) => {
    const [adj] = await tx.select().from(pointAdjustments).where(eq(pointAdjustments.id, parsed.data.id));
    if (!adj) throw new Error("Adjustment not found.");

    await tx.delete(pointAdjustments).where(eq(pointAdjustments.id, adj.id));

    await logAction(tx, {
      adminId: admin.id,
      actionType: "Steward point adjustment removed",
      targetType: "race",
      targetId: adj.raceId,
      note: `${adj.points > 0 ? "+" : ""}${adj.points} pt reversed · ${adj.entrantId} · was: ${adj.reason}`,
    });
  });

  return { ok: true };
}
