"use client";
import { useState } from "react";
import { Dot, Stat, Badge } from "./UserScreens";
import { useServerAction } from "@/lib/useServerAction";
import { money, poolOf, raceWindow } from "@/lib/store";
import {
  createChampionship, toggleRaceCounts, toggleRound as toggleRoundAction, setMarketEntrants,
  setPointsScale, savePointsPreset, deletePointsPreset, renameChampionship, setChampionshipRake,
} from "@/app/actions/championships";

// A market's grid is seeded once at championship creation from the roster
// at that moment (see createChampionship) — this is the only place to add
// or remove entrants afterward, e.g. a championship created before the full
// roster existed, or a driver/team added mid-season.
function MarketEntrantsEditor({ title, raceId, currentIds, candidates }) {
  const run = useServerAction();
  const [selected, setSelected] = useState(() => new Set(currentIds));
  const dirty = selected.size !== currentIds.length || currentIds.some(id => !selected.has(id));
  const toggle = id => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return <div className="card">
    <div className="ttl-sm" style={{ marginBottom: 4 }}>{title}</div>
    <div className="cap" style={{ marginBottom: 12 }}>{selected.size} of {candidates.length} selected</div>
    <div className="card-flat" style={{ background: "var(--canvas)", maxHeight: 220, overflow: "auto", padding: 10 }}>
      {candidates.map(c => <label key={c.id} className="flex" style={{ gap: 10, alignItems: "center", padding: "6px 4px", fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: "var(--yellow)" }} />
        <Dot d={c} size={20} />{c.n}</label>)}
      {!candidates.length && <div className="muted" style={{ fontSize: 13, padding: "10px 4px" }}>No eligible entrants yet.</div>}
    </div>
    <button className="btn btn-y btn-sm" style={{ width: "100%", marginTop: 12 }} disabled={!dirty}
      onClick={() => run(setMarketEntrants, { raceId, entrantIds: [...selected] })}>Save changes</button>
  </div>;
}

