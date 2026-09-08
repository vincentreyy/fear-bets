import { getRaceList } from "@/lib/data/races";
import { getPoolBets } from "@/lib/data/bets";
import { RacesIndex } from "@/components/UserScreens";

export default async function RacesIndexPage() {
  const races = await getRaceList();
  const bets = await getPoolBets();

  return <RacesIndex S={{ races, bets }} />;
}
