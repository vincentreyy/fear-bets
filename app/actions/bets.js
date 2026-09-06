"use server";

import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { races, raceEntrants, bets, transactions, users, drivers, teams } from "@/lib/db/schema";
import { requireUser } from "@/lib/permissions";

async function resolveEntrantName(tx, race, entrantId) {
  if (race.kind === "season" && race.market === "constructors") {
    const [team] = await tx.select().from(teams).where(eq(teams.id, entrantId));
    return team?.name || entrantId;
  }
  const [driver] = await tx.select().from(drivers).where(eq(drivers.id, entrantId));
  return driver?.name || entrantId;
}

const placeBetSchema = z.object({
  raceId: z.string().min(1),
  entrantId: z.string().min(1),
  stake: z.number().int().positive(),
});

export async function placeBet(input) {
  const user = await requireUser();
  const parsed = placeBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid stake." };
  const { raceId, entrantId, stake } = parsed.data;

  let betId;
  try {
    await db.transaction(async (tx) => {
      const [race] = await tx.select().from(races).where(eq(races.id, raceId));
      if (!race || race.status !== "open") {
        throw new Error("Betting is not open for this race.");
      }

      const [entrant] = await tx.select().from(raceEntrants)
        .where(and(eq(raceEntrants.raceId, raceId), eq(raceEntrants.entrantId, entrantId)));
      if (!entrant) throw new Error("That entrant isn't on this race's grid.");

      const [freshUser] = await tx.select().from(users).where(eq(users.id, user.id));
      if (freshUser.confirmedBalance < stake) throw new Error("Insufficient balance.");

      await tx.update(users)
        .set({ confirmedBalance: sql`${users.confirmedBalance} - ${stake}` })
        .where(eq(users.id, user.id));

      betId = createId();
      await tx.insert(bets).values({
        id: betId,
        userId: user.id,
        raceId,
        entrantId,
        stake,
        status: "pending",
      });

      const entrantName = await resolveEntrantName(tx, race, entrantId);
      await tx.insert(transactions).values({
        id: createId(),
        userId: user.id,
        type: "bet",
        amount: -stake,
        status: "locked",
        raceId,
        betId,
        note: `${race.name} · ${entrantName}`,
      });
    });
  } catch (e) {
    return { ok: false, error: e.message || "Could not place bet." };
  }

  return { ok: true, betId };
}