export function AdminChampionships({ S }) {
  const run = useServerAction();
  const [cid, setCid] = useState(null);
  const ch = cid ? S.championships.find(c => c.id === cid) : null;
  const [tab, setTab] = useState("rounds");
  const [nName, setNName] = useState("");
  const [nRounds, setNRounds] = useState("14");
  const [nRake, setNRake] = useState("0");
  const [ren, setRen] = useState(null);
  const [rakeEdit, setRakeEdit] = useState(null);
  const [pName, setPName] = useState("");
  const [pRows, setPRows] = useState([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
  const [pFl, setPFl] = useState(1);
  const rounds = ch ? raceWindow(S.races).filter(r => r.champId === ch.id) : [];
  const eligible = raceWindow(S.races);
  const driversMarketRace = ch ? S.races.find(r => r.id === ch.driversMarket) : null;
  const constructorsMarketRace = ch ? S.races.find(r => r.id === ch.constructorsMarket) : null;
  if (!ch) {
    return <div>
      <div className="hdr" style={{ marginBottom: 20 }}>
        <div><h2 className="ttl-lg">Championships</h2>
          <div className="muted" style={{ fontSize: 13 }}>A championship owns its rounds and its points system. Outright betting markets attach to it.</div></div>
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
        <div className="card">
          <div className="ttl-sm" style={{ marginBottom: 14 }}>All championships</div>
          {S.championships.length ? <div className="tblwrap"><table>
            <thead><tr><th>Name</th><th>Rounds</th><th style={{ textAlign: "right" }}>House rake</th><th style={{ textAlign: "right" }}>Outright pool</th></tr></thead>
            <tbody>{S.championships.map(c => {
              const roundCount = raceWindow(S.races).filter(r => r.champId === c.id).length;
              const rake = S.races.find(r => r.id === c.driversMarket)?.rake || 0;
              const pool = poolOf(S.bets, c.driversMarket) + poolOf(S.bets, c.constructorsMarket);
              return <tr key={c.id} className="rowhov" style={{ cursor: "pointer" }} onClick={() => setCid(c.id)}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td className="muted2">{roundCount} / {c.rounds}</td>
                <td className="num" style={{ textAlign: "right" }}>{rake}%</td>
                <td className="num" style={{ textAlign: "right" }}>{money(pool)}</td>
              </tr>; })}</tbody>
          </table></div> : <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>No championships yet.</div>}
        </div>
        <div className="card">
          <div className="ttl-sm" style={{ marginBottom: 14 }}>Create championship</div>
          <div style={{ marginBottom: 12 }}><label className="f">NAME</label>
            <input className="input" value={nName} onChange={e => setNName(e.target.value)} placeholder="Season 5" /></div>
          <div style={{ marginBottom: 12 }}><label className="f">SCHEDULED ROUNDS</label>
            <input className="input" value={nRounds} onChange={e => setNRounds(e.target.value.replace(/[^\d]/g, ""))} /></div>
          <div style={{ marginBottom: 12 }}><label className="f">HOUSE RAKE %</label>
            <input className="input" value={nRake} onChange={e => setNRake(e.target.value.replace(/[^\d]/g, ""))} /></div>
          <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", marginBottom: 14 }}>
            <div className="cap" style={{ marginBottom: 6 }}>CREATES</div>
            <div style={{ fontSize: 13, color: "var(--muted-2)" }}>Drivers' and Constructors' outright markets, seeded with the current roster. Both open for betting immediately and close before the final round.</div></div>
          <button className="btn btn-y" style={{ width: "100%" }} disabled={!nName.trim() || !Number(nRounds)}
            onClick={() => { run(createChampionship, { name: nName, rounds: Number(nRounds), rakePct: Number(nRake) || 0 }); setNName(""); }}>Create championship</button>
        </div>
      </div>
    </div>;
  }

  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">{ch.name}</h2>
        <div className="muted" style={{ fontSize: 13 }}>A championship owns its rounds and its points system. Outright betting markets attach to it.</div></div>
      <div className="flex" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-xs" onClick={() => setCid(null)}>← All championships</button>
        <button className="btn btn-ghost btn-xs" onClick={() => setRen(ch.name)}>Rename</button>
        <button className="btn btn-ghost btn-xs" onClick={() => setRakeEdit(String(driversMarketRace?.rake || 0))}>Edit rake</button>
      </div>
    </div>

    <div className="grid g4" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
      <div className="card"><Stat label="ROUNDS COUNTING" value={rounds.length + " / " + ch.rounds} sub={rounds.filter(r => r.status === "settled").length + " settled"} /></div>
      <div className="card"><Stat label="POINTS SYSTEM" value={ch.points.slice(0, 3).join("–") + "…"} sub={"P1–P" + ch.points.length + (ch.fl ? " + " + ch.fl + " fastest lap" : "")} /></div>
      <div className="card"><Stat label="OUTRIGHT POOLS" value={money(poolOf(S.bets, ch.driversMarket) + poolOf(S.bets, ch.constructorsMarket))} sub="Drivers + constructors" color="var(--up)" /></div>
      <div className="card"><Stat label="HOUSE RAKE" value={(driversMarketRace?.rake || 0) + "%"} sub="Both outright markets" /></div>
    </div>

    <div className="flex" style={{ gap: 6, marginBottom: 16 }}>
      {[["rounds", "Rounds"], ["points", "Points system"], ["standings", "Standings"]].map(([k, l]) =>
        <button key={k} className={"pill-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === "rounds" && <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>Rounds in {ch.name}</div>
        <div className="cap" style={{ marginBottom: 14 }}>A race can count toward the drivers' title, the constructors' title, both, or neither — one-off exhibition races award no points.</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 40 }}>Rd</th><th>Race</th><th>Status</th><th>Scores points</th><th></th></tr></thead>
          <tbody>{eligible.map(r => { const inCh = r.champId === ch.id;
            return <tr key={r.id} className="rowhov" style={{ opacity: inCh ? 1 : .55 }}>
              <td className="num muted2">{inCh && r.round ? r.round : "—"}</td>
              <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
              <td><Badge s={r.status} /></td>
              <td><div className="flex" style={{ gap: 14 }}>
                {[["Drivers", "countsD"], ["Constr.", "countsC"]].map(([l, f]) => <label key={f} className="flex" style={{ gap: 6, alignItems: "center", fontSize: 12, color: "var(--muted-2)", cursor: "pointer" }}>
                  <Check on={inCh && r[f]} onClick={() => run(toggleRaceCounts, { raceId: r.id, field: f })} />{l}</label>)}
              </div></td>
              <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-xs" onClick={() => run(toggleRoundAction, { raceId: r.id, championshipId: ch.id })}>{inCh ? "Remove" : "Add to season"}</button></td>
            </tr>; })}</tbody>
        </table></div>
      </div>}

    {tab === "rounds" && driversMarketRace && constructorsMarketRace && <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 24 }}>
      <MarketEntrantsEditor
        key={ch.driversMarket + ":" + driversMarketRace.drivers.join(",")}
        title="Drivers market entrants"
        raceId={ch.driversMarket}
        currentIds={driversMarketRace.drivers}
        candidates={S.roster.filter(d => d.status !== "retired")}
      />
      <MarketEntrantsEditor
        key={ch.constructorsMarket + ":" + constructorsMarketRace.drivers.join(",")}
        title="Constructors market entrants"
        raceId={ch.constructorsMarket}
        currentIds={constructorsMarketRace.drivers}
        candidates={S.teams}
      />
    </div>}

    {tab === "points" && <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>Points per finishing position</div>
        <div className="cap" style={{ marginBottom: 16 }}>Currently the FIA scale. Points below P{ch.points.length} score zero.</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 10 }}>
          {ch.points.map((p, i) => <div key={i} className="card-flat" style={{ background: "var(--elev)", padding: "12px 10px", textAlign: "center" }}>
            <div className="cap">P{i + 1}</div>
            <div className="num yel" style={{ fontSize: 22, fontWeight: 700 }}>{p}</div></div>)}
        </div>
        <div className="flex" style={{ gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
          <div><div className="cap">FASTEST LAP BONUS</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>+{ch.fl} pt</div>
            <div className="cap" style={{ color: "var(--muted)" }}>Top-10 finish required</div></div>
          <div><div className="cap">DROPPED WORST RESULTS</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{ch.dropWorst || "None"}</div>
            <div className="cap" style={{ color: "var(--muted)" }}>All rounds count</div></div>
          <div><div className="cap">MAX PER ROUND</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{ch.points[0] + ch.fl}</div>
            <div className="cap" style={{ color: "var(--muted)" }}>Win plus fastest lap</div></div>
        </div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>Preset library</div>
        <div className="cap" style={{ marginBottom: 14 }}>Apply to {ch.name}, or build your own scale below.</div>
        {S.pointsPresets.map(p => {
          const on = ch.points.join() === p.points.join() && ch.fl === p.fl;
          return <div key={p.id} className="card-flat"
            style={{ background: on ? "var(--elev)" : "transparent", border: "1px solid " + (on ? "var(--yellow)" : "var(--hair)"), padding: "12px 14px", marginBottom: 8 }}>
            <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}{!p.builtin && <span className="cap muted" style={{ marginLeft: 6 }}>custom</span>}</span>
              <div className="flex" style={{ gap: 6, alignItems: "center" }}>
                {on ? <span className="badge b-lock">Active</span> : <button className="btn btn-ghost btn-xs" onClick={() => run(setPointsScale, { championshipId: ch.id, points: p.points, fastestLapPoint: p.fl })}>Apply</button>}
                <button className="btn btn-ghost btn-xs" onClick={() => { setPRows(p.points.slice()); setPFl(p.fl); setPName(p.builtin ? "" : p.name); }}>Edit</button>
                {!p.builtin && <button className="btn btn-ghost btn-xs" onClick={() => run(deletePointsPreset, { id: p.id })}>Delete</button>}
              </div>
            </div>
            <div className="cap num" style={{ color: "var(--muted)" }}>{p.points.join(" · ")}{p.fl ? " · FL +" + p.fl : ""}</div>
          </div>; })}
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>Build a preset</div>
        <div className="cap" style={{ marginBottom: 14 }}>Set the value for each scoring position. Add or remove positions to change how deep the points go.</div>
        <label className="f">PRESET NAME</label>
        <input className="input" value={pName} onChange={e => setPName(e.target.value)} placeholder="FEAR house scale" />
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(72px,1fr))", gap: 8, margin: "14px 0" }}>
          {pRows.map((v, i) => <div key={i}>
            <label className="f" style={{ marginBottom: 3 }}>P{i + 1}</label>
            <input className="input num" style={{ height: 34, padding: "6px 8px", textAlign: "center" }} value={v}
              onChange={e => { const n = [...pRows]; n[i] = Number(e.target.value.replace(/[^\d]/g, "")) || 0; setPRows(n); }} /></div>)}
        </div>
        <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
          <button className="btn btn-ghost btn-xs" disabled={pRows.length >= 20} onClick={() => setPRows([...pRows, 0])}>Add position</button>
          <button className="btn btn-ghost btn-xs" disabled={pRows.length <= 1} onClick={() => setPRows(pRows.slice(0, -1))}>Remove last</button>
        </div>
        <label className="f">FASTEST LAP BONUS</label>
        <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
          {[0, 1, 2, 3].map(v => <button key={v} className={"btn btn-xs " + (pFl === v ? "btn-y" : "btn-ghost")} onClick={() => setPFl(v)}>{v === 0 ? "None" : "+" + v}</button>)}
        </div>
        <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", marginBottom: 14 }}>
          <div className="cap" style={{ marginBottom: 6 }}>PREVIEW</div>
          <div className="num" style={{ fontSize: 13 }}>{pRows.join(" · ")}{pFl ? " · FL +" + pFl : ""}</div>
          <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>Scores down to P{pRows.length} · max {pRows[0] + pFl} per round</div>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <button className="btn btn-2 btn-sm" style={{ flex: 1 }} disabled={!pName.trim()} onClick={() => { run(savePointsPreset, { name: pName.trim(), points: pRows, fastestLapPoint: pFl }); setPName(""); }}>Save preset</button>
          <button className="btn btn-y btn-sm" style={{ flex: 1 }} onClick={() => run(setPointsScale, { championshipId: ch.id, points: pRows, fastestLapPoint: pFl })}>Apply to {ch.name}</button>
        </div>
        <div className="cap" style={{ color: "var(--muted)", marginTop: 10 }}>Saved presets are available to every championship. Changing a live scale recalculates standings from every settled round and is logged.</div>
      </div>
    </div>}

    {ren !== null && <div className="modal-bg" onClick={() => setRen(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <h3 className="ttl-md">Rename championship</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 18px" }}>Updates the season name and both outright market titles. Standings, rounds, and open bets are untouched.</div>
      <label className="f">CHAMPIONSHIP NAME</label>
      <input className="input" value={ren} onChange={e => setRen(e.target.value)} />
      <div className="flex" style={{ gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setRen(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" disabled={!ren.trim()} onClick={() => { run(renameChampionship, { id: ch.id, name: ren.trim() }); setRen(null); }}>Save name</button></div>
    </div></div>}

    {rakeEdit !== null && <div className="modal-bg" onClick={() => setRakeEdit(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <h3 className="ttl-md">Edit rake</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 18px" }}>Applies to both the drivers' and constructors' outright markets. Existing bets and standings are untouched.</div>
      <label className="f">HOUSE RAKE %</label>
      <input className="input" value={rakeEdit} onChange={e => setRakeEdit(e.target.value.replace(/[^\d]/g, ""))} />
      <div className="flex" style={{ gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setRakeEdit(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" onClick={() => { run(setChampionshipRake, { championshipId: ch.id, rakePct: Number(rakeEdit) || 0 }); setRakeEdit(null); }}>Save rake</button></div>
    </div></div>}

    {tab === "standings" && <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Drivers' standings</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Driver</th><th>Team</th><th style={{ textAlign: "right" }}>Pts</th></tr></thead>
          <tbody>{[...S.roster].sort((a, b) => b.pts - a.pts).map((d, i) => <tr key={d.id} className="rowhov">
            <td className="num muted2">{i + 1}</td>
            <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={d} size={22} />{d.n}</div></td>
            <td className="muted2" style={{ fontSize: 13 }}>{d.t}</td>
            <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{d.pts}</td>
          </tr>)}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Constructors' standings</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th style={{ textAlign: "right" }}>Pts</th></tr></thead>
          <tbody>{[...S.teams].sort((a, b) => b.pts - a.pts).map((t, i) => <tr key={t.id} className="rowhov">
            <td className="num muted2">{i + 1}</td>
            <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={t} size={22} />{t.n}</div></td>
            <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{t.pts}</td>
          </tr>)}</tbody>
        </table></div>
      </div>
    </div>}
  </div>;
}

export function Check({ on, onClick }) {
  return <button onClick={onClick} style={{ width: 20, height: 20, borderRadius: 4, cursor: "pointer", display: "grid", placeItems: "center", background: on ? "var(--yellow)" : "transparent", border: on ? "0" : "1px solid var(--hair)", color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>{on ? "✓" : ""}</button>;
}
