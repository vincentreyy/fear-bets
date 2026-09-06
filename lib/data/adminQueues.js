import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, users, bets, races, drivers, teams } from "@/lib/db/schema";

// GLOBAL admin views only — the caller must already have verified the
// viewer holds the matching approve_* permission before calling these
// (no `has()`-style branching inside; that's the bug the approved plan
// calls out about the old lib/data.js conflating "my own pending" with
// "the global admin queue" under one field). "My own pending win/withdrawal"
// lives in lib/data/wallet.js's getMyPendingWinWd — a separate concept.

export async function getDepositQueue() {
  const rows = await db.select().from(transactions).where(and(eq(transactions.type, "deposit"), eq(transactions.status, "pending")));
  if (!rows.length) return [];
  const userRows = await db.select().from(users);
  const usersById = Object.fromEntries(userRows.map(u => [u.id, u]));
  return rows.map(t => ({
    id: t.id, user: usersById[t.userId]?.displayName || "Unknown", ign: usersById[t.userId]?.ign || "",
    amount: t.amount, at: t.createdAt.getTime(), proof: !!t.proofUrl,
  }));
}

export async function getWinQueue() {
  const rows = await db.select().from(transactions).where(and(eq(transactions.type, "win"), inArray(transactions.status, ["pending", "approved", "paid", "held"])));
  if (!rows.length) return [];

  const userRows = await db.select().from(users);
  const usersById = Object.fromEntries(userRows.map(u => [u.id, u]));

  const betIds = rows.map(r => r.betId).filter(Boolean);
  const winBets = betIds.length ? await db.select().from(bets).where(inArray(bets.id, betIds)) : [];
  const betsById = Object.fromEntries(winBets.map(b => [b.id, b]));

  const raceRows = await db.select().from(races);
  const racesById = Object.fromEntries(raceRows.map(r => [r.id, r]));

  const driverRows = await db.select().from(drivers);
  const driversById = Object.fromEntries(driverRows.map(d => [d.id, d]));
  const teamRows = await db.select().from(teams);
  const teamsById = Object.fromEntries(teamRows.map(t => [t.id, t]));

  return rows.map(t => {
    const bet = t.betId ? betsById[t.betId] : null;
    const race = bet ? racesById[bet.raceId] : (t.raceId ? racesById[t.raceId] : null);
    const driver = bet ? (driversById[bet.entrantId] || teamsById[bet.entrantId]) : null;
    return {
      id: t.id, user: usersById[t.userId]?.displayName || "Unknown", ign: usersById[t.userId]?.ign || "",
      amount: t.amount, race: race?.name || "", driver: driver?.name || "",
      stake: bet?.stake || 0, at: t.createdAt.getTime(), status: t.status,
    };
  });
}

export async function getWithdrawalQueue() {
  const rows = await db.select().from(transactions).where(eq(transactions.type, "withdrawal"));
  if (!rows.length) return [];
  const userRows = await db.select().from(users);
  const usersById = Object.fromEntries(userRows.map(u => [u.id, u]));
  return rows.map(t => ({
    id: t.id, user: usersById[t.userId]?.displayName || "Unknown", ign: usersById[t.userId]?.ign || "",
    amount: Math.abs(t.amount), dest: t.destination || "", at: t.createdAt.getTime(), status: t.status,
  }));
}
