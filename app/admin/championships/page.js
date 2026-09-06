import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getChampionships, getPointsPresets } from "@/lib/data/championships";
import { getRaceList } from "@/lib/data/races";
import { getPoolBets } from "@/lib/data/bets";
import { getRosterAndTeams } from "@/lib/data/roster";
import { EntrantProvider } from "@/lib/entrantContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminChampionships } from "@/components/AdminChamp";

export default async function AdminChampionshipsPage() {
  await requirePermissionOrRedirect("manage_championships");

  const championships = await getChampionships();
  const races = await getRaceList();
  const bets = await getPoolBets();
  const { roster, teams } = await getRosterAndTeams();
  const pointsPresets = await getPointsPresets();

  return (
    <ErrorBoundary>
      <EntrantProvider drivers={roster} teams={teams}>
        <AdminChampionships S={{ championships, races, bets, roster, teams, pointsPresets }} />
      </EntrantProvider>
    </ErrorBoundary>
  );
}
