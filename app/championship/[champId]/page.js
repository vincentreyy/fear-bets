import { notFound } from "next/navigation";
import { getOptionalUser } from "@/lib/permissions";
import { getRaceMarket } from "@/lib/data/races";
import { getPoolBets } from "@/lib/data/bets";
import { getRosterAndTeams } from "@/lib/data/roster";
import { getMyBalanceAndTx } from "@/lib/data/wallet";
import { EntrantProvider } from "@/lib/entrantContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RacePage } from "@/components/UserScreens";

export default async function ChampionshipMarketPage({ params }) {
  const { champId } = await params;
  const user = await getOptionalUser();
  const { race, siblings } = await getRaceMarket(champId);
  if (!race || race.kind !== "season") notFound();

  const rawBets = await getPoolBets();
  const bets = user ? rawBets.map(b => b.uid === user.id ? { ...b, uid: "me", user: "You" } : b) : rawBets;
  const { roster, teams } = await getRosterAndTeams();
  const balance = user ? (await getMyBalanceAndTx(user.id)).balance : 0;

  return (
    <ErrorBoundary>
      <EntrantProvider drivers={roster} teams={teams}>
        <RacePage S={{ bets, balance, roster, teams }} race={race} siblings={siblings} basePath="/championship" sessionUser={user} />
      </EntrantProvider>
    </ErrorBoundary>
  );
}
