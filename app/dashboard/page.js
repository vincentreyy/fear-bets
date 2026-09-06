import { requireUserOrRedirect } from "@/lib/pageGuards";
import { getMyBalanceAndTx } from "@/lib/data/wallet";
import { getPoolBets } from "@/lib/data/bets";
import { getRaceList } from "@/lib/data/races";
import { getRosterAndTeams } from "@/lib/data/roster";
import { getMyPendingWinWd } from "@/lib/data/wallet";
import { EntrantProvider } from "@/lib/entrantContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Dashboard } from "@/components/UserScreens";

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();
  const { balance, tx } = await getMyBalanceAndTx(user.id);
  const rawBets = await getPoolBets();
  const bets = rawBets.map(b => b.uid === user.id ? { ...b, uid: "me", user: "You" } : b);
  const races = await getRaceList();
  const { roster, teams } = await getRosterAndTeams();
  const { pendingWin } = await getMyPendingWinWd(user.id);

  return (
    <ErrorBoundary>
      <EntrantProvider drivers={roster} teams={teams}>
        <Dashboard S={{ balance, tx, bets, races, pendingWin }} sessionUser={user} />
      </EntrantProvider>
    </ErrorBoundary>
  );
}
