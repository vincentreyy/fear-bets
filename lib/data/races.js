import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Shared per-race mapper — same shape as the old lib/data.js `mappedRaces`
// entries. Reads the nested `entrants`/`classifications` that Drizzle's
// relational query attaches directly onto each race row. `usersById` resolves
// a point adjustment's admin id to a display name (only ever populated by
// getRaceList, which fetches it once for every race rather than per-row).
function mapRace(r, usersById = {}) {
  const clsRows = r.classifications;
  const retired = clsRows.filter(c => c.status !== "finished").map(c => ({ id: c.entrantId, st: c.status, why: c.reason || "", laps: c.lapsCompleted ?? undefined }));
  const why = Object.fromEntries(retired.map(x => [x.id, x.why]));
  const order = r.status === "settled" && r.kind !== "season"
    ? clsRows.filter(c => c.status === "finished" && c.position != null).sort((a, b) => a.position - b.position).map(c => c.entrantId)
    : null;
  return {
    id: r.id, kind: r.kind, market: r.market || undefined,
    name: r.name, circuit: r.circuit,
    dt: r.raceDatetime.getTime(), lock: r.qualifyingLock.getTime(),
    status: r.status, drivers: r.entrants.map(e => e.entrantId),
    rake: r.rakePct, result: r.result,
    order, retired: retired.length ? retired : undefined, why,
    fl: r.fastestLapDriverId, pole: r.poleDriverId, minLaps: r.minLapsForPoints, champId: r.championshipId,
    countsD: r.countsDrivers, countsC: r.countsConstructors, round: r.round,
    // Discretionary steward point rulings — independent of the settlement
    // math, so present regardless of race status (see app/actions/pointAdjustments.js).
    adjustments: r.pointAdjustments.map(a => ({
      id: a.id, entrantId: a.entrantId, points: a.points, reason: a.reason,
      admin: usersById[a.adminId]?.displayName || usersById[a.adminId]?.username || a.adminId,
    })),
  };
}

// All races, mapped exactly like the old getInitialData's `mappedRaces`.
// One relational query (races + nested entrants + nested classifications)
// instead of three separate full-table selects.
export async function getRaceList() {
  const raceRows = await db.query.races.findMany({ with: { entrants: true, classifications: true, pointAdjustments: true } });
  const userRows = await db.select().from(users);
  const usersById = Object.fromEntries(userRows.map(u => [u.id, u]));
  return raceRows.map(r => mapRace(r, usersById));
}

// One race by id (mapped the same way), plus its "siblings" — used by
// /races/[raceId] and /championship/[champId]. Siblings are all other
// season-kind races if this race is a season market, otherwise all
// non-season races. Fetches the full race table regardless (needed to
// compute siblings anyway), so this reuses getRaceList's mapping rather
// than issuing a narrower single-row query plus a second full-table pass.
export async function getRaceMarket(id) {
  const allMapped = await getRaceList();
  const race = allMapped.find(r => r.id === id);
  if (!race) return { race: null, siblings: [] };

  const siblings = race.kind === "season"
    ? allMapped.filter(r => r.kind === "season")
    : allMapped.filter(r => r.kind !== "season");

  return { race, siblings };
}
