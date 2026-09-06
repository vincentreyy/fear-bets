import { redirect } from "next/navigation";
import { getRaceList } from "@/lib/data/races";
import { seasonWindow } from "@/lib/store";

export default async function ChampionshipIndexPage() {
  const races = await getRaceList();
  const target = seasonWindow(races)[0];
  if (target) redirect(`/championship/${target.id}`);

  return <div className="wrap-wide" style={{ padding: "80px 24px", textAlign: "center" }}>
    <div className="card" style={{ padding: 48, display: "inline-block" }}>
      <div className="ttl-sm" style={{ marginBottom: 6 }}>No championship markets yet</div>
      <div className="muted2" style={{ fontSize: 13 }}>Check back once an admin creates a championship.</div>
    </div>
  </div>;
}
