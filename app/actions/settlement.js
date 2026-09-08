"use server";

import { z } from "zod";
import { eq, and, ne, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import {
  races, bets, classifications, users, transactions, championships, drivers, houseLedger,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { computeSettlement } from "@/lib/settlement";

const classificationRowSchema = z.object({
  entrantId: z.string().min(1),
  position: z.number().int().positive().nullable(),
  status: z.enum(["finished", "dns", "dnf", "dsq"]),
  reason: z.string().trim().optional(),
});

const settlementInputSchema = z.object({
  raceId: z.string().min(1),
  season: z.boolean().default(false),
  champion: z.string().optional().nullable(),
  classifications: z.array(classificationRowSchema).optional().default([]),
  fastestLapEntrantId: z.string().optional().nullable(),
  ruling: z.enum(["settle_as_entered", "adjust", "hold", "void_race"]),
  reason: z.string().trim().min(1, "A ruling reason is required."),
});

// Loads everything computeSettlement() needs for a race, independent of
// whether this is a dry-run preview or the real thing — kept in one place
// so preview and confirm can never disagree about the inputs.
async function loadSettlementContext(tx, raceId) {
  const [race] = await tx.select().from(races).where(eq(races.id, raceId));
  if (!race) throw new Error("Race not found.");
  if (race.status === "settled") throw new Error("This race is already settled.");

  const raceBets = await tx.select().from(bets)
    .where(and(eq(bets.raceId, raceId), ne(bets.status, "void")));

  let pointsScale = [];
  let flBonus = 0;
  if (race.championshipId) {
    const [champ] = await tx.select().from(championships).where(eq(championships.id, race.championshipId));
    if (champ) {
      pointsScale = champ.points;
      flBonus = champ.fastestLapPoint;
    }
  }

  let driverTeamMap = null;
  if (race.countsConstructors) {
    const rows = await tx.select({ id: drivers.id, teamId: drivers.teamId }).from(drivers);
    driverTeamMap = Object.fromEntries(rows.map(r => [r.id, r.teamId]));
  }

  return { race, raceBets, pointsScale, flBonus, driverTeamMap };
}

async function runComputation(input) {
  const { race, raceBets, pointsScale, flBonus, driverTeamMap } = await loadSettlementContext(db, input.raceId);
  const result = computeSettlement({
    race,
    season: input.season,
    champion: input.champion,
    classifications: input.classifications,
    bets: raceBets,
    pointsScale,
    flBonus,
    fastestLapEntrantId: input.fastestLapEntrantId,
    driverTeamMap,
    ruling: input.ruling,
  });
  return { race, result };
}

export async function previewSettlement(input) {
  await requirePermission("enter_results");
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input." };

  try {
    const { result } = await runComputation(parsed.data);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message || "Could not compute settlement." };
  }
}

export async function confirmSettlement(input) {
  const admin = await requirePermission("enter_results");
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  const p = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const { race, raceBets, pointsScale, flBonus, driverTeamMap } = await loadSettlementContext(tx, p.raceId);
      const result = computeSettlement({
        race, season: p.season, champion: p.champion, classifications: p.classifications,
        bets: raceBets, pointsScale, flBonus, fastestLapEntrantId: p.fastestLapEntrantId,
        driverTeamMap, ruling: p.ruling,
      });

      if (result.held) {
        await tx.update(races).set({ status: "held" }).where(eq(races.id, race.id));
        await logAction(tx, {
          adminId: admin.id, actionType: "Market held for investigation",
          targetType: "race", targetId: race.id, note: p.reason,
        });
        return;
      }

      // Classification rows (skipped for voided races and season markets,
      // which don't have a full grid classification).
      if (!result.voided && !p.season) {
        await tx.delete(classifications).where(eq(classifications.raceId, race.id));
        if (p.classifications.length) {
          await tx.insert(classifications).values(p.classifications.map(c => ({
            raceId: race.id,
            entrantId: c.entrantId,
            position: c.status === "finished" ? c.position : null,
            status: c.status,
            reason: c.status === "finished" ? null : (c.reason || null),
          })));
        }
      }

      // Bet outcomes.
      const refundBetIds = result.refunds.map(r => r.betId);
      const winnerBetIds = result.winners.map(w => w.betId);
      if (result.voided) {
        await tx.update(bets).set({ status: "void" }).where(eq(bets.raceId, race.id));
      } else {
        if (refundBetIds.length) {
          await tx.update(bets).set({ status: "void" }).where(inArray(bets.id, refundBetIds));
        }
        for (const w of result.winners) {
          await tx.update(bets).set({ status: "won", payoutAmount: w.amount }).where(eq(bets.id, w.betId));
        }
        if (result.loserBetIds?.length) {
          await tx.update(bets).set({ status: "lost" }).where(inArray(bets.id, result.loserBetIds));
        }
      }

      // Balances + ledger: refunds go straight back to confirmed balance;
      // winnings queue as a pending payout (admin releases them separately).
      for (const r of result.refunds) {
        await tx.update(users).set({ confirmedBalance: sql`${users.confirmedBalance} + ${r.amount}` }).where(eq(users.id, r.userId));
        await tx.insert(transactions).values({
          id: createId(), userId: r.userId, type: "adjustment", amount: r.amount,
          status: "refunded", raceId: race.id, betId: r.betId, note: "Non-runner, stake refunded",
        });
      }
      for (const w of result.winners) {
        await tx.insert(transactions).values({
          id: createId(), userId: w.userId, type: "win", amount: w.amount,
          status: "pending", raceId: race.id, betId: w.betId,
          note: `${race.name} · awaiting admin release`,
        });
      }

      // Championship round tally — bumped whenever a linked race actually
      // settles (not on void/hold).
      if (!result.voided && race.championshipId) {
        await tx.update(championships)
          .set({ roundsDone: sql`${championships.roundsDone} + 1` })
          .where(eq(championships.id, race.championshipId));
      }

      await tx.update(races).set({
        status: "settled",
        result: result.voided ? null : (p.season ? result.champion : result.p1),
        fastestLapDriverId: p.fastestLapEntrantId || null,
        settledAt: new Date(),
      }).where(eq(races.id, race.id));

      if (!result.voided && result.rakeAmount > 0) {
        await tx.insert(houseLedger).values({
          id: createId(), type: "rake", amount: result.rakeAmount,
          raceId: race.id, adminId: admin.id, note: `Rake · ${race.name}`,
        });
      }

      await logAction(tx, {
        adminId: admin.id,
        actionType: result.voided ? (p.season ? "Market voided" : "Race voided") : "Race settled",
        targetType: "race",
        targetId: race.id,
        note: p.reason,
        after: { totalPool: result.totalPool, netPool: result.netPool, winners: result.winners.length },
      });
    });
  } catch (e) {
    return { ok: false, error: e.message || "Could not settle race." };
  }

  return { ok: true };
}
