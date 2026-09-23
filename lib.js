import * as tf from "@tensorflow/tfjs";

/* ---------- localStorage auth (demo only: not real security) ---------- */
const USERS = "ra_users", SESSION = "ra_session";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const open = (u) => { const s = { id: u.id, name: u.name, email: u.email }; write(SESSION, s); return s; };

export const getSession = () => read(SESSION, null);
export const logout = () => localStorage.removeItem(SESSION);
export async function register(name, email, pw) {
  const users = read(USERS, []);
  if (users.some((u) => u.email === email)) throw new Error("This email is already registered");
  const u = { id: Date.now(), name, email, pw: await sha(pw), stats: { coins: 0, runner: 0, flyer: 0, cubes: 0, bestCube: null } };
  write(USERS, [...users, u]);
  return open(u);
}
export async function login(email, pw) {
  const u = read(USERS, []).find((x) => x.email === email);
  if (!u || u.pw !== (await sha(pw))) throw new Error("Wrong email or password");
  return open(u);
}
export const getStats = (id) => read(USERS, []).find((u) => u.id === id)?.stats;
export function saveStats(id, fn) {
  const users = read(USERS, []), i = users.findIndex((u) => u.id === id);
  users[i].stats = fn(users[i].stats);
  write(USERS, users);
  return users[i].stats;
}

/* ---------- vibration ---------- */
export const buzz = (p) => { if (localStorage.getItem("ra_vib") !== "off") navigator.vibrate?.(p); };

/* ---------- Rubik cube model: 54 stickers {p: cubie position, n: normal, c: colour} ---------- */
export const PAL = ["#f4f4f0", "#e4372c", "#2ea55b", "#f6c90e", "#f28a1e", "#2a6fdb"]; // U R F D L B
const NFACE = { "0,1,0": 0, "1,0,0": 1, "0,0,1": 2, "0,-1,0": 3, "-1,0,0": 4, "0,0,-1": 5 };
export const FACES = { U: [1, 1, -1], D: [1, -1, 1], R: [0, 1, -1], L: [0, -1, 1], F: [2, 1, -1], B: [2, -1, 1] }; // axis, layer, sign
export const MOVES = Object.keys(FACES).flatMap((f) => [f, f + "'"]);
export const inv = (m) => (m.endsWith("'") ? m[0] : m + "'");
const rot = (v, a, s) => (a === 0 ? [v[0], -s * v[2], s * v[1]] : a === 1 ? [s * v[2], v[1], -s * v[0]] : [-s * v[1], s * v[0], v[2]]);

export function newCube() {
  const c = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++)
    for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
      if (x * n[0] + y * n[1] + z * n[2] === 1) c.push({ p: [x, y, z], n, c: NFACE[n.join()] });
  return c;
}
export function move(cube, m) {
  const [a, l, s0] = FACES[m[0]], s = m.endsWith("'") ? -s0 : s0;
  return cube.map((t) => (t.p[a] === l ? { ...t, p: rot(t.p, a, s), n: rot(t.n, a, s) } : t));
}
const RC = [
  (p) => [p[2] + 1, p[0] + 1], (p) => [1 - p[1], 1 - p[2]], (p) => [1 - p[1], p[0] + 1],
  (p) => [1 - p[2], p[0] + 1], (p) => [1 - p[1], p[2] + 1], (p) => [1 - p[1], 1 - p[0]],
];
export function grid(cube) { // 54 colour ids laid out as unfolded net: face*9 + row*3 + col
  const g = Array(54).fill(0);
  for (const t of cube) { const f = NFACE[t.n.join()], [r, c] = RC[f](t.p); g[f * 9 + r * 3 + c] = t.c; }
  return g;
}
export const isSolved = (g) => g.every((v, i) => v === Math.floor(i / 9));
export function scramble(n) {
  const seq = [];
  while (seq.length < n) {
    const m = MOVES[Math.floor(Math.random() * 12)];
    if (!seq.length || seq[seq.length - 1][0] !== m[0]) seq.push(m);
  }
  return seq;
}

/* ---------- TensorFlow.js: tiny "next move" network ---------- */
let model;
const enc = (g) => { const v = new Float32Array(324); g.forEach((c, i) => (v[i * 6 + c] = 1)); return v; };

export async function trainModel(onProgress) {
  const N = 9000, X = new Float32Array(N * 324), Y = [];
  for (let i = 0; i < N; i++) {
    const d = 1 + (i % 3), seq = scramble(d);
    let c = newCube();
    seq.forEach((m) => (c = move(c, m)));
    X.set(enc(grid(c)), i * 324);
    Y.push(MOVES.indexOf(inv(seq[d - 1]))); // label = undo the last scramble move
  }
  model?.dispose();
  model = tf.sequential({ layers: [
    tf.layers.dense({ inputShape: [324], units: 256, activation: "relu" }),
    tf.layers.dense({ units: 128, activation: "relu" }),
    tf.layers.dense({ units: 12, activation: "softmax" }),
  ] });
  model.compile({ optimizer: tf.train.adam(0.003), loss: "categoricalCrossentropy" });
  const xs = tf.tensor2d(X, [N, 324]), ys = tf.oneHot(tf.tensor1d(Y, "int32"), 12);
  const E = 25;
  await model.fit(xs, ys, { epochs: E, batchSize: 64, shuffle: true, callbacks: { onEpochEnd: (e) => onProgress((e + 1) / E) } });
  xs.dispose(); ys.dispose();
}
export const suggest = (cube) =>
  model ? tf.tidy(() => MOVES[model.predict(tf.tensor2d([enc(grid(cube))])).argMax(1).dataSync()[0]]) : null;
