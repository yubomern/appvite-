import { useState } from "react";
import { getSession, register, login, logout, getStats, saveStats } from "./lib";
import { Rubik, Runner, Flyer } from "./Games";
import MapZone from "./MapZone";

const NAV = [["dash", "Dashboard", "#f4f4f0"], ["rubik", "Rubik cube", "#e4372c"], ["runner", "Infinite runner", "#2a6fdb"], ["flyer", "Coin flyer", "#f6c90e"], ["map", "My zone", "#2ea55b"]];

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login"), [f, setF] = useState({ name: "", email: "", pw: "" }), [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (mode === "register") {
        if (f.pw.length < 6) throw new Error("Password needs at least 6 characters");
        onAuth(await register(f.name.trim() || "Player", f.email.trim().toLowerCase(), f.pw));
      } else onAuth(await login(f.email.trim().toLowerCase(), f.pw));
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth">
      <form onSubmit={submit}>
        <h1>Rubik Arcade</h1>
        <div className="row">
          <button type="button" className={mode === "login" ? "chip on" : "chip"} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={mode === "register" ? "chip on" : "chip"} onClick={() => setMode("register")}>Create account</button>
        </div>
        {mode === "register" && <input placeholder="Name" value={f.name} onChange={set("name")} />}
        <input type="email" placeholder="Email" required value={f.email} onChange={set("email")} />
        <input type="password" placeholder="Password" required value={f.pw} onChange={set("pw")} />
        {err && <p className="err">{err}</p>}
        <button className="primary">{mode === "login" ? "Log in" : "Create account"}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(getSession), [stats, setStats] = useState(() => user && getStats(user.id)), [view, setView] = useState("dash");
  const [vib, setVib] = useState(localStorage.getItem("ra_vib") !== "off");
  const enter = (u) => { setUser(u); setStats(getStats(u.id)); setView("dash"); };
  const upd = (fn) => setStats(saveStats(user.id, fn));
  if (!user || !stats) return <Auth onAuth={enter} />;
  const toggleVib = () => { const v = !vib; localStorage.setItem("ra_vib", v ? "on" : "off"); setVib(v); if (v) navigator.vibrate?.(60); };

  return (
    <div className="app">
      <aside>
        <h1>Rubik Arcade</h1>
        <nav>
          {NAV.map(([id, label, color]) => (
            <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}><i style={{ background: color }} />{label}</button>
          ))}
        </nav>
        <div className="foot">
          <button onClick={toggleVib}>Vibration: {vib ? "on" : "off"}</button>
          <span>{user.name}</span>
          <button onClick={() => { logout(); setUser(null); }}>Log out</button>
        </div>
      </aside>
      <main>
        {view === "dash" && (
          <section className="panel">
            <header><h2>Hello, {user.name}</h2><b>{stats.coins} coins</b></header>
            <div className="tiles">
              <div><small>Best run</small><strong>{stats.runner} m</strong></div>
              <div><small>Best flight</small><strong>{stats.flyer} m</strong></div>
              <div><small>Cubes solved</small><strong>{stats.cubes}</strong></div>
              <div><small>Fastest cube</small><strong>{stats.bestCube ? `${stats.bestCube}s` : "—"}</strong></div>
            </div>
            <div className="row">
              {NAV.slice(1).map(([id, label]) => <button key={id} className="primary" onClick={() => setView(id)}>{label}</button>)}
            </div>
          </section>
        )}
        {view === "rubik" && <Rubik upd={upd} />}
        {view === "runner" && <Runner upd={upd} />}
        {view === "flyer" && <Flyer upd={upd} />}
        {view === "map" && <MapZone go={setView} />}
      </main>
    </div>
  );
}
