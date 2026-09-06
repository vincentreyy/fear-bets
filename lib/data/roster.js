import { db } from "@/lib/db";
import { championships } from "@/lib/db/schema";

// Roster (drivers/teams) with live standings points derived from settled
// races. Nearly every route needs driver/team names, so this is the
// most-shared query function — call it once per page alongside whatever
// else that page needs, sequentially (never Promise.all'd with the rest;
// see the note in lib/db/index.js about the Supabase pooler). Uses Drizzle's
// relational queries to fold what was 5 separate full-table selects down to
// 3: teams-with-drivers, races-with-classifications, and championships
// (which has no natural parent/child relation to fold into either of those).
// Rooted at teams (not drivers) to fold the old separate drivers+teams
// full-table selects into one round-trip — this only returns every driver
// correctly because the only driver-creation/edit paths (app/actions/roster.js)
// always require a team, so a teamId-null driver can't exist in practice.
export async function getRosterAndTeams() {
  const teamRows = await db.query.teams.findMany({ with: { drivers: true } });
  const raceRows = await db.query.races.findMany({ with: { classifications: true } });
  const championshipRows = await db.select().from(championships);

  const championshipsById = Object.fromEntries(championshipRows.map(c => [c.id, c]));
  const driverRows = teamRows.flatMap(t => t.drivers);
  const teamsById = Object.fromEntries(teamRows.map(t => [t.id, t]));

  const driverTeamMap = Object.fromEntries(driverRows.map(d => [d.id, d.teamId]));
  const driverPts = {}; const teamPts = {};
  for (const r of raceRows) {
    if (r.status !== "settled" || r.kind === "season" || !r.championshipId) continue;
    const champ = championshipsById[r.championshipId];
    if (!champ) continue;
    for (const c of r.classifications) {
      if (c.status !== "finished" || !c.position) continue;
      const base = champ.points[c.position - 1] || 0;
      const bonus = r.fastestLapDriverId === c.entrantId ? champ.fastestLapPoint : 0;
      const pts = base + bonus;
      if (!pts) continue;
      if (r.countsDrivers) driverPts[c.entrantId] = (driverPts[c.entrantId] || 0) + pts;
      if (r.countsConstructors) {
        const teamId = driverTeamMap[c.entrantId];
        if (teamId) teamPts[teamId] = (teamPts[teamId] || 0) + pts;
      }
    }
  }

  const roster = driverRows.map(d => ({
    id: d.id, n: d.name, ab: d.abbr, c: d.color, t: teamsById[d.teamId]?.name || "", status: d.status,
    pts: driverPts[d.id] || 0,
  }));
  const teams_ = teamRows.map(t => {
    const memberNames = t.drivers.filter(d => d.status !== "retired").map(d => d.name);
    return {
      id: t.id, n: t.name, ab: t.abbr, c: t.color, t: memberNames.join(" · "), status: t.status,
      pts: teamPts[t.id] || 0,
    };
  });

  return { roster, teams: teams_ };
}
