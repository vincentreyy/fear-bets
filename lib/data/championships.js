import { db } from "@/lib/db";
import { championships, pointsPresets } from "@/lib/db/schema";

// Championship rows, mapped like the old `mappedChampionships`.
export async function getChampionships() {
  const championshipRows = await db.select().from(championships);

  return championshipRows.map(c => ({
    id: c.id, name: c.name, rounds: c.rounds, done: c.roundsDone, status: c.status,
    points: c.points, fl: c.fastestLapPoint, dropWorst: c.dropWorst,
    driversMarket: c.driversMarketId, constructorsMarket: c.constructorsMarketId,
  }));
}

// Points presets, mapped like the old `pointsPresetsList`.
export async function getPointsPresets() {
  const presetRows = await db.select().from(pointsPresets);
  return presetRows.map(p => ({ id: p.id, name: p.name, points: p.points, fl: p.fastestLapPoint, builtin: p.builtin }));
}
