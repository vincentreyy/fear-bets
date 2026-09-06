import { redirect } from "next/navigation";
import { getRaceList } from "@/lib/data/races";
import { raceWindow } from "@/lib/store";

export default async function RacesIndexPage() {
  const races = await getRaceList();
  const list = raceWindow(races);
  const target = list.find(r => r.status === "open") || list[0];
  if (target) redirect(`/races/${target.id}`);

  return <div className="wrap-wide" style={{ padding: "80px 24px", textAlign: "center" }}>
    <div className="card" style={{ padding: 48, display: "inline-block" }}>
      <div className="ttl-sm" style={{ marginBottom: 6 }}>No races yet</div>
      <div className="muted2" style={{ fontSize: 13 }}>Check back once an admin creates one.</div>
    </div>
  </div>;
}
