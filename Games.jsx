import { useEffect, useRef, useState } from "react";
import { PAL, FACES, newCube, move, grid, isSolved, scramble, inv, trainModel, suggest, buzz } from "./lib";

/* ============================ RUBIK CUBE ============================ */
const LEVELS = { easy: { n: 3, coins: 5 }, medium: { n: 8, coins: 15 }, hard: { n: 20, coins: 40 }, expert: { n: 30, coins: 80 } };
const POS = [[0, 1], [1, 2], [1, 1], [2, 1], [1, 0], [1, 3]]; // U R F D L B in the unfolded net
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Rubik({ upd }) {
  const [lvl, setLvl] = useState("easy"), [cube, setCube] = useState(newCube), [moves, setMoves] = useState(0);
  const [t, setT] = useState(0), [run, setRun] = useState(false), [auto, setAuto] = useState(false);
  const [ai, setAi] = useState(null), [hint, setHint] = useState(""), [won, setWon] = useState(false);
  const hist = useRef([]), assisted = useRef(false);

  const newGame = (l = lvl) => {
    let c = newCube();
    const seq = scramble(LEVELS[l].n);
    seq.forEach((m) => (c = move(c, m)));
    hist.current = seq; assisted.current = false;
    setLvl(l); setCube(c); setMoves(0); setT(0); setWon(false); setHint(""); setAuto(false); setRun(true);
  };
  const play = (m) => {
    if (auto) return;
    const h = hist.current;
    if (h.length && h[h.length - 1] === inv(m)) h.pop(); else h.push(m);
    setCube((c) => move(c, m)); setMoves((n) => n + 1); setHint(""); buzz(12);
  };

  useEffect(() => { if (!run) return; const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id); }, [run]);
  useEffect(() => {
    if (run && isSolved(grid(cube))) {
      setRun(false); setWon(true); setAuto(false); buzz([80, 40, 80, 40, 200]);
      if (!assisted.current) upd((s) => ({ ...s, cubes: s.cubes + 1, coins: s.coins + LEVELS[lvl].coins, bestCube: s.bestCube ? Math.min(s.bestCube, t) : t }));
    }
  }, [cube]);
  useEffect(() => { // auto-solve: replay the move history backwards
    if (!auto) return;
    const id = setInterval(() => {
      const m = hist.current.pop();
      if (!m) return setAuto(false);
      setCube((c) => move(c, inv(m))); setMoves((n) => n + 1); buzz(10);
    }, 220);
    return () => clearInterval(id);
  }, [auto]);
  useEffect(() => {
    const k = (e) => { const m = e.key.toUpperCase(); if (FACES[m] && !e.ctrlKey && !e.metaKey) play(e.shiftKey ? m + "'" : m); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const g = grid(cube);
  const train = async () => { setAi(0); await trainModel(setAi); setAi("ready"); };
  const ask = () => { assisted.current = true; setHint(suggest(cube)); };

  return (
    <section className="panel">
      <header><h2>Rubik cube</h2><b>{fmt(t)} · {moves} moves</b></header>
      <div className="row">
        {Object.keys(LEVELS).map((l) => (
          <button key={l} className={l === lvl ? "chip on" : "chip"} onClick={() => newGame(l)}>{l} <small>{LEVELS[l].n}</small></button>
        ))}
      </div>
      <div className="net">
        {[0, 1, 2, 3, 4, 5].map((f) => (
          <div key={f} className="face" style={{ gridRow: POS[f][0] + 1, gridColumn: POS[f][1] + 1 }}>
            {g.slice(f * 9, f * 9 + 9).map((c, i) => <i key={i} style={{ background: PAL[c] }} />)}
          </div>
        ))}
      </div>
      {won && <p className="win">Solved in {fmt(t)} with {moves} moves{assisted.current ? " (assisted — no reward)" : ` — +${LEVELS[lvl].coins} coins`}.</p>}
      <div className="moves">
        {Object.keys(FACES).flatMap((f) => [f, f + "'"]).map((m) => (
          <button key={m} onClick={() => play(m)} style={{ borderBottomColor: PAL["URFDLB".indexOf(m[0])] }}>{m}</button>
        ))}
      </div>
      <div className="row">
        <button className="primary" onClick={() => newGame()}>New scramble</button>
        <button onClick={() => { assisted.current = true; setAuto(!auto); }} disabled={!run}>{auto ? "Stop" : "Auto solve"}</button>
        <button onClick={train} disabled={typeof ai === "number"}>
          {ai === null ? "Train AI" : ai === "ready" ? "Retrain AI" : `Training ${Math.round(ai * 100)}%`}
        </button>
        <button onClick={ask} disabled={ai !== "ready" || !run}>AI hint</button>
        {hint && <button className="chip on" onClick={() => play(hint)}>Play {hint}</button>}
      </div>
      <p className="muted">Keys: U D R L F B (Shift = counter-clockwise). Auto solve replays your move history in reverse, so it works at any depth. The TF.js model learns from 1–3 move scrambles, so its hints are reliable only when the cube is that close to solved.</p>
    </section>
  );
}

/* ============================ ARCADE SHELL ============================ */
function Arcade({ title, hint, game, onEnd }) {
  const ref = useRef(), [run, setRun] = useState(0), [hud, setHud] = useState(""), [over, setOver] = useState(null);
  useEffect(() => {
    setOver(null); setHud("");
    const cv = ref.current; cv.width = 720; cv.height = 320;
    return game(cv.getContext("2d"), cv, { hud: setHud, end: (r) => { setOver(r); onEnd(r); buzz([120, 60, 220]); } });
  }, [run]);
  return (
    <section className="panel">
      <header><h2>{title}</h2><b>{hud}</b></header>
      <div className="stage">
        <canvas ref={ref} onContextMenu={(e) => e.preventDefault()} />
        {over && <div className="over"><h3>{over.text}</h3><button className="primary" onClick={() => setRun(run + 1)}>Play again</button></div>}
      </div>
      <p className="muted">{hint}</p>
    </section>
  );
}

/* ---------- infinite runner ---------- */
const runnerGame = (x, cv, api) => {
  const W = 720, H = 320, G = 280;
  let y = G, vy = 0, obs = [], s = 0, raf;
  const jump = () => { if (y >= G) { vy = -13.5; buzz(10); } };
  const key = (e) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); } };
  addEventListener("keydown", key); cv.addEventListener("pointerdown", jump);
  let f = 0;
  const loop = () => {
    const sp = 6 + s / 300; f++;
    vy += 0.75; y = Math.min(G, y + vy); if (y === G) vy = 0;
    s += sp / 8;
    const last = obs[obs.length - 1];
    if (!last || last.x < W - 280 - Math.random() * 220) obs.push({ x: W, w: 22 + Math.random() * 22, h: 32 + Math.random() * 36 });
    obs.forEach((o) => (o.x -= sp)); obs = obs.filter((o) => o.x > -60);
    x.fillStyle = "#e9eef7"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#1b2340"; x.fillRect(0, G, W, 4);
    x.fillStyle = "#2a6fdb"; x.fillRect(60, y - 34, 34, 34);
    x.fillStyle = "#e4372c"; obs.forEach((o) => x.fillRect(o.x, G - o.h, o.w, o.h));
    if (obs.some((o) => 94 > o.x && 60 < o.x + o.w && y > G - o.h)) return api.end({ score: Math.floor(s), text: `Crashed after ${Math.floor(s)} m` });
    if (f % 6 === 0) api.hud(`${Math.floor(s)} m`);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { cancelAnimationFrame(raf); removeEventListener("keydown", key); cv.removeEventListener("pointerdown", jump); };
};
export const Runner = ({ upd }) => (
  <Arcade title="Infinite runner" hint="Space, ↑ or tap to jump. The road speeds up the longer you survive."
    game={runnerGame} onEnd={(r) => upd((s) => ({ ...s, runner: Math.max(s.runner, r.score) }))} />
);

