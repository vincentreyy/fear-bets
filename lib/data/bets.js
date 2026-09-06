import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bets } from "@/lib/db/schema";

// All bets, for pool math (see lib/store.js's poolOf/driverPools, which only
// read raceId/status/stake/dId). No sessionUser context here — "mine"
// framing ("You"/isMine) belongs in getMyBets, called separately by the
// page for the signed-in user. uid/user are still included (raw userId,
// generic placeholder) so existing component JSX that reads b.uid/b.user
// for display doesn't break; pages that need the "mine" distinction should
// cross-reference against their own sessionUser.id rather than relying on
// this function's placeholder fields.
export async function getPoolBets() {
  const rows = await db.select().from(bets);
  return rows.map(b => ({
    id: b.id, uid: b.userId, user: "Player",
    raceId: b.raceId, dId: b.entrantId, stake: b.stake, status: b.status,
    payout: b.payoutAmount, at: b.createdAt.getTime(),
  }));
}

// A single user's own bets, mapped with the "You"/"me" convention screens
// rely on (b.uid === "me").
export async function getMyBets(userId) {
  const rows = await db.select().from(bets).where(eq(bets.userId, userId));
  return rows.map(b => ({
    id: b.id, uid: "me", user: "You",
    raceId: b.raceId, dId: b.entrantId, stake: b.stake, status: b.status,
    payout: b.payoutAmount, at: b.createdAt.getTime(),
  }));
}
