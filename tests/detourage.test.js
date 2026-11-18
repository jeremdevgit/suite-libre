// SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit
// Tests des algorithmes de LibreMedias : node --test tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const D = require("../libremedias/algos.js");

function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// Flot maximal de référence (Edmonds-Karp sur matrice)
function edmondsKarp(n, src, snk, edges) {
  const S = n, T = n + 1, V = n + 2, c = Array.from({ length: V }, () => new Array(V).fill(0));
  for (let i = 0; i < n; i++) { c[S][i] += src[i]; c[i][T] += snk[i]; }
  for (const [u, v, f, b] of edges) { c[u][v] += f; c[v][u] += b; }
  let flow = 0;
  for (;;) {
    const prev = new Array(V).fill(-1); prev[S] = S;
    const q = [S];
    while (q.length && prev[T] === -1) { const u = q.shift(); for (let v = 0; v < V; v++) if (prev[v] === -1 && c[u][v] > 0) { prev[v] = u; q.push(v); } }
    if (prev[T] === -1) return flow;
    let b = Infinity;
    for (let v = T; v !== S; v = prev[v]) b = Math.min(b, c[prev[v]][v]);
    for (let v = T; v !== S; v = prev[v]) { c[prev[v]][v] -= b; c[v][prev[v]] += b; }
    flow += b;
  }
}

test("le flot maximal correspond à la référence sur des graphes aléatoires", () => {
  const r = rng(42);
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(r() * 14), E = Math.floor(r() * n * 3);
    const g = D.makeGraph(n, E), src = [], snk = [], edges = [];
    for (let i = 0; i < n; i++) { src.push(r() < 0.5 ? Math.floor(r() * 20) : 0); snk.push(r() < 0.5 ? Math.floor(r() * 20) : 0); g.tr[i] = src[i] - snk[i]; }
    for (let e = 0; e < E; e++) {
      const u = Math.floor(r() * n); let v = Math.floor(r() * n); if (v === u) v = (u + 1) % n;
      const f = Math.floor(r() * 15), b = Math.floor(r() * 15);
      const a = D.addEdge(g, u, v); g.cap[a] = f; g.cap[a + 1] = b; edges.push([u, v, f, b]);
    }
    const base = src.reduce((s, x, i) => s + Math.min(x, snk[i]), 0);
    const side = D.maxflow(g);
    assert.strictEqual(side.flow + base, edmondsKarp(n, src, snk, edges), "graphe " + t);
  }
});

function scene(w, h) {
  // Disque rouge texturé sur un fond bleu-vert en dégradé
  const px = new Uint8ClampedArray(w * h * 4), r = rng(3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w / 4) ** 2;
    const n = (r() - 0.5) * 30;
    if (inside) { px[p] = 200 + n; px[p + 1] = 60 + n; px[p + 2] = 50 + n; }
    else { px[p] = 40 + n; px[p + 1] = 120 + (y / h) * 80 + n; px[p + 2] = 160 + n; }
    px[p + 3] = 255;
  }
  return px;
}

test("GrabCut isole un sujet à l’intérieur d’un cadre", () => {
  const w = 80, h = 60, px = scene(w, h), tri = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tri[y * w + x] = x > 4 && x < w - 5 && y > 4 && y < h - 5 ? 2 : 0;
  const { lab } = D.grabcut(px, w, h, tri, 5);
  let err = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w / 4) ** 2; if (!!lab[y * w + x] !== inside) err++; }
  assert.ok(err < w * h * 0.02, "erreurs : " + err);
});

test("incrustation : le fond vert devient transparent, le sujet reste opaque et perd le reflet vert", () => {
  const px = new Uint8ClampedArray([0, 200, 0, 255, 220, 40, 40, 255, 120, 170, 110, 255]), a = new Float32Array(3);
  D.chromaKey(px, 3, [0, 200, 0], 0.25, 0.15, 1, a);
  assert.strictEqual(a[0], 0);
  assert.strictEqual(a[1], 1);
  assert.ok(px[9] <= 170, "vert réduit");
});

test("incrustation sur fond blanc (couleur non saturée)", () => {
  const px = new Uint8ClampedArray([250, 250, 250, 255, 30, 30, 30, 255]), a = new Float32Array(2);
  D.chromaKey(px, 2, [255, 255, 255], 0.1, 0.1, 0, a);
  assert.strictEqual(a[0], 0); assert.strictEqual(a[1], 1);
});

test("différence de fond", () => {
  const plate = new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 255]), img = new Uint8ClampedArray([12, 11, 9, 255, 200, 50, 40, 255]), a = new Float32Array(2);
  D.diffKey(img, plate, 2, 0.1, 0.1, a);
  assert.strictEqual(a[0], 0); assert.strictEqual(a[1], 1);
});

test("baguette : remplit la zone de même couleur sans franchir le bord", () => {
  const w = 10, h = 10, px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) { const p = (y * w + 5) * 4; px[p] = px[p + 1] = px[p + 2] = 0; }
  const m = D.floodFill(px, w, h, 1, 1, 0.1);
  assert.strictEqual(m.reduce((s, v) => s + v, 0), 50);
});

test("érosion, dilatation et nettoyage", () => {
  const w = 20, h = 20, a = new Float32Array(w * h);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) a[y * w + x] = 1;
  a[0] = 1; // tache isolée
  D.cleanMask(a, w, h, { islands: true, minFrac: 0.05 });
  assert.strictEqual(a[0], 0);
  const b = D.morph(a.slice(), w, h, -2);
  assert.strictEqual(b.reduce((s, v) => s + v, 0), 36);
  const c = D.morph(a.slice(), w, h, 1);
  assert.strictEqual(c.reduce((s, v) => s + v, 0), 144);
  a[10 * w + 10] = 0;
  D.cleanMask(a, w, h, { holes: true });
  assert.strictEqual(a[10 * w + 10], 1);
});

test("cadre de sortie au format carré centré sur le sujet", () => {
  const f = D.outputFrame(1000, 800, { x: 100, y: 200, w: 200, h: 400 }, "1:1", 0);
  assert.deepStrictEqual(f, { x: 0, y: 200, w: 400, h: 400 });
  assert.deepStrictEqual(D.outputFrame(1000, 800, null, "1:1", 0.1), { x: 0, y: 0, w: 1000, h: 800 });
});

test("filtre guidé : garde un masque déjà net", () => {
  const w = 30, h = 30, g = new Float32Array(w * h), p = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const x = i % w; g[i] = x < 15 ? 0.1 : 0.9; p[i] = x < 15 ? 0 : 1; }
  const q = D.guidedFilter(g, p, w, h, 3, 1e-4);
  assert.ok(q[10 * w + 5] < 0.05 && q[10 * w + 25] > 0.95);
});