/* ---------- infinite flyer with coins ---------- */
const flyerGame = (x, cv, api) => {
  const W = 720, H = 320;
  let y = 160, vy = 0, up = false, pipes = [], coins = 0, s = 0, f = 0, raf;
  const on = () => (up = true), off = () => (up = false);
  const kd = (e) => { if (e.code === "Space") { e.preventDefault(); up = true; } }, ku = (e) => { if (e.code === "Space") up = false; };
  addEventListener("keydown", kd); addEventListener("keyup", ku); cv.addEventListener("pointerdown", on); addEventListener("pointerup", off);
  const loop = () => {
    const sp = 3.2 + s / 900; f++;
    vy = Math.max(-5, Math.min(5, vy + (up ? -0.45 : 0.3))); y += vy; s += sp / 6;
    if (f % Math.round(300 / sp) === 1) pipes.push({ x: W, top: 30 + Math.random() * (H - 190), gap: 120, got: false });
    pipes.forEach((p) => (p.x -= sp)); pipes = pipes.filter((p) => p.x > -60);
    x.fillStyle = "#e9eef7"; x.fillRect(0, 0, W, H);
    let hit = y < 12 || y > H - 12;
    pipes.forEach((p) => {
      x.fillStyle = "#1b2340"; x.fillRect(p.x, 0, 50, p.top); x.fillRect(p.x, p.top + p.gap, 50, H);
      const cx = p.x + 25, cy = p.top + p.gap / 2;
      if (!p.got) {
        x.fillStyle = "#f6c90e"; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill();
        if (Math.hypot(80 - cx, y - cy) < 22) { p.got = true; coins++; buzz(25); }
      }
      if (92 > p.x && 68 < p.x + 50 && (y - 10 < p.top || y + 10 > p.top + p.gap)) hit = true;
    });
    x.fillStyle = "#e4372c"; x.beginPath(); x.arc(80, y, 11, 0, 7); x.fill();
    if (hit) return api.end({ score: Math.floor(s), coins, text: `Landed after ${Math.floor(s)} m with ${coins} coins` });
    if (f % 6 === 0) api.hud(`${Math.floor(s)} m · ${coins} coins`);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); cv.removeEventListener("pointerdown", on); removeEventListener("pointerup", off); };
};
export const Flyer = ({ upd }) => (
  <Arcade title="Coin flyer" hint="Hold Space or press the screen to climb, release to fall. Fly through the gaps and grab the coins."
    game={flyerGame} onEnd={(r) => upd((s) => ({ ...s, flyer: Math.max(s.flyer, r.score), coins: s.coins + r.coins }))} />
);
