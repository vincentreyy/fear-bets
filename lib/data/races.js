import { db } from "@/lib/db";

// Shared per-race mapper — same shape as the old lib/data.js `mappedRaces`
// entries. Reads the nested `entrants`/`classifications` that Drizzle's
// relational query attaches directly onto each race row.
function mapRace(r) {
  const clsRows = r.classifications;
  const retired = clsRows.filter(c => c.status !== "finished").map(c => ({ id: c.entrantId, st: c.status, why: c.reason || "" }));
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
    fl: r.fastestLapDriverId, champId: r.championshipId,
    countsD: r.countsDrivers, countsC: r.countsConstructors, round: r.round,
  };
}

// All races, mapped exactly like the old getInitialData's `mappedRaces`.
// One relational query (races + nested entrants + nested classifications)
// instead of three separate full-table selects.
export async function getRaceList() {
  const raceRows = await db.query.races.findMany({ with: { entrants: true, classifications: true } });
  return raceRows.map(mapRace);
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
