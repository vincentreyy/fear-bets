import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getRaceList } from "@/lib/data/races";
import { getChampionships } from "@/lib/data/championships";
import { getPoolBets } from "@/lib/data/bets";
import { getRosterAndTeams } from "@/lib/data/roster";
import { EntrantProvider } from "@/lib/entrantContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRaces } from "@/components/AdminScreens";

export default async function AdminRacesPage() {
  await requirePermissionOrRedirect("manage_races");

  const races = await getRaceList();
  const championships = await getChampionships();
  const bets = await getPoolBets();
  const { roster, teams } = await getRosterAndTeams();

  return (
    <ErrorBoundary>
      <EntrantProvider drivers={roster} teams={teams}>
        <AdminRaces S={{ races, championships, bets, roster }} />
      </EntrantProvider>
    </ErrorBoundary>
  );
}
