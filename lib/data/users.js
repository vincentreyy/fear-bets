import { db } from "@/lib/db";
import { users, bets } from "@/lib/db/schema";

// Admin users list with per-user bet aggregates (locked/staked/returned),
// matching the old getInitialData's `usersList`.
export async function getUsersList() {
  const userRows = await db.select().from(users);
  const betRows = await db.select().from(bets);

  const betsByUser = {};
  for (const b of betRows) (betsByUser[b.userId] ||= []).push(b);

  return userRows.map(u => {
    const own = betsByUser[u.id] || [];
    const locked = own.filter(b => b.status === "pending").reduce((s, b) => s + b.stake, 0);
    const staked = own.reduce((s, b) => s + b.stake, 0);
    const ret = own.reduce((s, b) => s + (b.payoutAmount || 0), 0);
    return {
      id: u.id, name: u.displayName, ign: u.ign || "", un: u.username,
      joined: u.createdAt.getTime(), bal: u.confirmedBalance, locked, staked, ret,
      status: u.status, flags: u.flags || [], invited: u.mustChangePassword, roleId: u.roleId,
    };
  });
}
