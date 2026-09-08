"use client";
import { useState } from "react";
import { Dot } from "./UserScreens";
import { useServerAction } from "@/lib/useServerAction";
import { addDriver, editDriver, toggleDriverStatus, addTeam, editTeam, toggleTeamStatus } from "@/app/actions/roster";

const initials = n => n.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase() || "—";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function AdminRoster({ S }) {
  const run = useServerAction();
  const [tab, setTab] = useState("drivers");
  const [edit, setEdit] = useState(null);
  const [teamEdit, setTeamEdit] = useState(null);
  const [dForm, setDForm] = useState({ n: "", team: "", ab: "", status: "active" });
  const [tForm, setTForm] = useState({ n: "", ab: "", c: "#4b9cd3" });
  const active = S.roster.filter(d => d.status === "active");
  const startEdit = d => { setEdit(d.id); setDForm({ n: d.n, team: d.t, ab: d.ab, status: d.status }); setTab("drivers"); };
  const reset = () => { setEdit(null); setDForm({ n: "", team: "", ab: "", status: "active" }); };
  const startEditTeam = t => { setTeamEdit(t.id); setTForm({ n: t.n, ab: t.ab, c: t.c }); setTab("teams"); };
  const resetTeam = () => { setTeamEdit(null); setTForm({ n: "", ab: "", c: "#4b9cd3" }); };

  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">Roster</h2>
        <div className="muted" style={{ fontSize: 13 }}>{active.length} drivers on the active grid across {S.teams.filter(t => t.status === "active").length} teams. Changes apply to races created from now on — open markets keep the grid they launched with.</div></div>
      <div className="flex" style={{ gap: 6 }}>
        <button className={"pill-tab" + (tab === "drivers" ? " on" : "")} onClick={() => setTab("drivers")}>Drivers · {S.roster.length}</button>
        <button className={"pill-tab" + (tab === "teams" ? " on" : "")} onClick={() => setTab("teams")}>Teams · {S.teams.length}</button>
      </div>
    </div>

    {tab === "drivers" ? <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Drivers</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 40 }}></th><th>Driver</th><th>Team</th><th style={{ textAlign: "right" }}>Season pts</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
          <tbody>{S.roster.map(d => <tr key={d.id} className="rowhov">
            <td><Dot d={d} size={26} /></td>
            <td><div style={{ fontWeight: 500 }}>{d.n}</div><div className="cap">{d.ab}</div></td>
            <td className="muted2">{d.t}</td>
            <td className="num" style={{ textAlign: "right" }}>{d.pts}</td>
            <td style={{ textAlign: "right" }}><span className={"badge " + (d.status === "active" ? "b-open" : d.status === "reserve" ? "b-pend" : "b-set")}>{d.status}</span></td>
            <td style={{ textAlign: "right" }}><div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-xs" onClick={() => startEdit(d)}>Edit</button>
              <button className="btn btn-ghost btn-xs" onClick={() => run(toggleDriverStatus, { id: d.id })}>{d.status === "retired" ? "Reinstate" : "Retire"}</button>
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>{edit ? "Edit driver" : "Add driver"}</div>
        <div className="cap" style={{ marginBottom: 16 }}>{edit ? "Renaming a driver updates every market they appear in." : "New drivers join the active grid immediately."}</div>
        <div style={{ marginBottom: 12 }}><label className="f">FULL NAME</label>
          <input className="input" value={dForm.n} placeholder="Elena Sarkis" onChange={e => setDForm(f => ({ ...f, n: e.target.value, ab: f.ab || "" }))} /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 12 }}>
          <div><label className="f">TEAM</label>
            <select className="input" value={dForm.team} onChange={e => setDForm(f => ({ ...f, team: e.target.value }))}>
              <option value="">Select a team…</option>
              {S.teams.filter(t => t.status === "active").map(t => <option key={t.id} value={t.n}>{t.n}</option>)}
            </select></div>
          <div><label className="f">CODE</label>
            <input className="input" maxLength="3" value={dForm.ab} placeholder={initials(dForm.n)} onChange={e => setDForm(f => ({ ...f, ab: e.target.value.toUpperCase() }))} /></div>
        </div>
        <label className="f">GRID STATUS</label>
        <div className="flex" style={{ gap: 8, marginBottom: 16 }}>
          {["active", "reserve", "retired"].map(s => <button key={s} className={"btn btn-xs " + (dForm.status === s ? "btn-y" : "btn-ghost")} onClick={() => setDForm(f => ({ ...f, status: s }))}>{s}</button>)}
        </div>
        {dForm.n && dForm.team && <div className="card-flat" style={{ background: "var(--elev)", padding: 14, marginBottom: 16 }}>
          <div className="cap" style={{ marginBottom: 8 }}>PREVIEW</div>
          <div className="flex" style={{ gap: 10, alignItems: "center" }}>
            <Dot d={{ ab: dForm.ab || initials(dForm.n), c: (S.teams.find(t => t.n === dForm.team) || {}).c || "#555" }} />
            <div><div style={{ fontWeight: 500 }}>{dForm.n}</div><div className="cap">{dForm.team}</div></div></div>
        </div>}
        <button className="btn btn-y" style={{ width: "100%" }} disabled={!dForm.n.trim() || !dForm.team}
          onClick={() => {
            const team = S.teams.find(t => t.n === dForm.team);
            const args = { name: dForm.n, teamId: team?.id, abbr: dForm.ab || initials(dForm.n), status: dForm.status };
            run(edit ? editDriver : addDriver, edit ? { ...args, id: edit } : args);
            reset();
          }}>
          {edit ? "Save changes" : "Add to roster"}</button>
        {edit && <button className="btn btn-t btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={reset}>Cancel</button>}
      </div>
    </div> : <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Teams</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 40 }}></th><th>Team</th><th>Drivers</th><th style={{ textAlign: "right" }}>Season pts</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
          <tbody>{S.teams.map(t => { const ds = S.roster.filter(d => d.t === t.n && d.status !== "retired");
            return <tr key={t.id} className="rowhov">
              <td><Dot d={t} size={26} /></td>
              <td><div style={{ fontWeight: 500 }}>{t.n}</div><div className="cap">{t.ab}</div></td>
              <td className="muted2 wrapcell">{ds.length ? ds.map(d => <div key={d.id}>{d.n}</div>) : <span className="muted">No drivers assigned</span>}</td>
              <td className="num" style={{ textAlign: "right" }}>{t.pts}</td>
              <td style={{ textAlign: "right" }}><span className={"badge " + (t.status === "active" ? "b-open" : "b-set")}>{t.status}</span></td>
              <td style={{ textAlign: "right" }}><div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-xs" onClick={() => startEditTeam(t)}>Edit</button>
                <button className="btn btn-ghost btn-xs" onClick={() => run(toggleTeamStatus, { id: t.id })}>{t.status === "active" ? "Withdraw" : "Reinstate"}</button>
              </div></td>
            </tr>; })}</tbody>
        </table></div>
        <div className="cap" style={{ marginTop: 14, color: "var(--muted)" }}>Withdrawing a team keeps its historical results and settled bets intact — it only drops out of new constructor markets.</div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>{teamEdit ? "Edit team" : "Add team"}</div>
        <div className="cap" style={{ marginBottom: 16 }}>{teamEdit ? "Renaming a team updates every market and driver it appears on." : "Teams become selectable entrants in the Constructors' Championship."}</div>
        <div style={{ marginBottom: 12 }}><label className="f">TEAM NAME</label>
          <input className="input" value={tForm.n} placeholder="Cassius Autosport" onChange={e => setTForm(f => ({ ...f, n: e.target.value }))} /></div>
        <div style={{ marginBottom: 12 }}><label className="f">CODE</label>
          <input className="input" maxLength="3" value={tForm.ab} placeholder={initials(tForm.n)} onChange={e => setTForm(f => ({ ...f, ab: e.target.value.toUpperCase() }))} /></div>
        <label className="f">LIVERY COLOUR</label>
        <div className="flex" style={{ gap: 8, marginBottom: 16 }}>
          <input type="color" value={HEX_RE.test(tForm.c) ? tForm.c : "#000000"}
            onChange={e => setTForm(f => ({ ...f, c: e.target.value }))}
            style={{ width: 40, height: 40, padding: 0, border: "1px solid var(--hair)", borderRadius: 8, background: "none", cursor: "pointer" }} />
          <input className="input" value={tForm.c} placeholder="#4b9cd3"
            onChange={e => setTForm(f => ({ ...f, c: e.target.value }))} style={{ flex: 1 }} />
        </div>
        {tForm.n && <div className="card-flat" style={{ background: "var(--elev)", padding: 14, marginBottom: 16 }}>
          <div className="cap" style={{ marginBottom: 8 }}>PREVIEW</div>
          <div className="flex" style={{ gap: 10, alignItems: "center" }}>
            <Dot d={{ ab: tForm.ab || initials(tForm.n), c: tForm.c }} />
            <div style={{ fontWeight: 500 }}>{tForm.n}</div></div></div>}
        <button className="btn btn-y" style={{ width: "100%" }} disabled={!tForm.n.trim() || !HEX_RE.test(tForm.c)}
          onClick={() => {
            const args = { name: tForm.n, abbr: tForm.ab || initials(tForm.n), color: tForm.c };
            run(teamEdit ? editTeam : addTeam, teamEdit ? { ...args, id: teamEdit } : args);
            resetTeam();
          }}>{teamEdit ? "Save changes" : "Add team"}</button>
        {teamEdit && <button className="btn btn-t btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={resetTeam}>Cancel</button>}
      </div>
    </div>}
  </div>;
}
