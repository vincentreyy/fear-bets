import { getRaceList } from "@/lib/data/races";
import { getPoolBets } from "@/lib/data/bets";
import { ChampionshipsIndex } from "@/components/UserScreens";

export default async function ChampionshipIndexPage() {
  const races = await getRaceList();
  const bets = await getPoolBets();

  return <ChampionshipsIndex S={{ races, bets }} />;
}
