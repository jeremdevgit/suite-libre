/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreDetour : algorithmes de détourage, sans dépendance et sans réseau.
// - Sujet automatique / cadre : GrabCut (modèles de couleurs + coupe minimale de graphe, algorithme de Boykov-Kolmogorov)
// - Fond uni ou fond vert : incrustation par distance de chrominance, avec suppression du débordement de couleur
// - Fond connu : différence avec une image du fond seul
// - Affinage : filtre guidé (bords fins), érosion/dilatation, adoucissement, nettoyage des taches, décontamination
(function (root) {
  "use strict";

  // =====================================================================
  // Coupe minimale / flot maximal (Boykov-Kolmogorov) sur entiers
  // =====================================================================
  const TERMINAL = -2, ORPHAN = -3, FREE = -1;

  // Graphe à topologie fixe : arcs appariés (a et a ^ 1 sont l'aller et le retour)
  function makeGraph(N, E) {
    return { N, E, first: new Int32Array(N).fill(-1), next: new Int32Array(2 * E), head: new Int32Array(2 * E), cap: new Int32Array(2 * E), tr: new Int32Array(N), n: 0 };
  }
  function addEdge(g, u, v) {
    const a = 2 * g.n++;
    g.head[a] = v; g.next[a] = g.first[u]; g.first[u] = a;
    g.head[a + 1] = u; g.next[a + 1] = g.first[v]; g.first[v] = a + 1;
    return a;
  }

  // Calcule le flot maximal ; renvoie 1 pour les nœuds du côté de la source.
  // g.cap et g.tr sont consommés (capacités résiduelles).
  function maxflow(g) {
    const { N, first, next, head, cap, tr } = g;
    const parent = new Int32Array(N).fill(FREE), sink = new Uint8Array(N), ts = new Int32Array(N), dist = new Int32Array(N);
    const Q = N + 1, q = new Int32Array(Q), inq = new Uint8Array(N);
    let qh = 0, qt = 0;
    const push = (i) => { if (!inq[i]) { inq[i] = 1; q[qt] = i; qt = qt + 1 === Q ? 0 : qt + 1; } };
    const pop = () => {
      while (qh !== qt) { const i = q[qh]; qh = qh + 1 === Q ? 0 : qh + 1; inq[i] = 0; if (parent[i] !== FREE) return i; }
      return -1;
    };
    const oq = new Int32Array(Q);
    let oh = 0, ot = 0;
    const orphan = (i) => { parent[i] = ORPHAN; oq[ot] = i; ot = ot + 1 === Q ? 0 : ot + 1; };

    for (let i = 0; i < N; i++) {
      if (tr[i] > 0) { parent[i] = TERMINAL; sink[i] = 0; dist[i] = 1; push(i); }
      else if (tr[i] < 0) { parent[i] = TERMINAL; sink[i] = 1; dist[i] = 1; push(i); }
    }
    let time = 0, flow = 0, cur = -1;

    function augment(mid) {
      let b = cap[mid], i = head[mid ^ 1];
      while (parent[i] !== TERMINAL) { const a = parent[i]; if (cap[a ^ 1] < b) b = cap[a ^ 1]; i = head[a]; }
      if (tr[i] < b) b = tr[i];
      i = head[mid];
      while (parent[i] !== TERMINAL) { const a = parent[i]; if (cap[a] < b) b = cap[a]; i = head[a]; }
      if (-tr[i] < b) b = -tr[i];
      cap[mid ^ 1] += b; cap[mid] -= b;
      i = head[mid ^ 1];
      while (parent[i] !== TERMINAL) { const a = parent[i]; cap[a] += b; cap[a ^ 1] -= b; if (!cap[a ^ 1]) orphan(i); i = head[a]; }
      tr[i] -= b; if (!tr[i]) orphan(i);
      i = head[mid];
      while (parent[i] !== TERMINAL) { const a = parent[i]; cap[a ^ 1] += b; cap[a] -= b; if (!cap[a]) orphan(i); i = head[a]; }
      tr[i] += b; if (!tr[i]) orphan(i);
      flow += b;
    }

    function adopt(i) {
      const isS = sink[i];
      let aMin = -1, dMin = 0x7fffffff;
      for (let a0 = first[i]; a0 !== -1; a0 = next[a0]) {
        if (!(isS ? cap[a0] : cap[a0 ^ 1])) continue;
        let j = head[a0];
        if (sink[j] !== isS || parent[j] === FREE) continue;
        let d = 0;
        for (;;) {
          if (ts[j] === time) { d += dist[j]; break; }
          const a = parent[j]; d++;
          if (a === TERMINAL) { ts[j] = time; dist[j] = 1; break; }
          if (a === ORPHAN) { d = 0x7fffffff; break; }
          j = head[a];
        }
        if (d < 0x7fffffff) {
          if (d < dMin) { aMin = a0; dMin = d; }
          for (j = head[a0]; ts[j] !== time; j = head[parent[j]]) { ts[j] = time; dist[j] = d--; }
        }
      }
      if (aMin !== -1) { parent[i] = aMin; ts[i] = time; dist[i] = dMin + 1; return; }
      for (let a0 = first[i]; a0 !== -1; a0 = next[a0]) {
        const j = head[a0];
        if (sink[j] !== isS) continue;
        const a = parent[j];
        if (a === FREE) continue;
        if (isS ? cap[a0] : cap[a0 ^ 1]) push(j);
        if (a !== TERMINAL && a !== ORPHAN && head[a] === i) orphan(j);
      }
      parent[i] = FREE;
    }

    for (;;) {
      let i = cur;
      if (i !== -1 && parent[i] === FREE) i = -1;
      if (i === -1) { i = pop(); if (i === -1) break; }
      let mid = -1;
      if (!sink[i]) {
        for (let a = first[i]; a !== -1; a = next[a]) {
          if (!cap[a]) continue;
          const j = head[a];
          if (parent[j] === FREE) { sink[j] = 0; parent[j] = a ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; push(j); }
          else if (sink[j]) { mid = a; break; }
          else if (ts[j] <= ts[i] && dist[j] > dist[i]) { parent[j] = a ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; }
        }
      } else {
        for (let a = first[i]; a !== -1; a = next[a]) {
          if (!cap[a ^ 1]) continue;
          const j = head[a];
          if (parent[j] === FREE) { sink[j] = 1; parent[j] = a ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; push(j); }
          else if (!sink[j]) { mid = a ^ 1; break; }
          else if (ts[j] <= ts[i] && dist[j] > dist[i]) { parent[j] = a ^ 1; ts[j] = ts[i]; dist[j] = dist[i] + 1; }
        }
      }
      time++;
      if (mid !== -1) {
        cur = i;
        augment(mid);
        while (oh !== ot) { const o = oq[oh]; oh = oh + 1 === Q ? 0 : oh + 1; adopt(o); }
      } else cur = -1;
    }
    const side = new Uint8Array(N);
    for (let i = 0; i < N; i++) side[i] = parent[i] !== FREE && !sink[i] ? 1 : 0;
    side.flow = flow;
    return side;
  }

  // =====================================================================
  // Modèles de couleurs (mélanges de gaussiennes)
  // =====================================================================
  const K = 5;
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

  function newGmm() { return { w: new Float64Array(K), m: new Float64Array(K * 3), inv: new Float64Array(K * 9), lnorm: new Float64Array(K), n: 0 }; }

  // Ajuste le modèle k sur les pixels dont comp[i] === k et lab[i] === want
  function fitGmm(gm, px, idx, comp) {
    const s = new Float64Array(K), sm = new Float64Array(K * 3), sc = new Float64Array(K * 9);
    for (let t = 0; t < idx.length; t++) {
      const i = idx[t], k = comp[i], r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
      s[k]++; sm[k * 3] += r; sm[k * 3 + 1] += g; sm[k * 3 + 2] += b;
      const c = k * 9;
      sc[c] += r * r; sc[c + 1] += r * g; sc[c + 2] += r * b; sc[c + 4] += g * g; sc[c + 5] += g * b; sc[c + 8] += b * b;
    }
    gm.n = idx.length;
    for (let k = 0; k < K; k++) {
      const n = s[k];
      gm.w[k] = idx.length ? n / idx.length : 0;
      if (!n) { gm.lnorm[k] = -Infinity; continue; }
      const mr = sm[k * 3] / n, mg = sm[k * 3 + 1] / n, mb = sm[k * 3 + 2] / n;
      gm.m[k * 3] = mr; gm.m[k * 3 + 1] = mg; gm.m[k * 3 + 2] = mb;
      const c = k * 9, reg = 4;
      const a = sc[c] / n - mr * mr + reg, bq = sc[c + 1] / n - mr * mg, cq = sc[c + 2] / n - mr * mb;
      const d = sc[c + 4] / n - mg * mg + reg, e = sc[c + 5] / n - mg * mb, f = sc[c + 8] / n - mb * mb + reg;
      // Inverse d'une matrice symétrique 3×3 [a b c; b d e; c e f]
      const A = d * f - e * e, B = -(bq * f - cq * e), C = bq * e - cq * d;
      let det = a * A + bq * B + cq * C;
      if (!(det > 1e-6)) det = 1e-6;
      const D = a * f - cq * cq, E = -(a * e - bq * cq), F = a * d - bq * bq;
      const inv = gm.inv;
      inv[c] = A / det; inv[c + 1] = B / det; inv[c + 2] = C / det;
      inv[c + 3] = B / det; inv[c + 4] = D / det; inv[c + 5] = E / det;
      inv[c + 6] = C / det; inv[c + 7] = E / det; inv[c + 8] = F / det;
      gm.lnorm[k] = Math.log(gm.w[k]) - 0.5 * Math.log(det);
    }
  }
  function compLog(gm, k, r, g, b) {
    const c = k * 9, inv = gm.inv, dr = r - gm.m[k * 3], dg = g - gm.m[k * 3 + 1], db = b - gm.m[k * 3 + 2];
    const q = dr * (inv[c] * dr + inv[c + 1] * dg + inv[c + 2] * db) + dg * (inv[c + 3] * dr + inv[c + 4] * dg + inv[c + 5] * db) + db * (inv[c + 6] * dr + inv[c + 7] * dg + inv[c + 8] * db);
    return gm.lnorm[k] - 0.5 * q;
  }
  // -log de la vraisemblance (somme des composantes, calcul stable)
  function nll(gm, r, g, b) {
    let mx = -Infinity;
    const l = [0, 0, 0, 0, 0];
    for (let k = 0; k < K; k++) { l[k] = gm.lnorm[k] === -Infinity ? -Infinity : compLog(gm, k, r, g, b); if (l[k] > mx) mx = l[k]; }
    if (mx === -Infinity) return 50;
    let s = 0;
    for (let k = 0; k < K; k++) if (l[k] !== -Infinity) s += Math.exp(l[k] - mx);
    return -(mx + Math.log(s));
  }
  function bestComp(gm, r, g, b) {
    let best = 0, bv = -Infinity;
    for (let k = 0; k < K; k++) { if (gm.lnorm[k] === -Infinity) continue; const v = compLog(gm, k, r, g, b); if (v > bv) { bv = v; best = k; } }
    return best;
  }
  // Initialisation des composantes par k-moyennes sur un échantillon
  function kmeansInit(px, idx, comp, seed) {
    if (!idx.length) return;
    const rnd = rng(seed), S = Math.min(idx.length, 6000), sample = new Int32Array(S);
    for (let t = 0; t < S; t++) sample[t] = idx[Math.floor(rnd() * idx.length)];
    const c = new Float64Array(K * 3);
    // k-means++ simplifié
    let p = sample[0];
    c[0] = px[p * 3]; c[1] = px[p * 3 + 1]; c[2] = px[p * 3 + 2];
    const dmin = new Float64Array(S).fill(Infinity);
    for (let k = 1; k < K; k++) {
      let tot = 0;
      for (let t = 0; t < S; t++) {
        const i = sample[t], dr = px[i * 3] - c[(k - 1) * 3], dg = px[i * 3 + 1] - c[(k - 1) * 3 + 1], db = px[i * 3 + 2] - c[(k - 1) * 3 + 2];
        const d = dr * dr + dg * dg + db * db; if (d < dmin[t]) dmin[t] = d; tot += dmin[t];
      }
      let r = rnd() * tot, t = 0;
      while (t < S - 1 && (r -= dmin[t]) > 0) t++;
      p = sample[t];
      c[k * 3] = px[p * 3]; c[k * 3 + 1] = px[p * 3 + 1]; c[k * 3 + 2] = px[p * 3 + 2];
    }
    const near = (i) => {
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) { const dr = px[i * 3] - c[k * 3], dg = px[i * 3 + 1] - c[k * 3 + 1], db = px[i * 3 + 2] - c[k * 3 + 2], d = dr * dr + dg * dg + db * db; if (d < bd) { bd = d; best = k; } }
      return best;
    };
    for (let it = 0; it < 6; it++) {
      const s = new Float64Array(K * 4);
      for (let t = 0; t < S; t++) { const i = sample[t], k = near(i); s[k * 4] += px[i * 3]; s[k * 4 + 1] += px[i * 3 + 1]; s[k * 4 + 2] += px[i * 3 + 2]; s[k * 4 + 3]++; }
      for (let k = 0; k < K; k++) if (s[k * 4 + 3]) { c[k * 3] = s[k * 4] / s[k * 4 + 3]; c[k * 3 + 1] = s[k * 4 + 1] / s[k * 4 + 3]; c[k * 3 + 2] = s[k * 4 + 2] / s[k * 4 + 3]; }
    }
    for (let t = 0; t < idx.length; t++) comp[idx[t]] = near(idx[t]);
  }

  // =====================================================================
  // GrabCut
  // =====================================================================
  // rgba : Uint8ClampedArray (w*h*4) ; tri : Uint8Array, 0 = fond sûr, 1 = fond probable, 2 = sujet probable, 3 = sujet sûr
  // state (facultatif) : résultat précédent, pour reprendre après des retouches
  // Renvoie { lab: Uint8Array (1 = sujet), state }
  function grabcut(rgba, w, h, tri, iters, state) {
    const N = w * h, px = new Float64Array(N * 3);
    for (let i = 0; i < N; i++) { px[i * 3] = rgba[i * 4]; px[i * 3 + 1] = rgba[i * 4 + 1]; px[i * 3 + 2] = rgba[i * 4 + 2]; }
    const lab = new Uint8Array(N);
    if (state && state.lab && state.lab.length === N) {
      for (let i = 0; i < N; i++) lab[i] = tri[i] === 0 ? 0 : tri[i] === 3 ? 1 : state.lab[i];
    } else for (let i = 0; i < N; i++) lab[i] = tri[i] >= 2 ? 1 : 0;

    // Liens entre voisins (8-connexité), pondérés par le contraste
    let g = state && state.g && state.g.N === N ? state.g : null, wts = g ? state.wts : null;
    if (!g) {
      let sum = 0, cnt = 0;
      const d2 = (a, b) => { const r = px[a * 3] - px[b * 3], gg = px[a * 3 + 1] - px[b * 3 + 1], bb = px[a * 3 + 2] - px[b * 3 + 2]; return r * r + gg * gg + bb * bb; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x + 1 < w) { sum += d2(i, i + 1); cnt++; }
        if (y + 1 < h) { sum += d2(i, i + w); cnt++; if (x + 1 < w) { sum += d2(i, i + w + 1); cnt++; } if (x > 0) { sum += d2(i, i + w - 1); cnt++; } }
      }
      const beta = sum > 0 ? cnt / (2 * sum) : 0, gamma = 50, S = 100;
      g = makeGraph(N, 4 * N);
      const tmp = [];
      const link = (i, j, dd) => { addEdge(g, i, j); tmp.push(Math.max(1, Math.round((S * gamma * Math.exp(-beta * d2(i, j))) / dd))); };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x + 1 < w) link(i, i + 1, 1);
        if (y + 1 < h) { link(i, i + w, 1); if (x + 1 < w) link(i, i + w + 1, Math.SQRT2); if (x > 0) link(i, i + w - 1, Math.SQRT2); }
      }
      wts = Int32Array.from(tmp);
    }

    const fgm = (state && state.fgm) || newGmm(), bgm = (state && state.bgm) || newGmm(), comp = new Uint8Array(N);
    const fgIdx = [], bgIdx = [];
    const split = () => { fgIdx.length = 0; bgIdx.length = 0; for (let i = 0; i < N; i++) (lab[i] ? fgIdx : bgIdx).push(i); };
    split();
    if (!fgIdx.length || !bgIdx.length) return { lab, state: null };
    if (!(state && state.fgm)) {
      kmeansInit(px, fgIdx, comp, 7); kmeansInit(px, bgIdx, comp, 13);
      fitGmm(fgm, px, fgIdx, comp); fitGmm(bgm, px, bgIdx, comp);
    }
    const HARD = 1 << 26, SCALE = 100, resume = !!(state && state.fgm);
    for (let it = 0; it < iters; it++) {
      // Composantes puis modèles
      // Après des retouches, les modèles déjà appris sont gardés : la correction reste locale
      if (!resume) {
        for (let i = 0; i < N; i++) comp[i] = bestComp(lab[i] ? fgm : bgm, px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
        fitGmm(fgm, px, fgIdx, comp); fitGmm(bgm, px, bgIdx, comp);
      }
      // Capacités
      for (let e = 0; e < g.n; e++) { g.cap[2 * e] = wts[e]; g.cap[2 * e + 1] = wts[e]; }
      for (let i = 0; i < N; i++) {
        let src, snk;
        if (tri[i] === 0) { src = 0; snk = HARD; }
        else if (tri[i] === 3) { src = HARD; snk = 0; }
        else {
          const r = px[i * 3], gg = px[i * 3 + 1], b = px[i * 3 + 2];
          const dF = Math.min(60, nll(fgm, r, gg, b)), dB = Math.min(60, nll(bgm, r, gg, b)), m = Math.min(dF, dB);
          src = Math.round((dB - m) * SCALE); snk = Math.round((dF - m) * SCALE);
        }
        g.tr[i] = src - snk;
      }
      const side = maxflow(g);
      let changed = 0;
      for (let i = 0; i < N; i++) if (tri[i] === 1 || tri[i] === 2) { if (lab[i] !== side[i]) changed++; lab[i] = side[i]; }
      split();
      if (!fgIdx.length || !bgIdx.length) break;
      if (resume || (changed < N * 0.0005 && it > 0)) break;
    }
    return { lab, state: { g, wts, fgm, bgm, lab: lab.slice() } };
  }

  // =====================================================================
  // Incrustation par couleur, différence de fond, baguette
  // =====================================================================
  const toY = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const toCb = (r, g, b) => -0.168736 * r - 0.331264 * g + 0.5 * b;
  const toCr = (r, g, b) => 0.5 * r - 0.418688 * g - 0.081312 * b;

  // Écrit l'opacité (0..1) dans alpha. tol, soft : 0..1. despill : 0..1 (modifie rgba)
  function chromaKey(rgba, n, key, tol, soft, despill, alpha) {
    const [kr, kg, kb] = key, ky = toY(kr, kg, kb), kcb = toCb(kr, kg, kb), kcr = toCr(kr, kg, kb);
    const ksat = Math.hypot(kcb, kcr), colored = ksat > 22;
    const lw = colored ? 0.12 : 1;
    const ux = colored ? kcb / ksat : 0, uy = colored ? kcr / ksat : 0;
    const t0 = tol * 180, t1 = t0 + Math.max(1, soft * 180);
    for (let i = 0; i < n; i++) {
      const p = i * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const y = toY(r, g, b), cb = toCb(r, g, b), cr = toCr(r, g, b);
      let d;
      if (colored) { const dc = Math.hypot(cb - kcb, cr - kcr), dy = (y - ky) * lw; d = Math.sqrt(dc * dc + dy * dy); }
      else { const dr = r - kr, dg = g - kg, db = b - kb; d = Math.sqrt((dr * dr + dg * dg + db * db) / 3) * 1.15; }
      const a = d <= t0 ? 0 : d >= t1 ? 1 : (d - t0) / (t1 - t0);
      alpha[i] = a;
      if (despill > 0 && colored && a > 0) {
        const s = cb * ux + cr * uy;
        if (s > 0) {
          const k = s * despill, ncb = cb - ux * k, ncr = cr - uy * k;
          rgba[p] = y + 1.402 * ncr;
          rgba[p + 1] = y - 0.344136 * ncb - 0.714136 * ncr;
          rgba[p + 2] = y + 1.772 * ncb;
        }
      }
    }
    return alpha;
  }

  // Différence avec une image du fond seul (même taille)
  function diffKey(rgba, plate, n, tol, soft, alpha) {
    const t0 = tol * 160, t1 = t0 + Math.max(1, soft * 160);
    for (let i = 0; i < n; i++) {
      const p = i * 4, dr = rgba[p] - plate[p], dg = rgba[p + 1] - plate[p + 1], db = rgba[p + 2] - plate[p + 2];
      // Chrominance un peu plus importante que la luminosité, pour moins réagir aux ombres
      const dy = 0.299 * dr + 0.587 * dg + 0.114 * db, dcb = -0.168736 * dr - 0.331264 * dg + 0.5 * db, dcr = 0.5 * dr - 0.418688 * dg - 0.081312 * db;
      const d = Math.sqrt(0.55 * dy * dy + 1.6 * (dcb * dcb + dcr * dcr));
      alpha[i] = d <= t0 ? 0 : d >= t1 ? 1 : (d - t0) / (t1 - t0);
    }
    return alpha;
  }

  // Remplissage depuis (sx, sy) des pixels proches de la couleur du point de départ ; tol : 0..1
  function floodFill(rgba, w, h, sx, sy, tol) {
    const out = new Uint8Array(w * h);
    sx = Math.max(0, Math.min(w - 1, Math.floor(sx))); sy = Math.max(0, Math.min(h - 1, Math.floor(sy)));
    const s = (sy * w + sx) * 4, r0 = rgba[s], g0 = rgba[s + 1], b0 = rgba[s + 2], lim = (tol * 255) ** 2 * 3;
    const stack = new Int32Array(w * h);
    let top = 0;
    stack[top++] = sy * w + sx; out[sy * w + sx] = 1;
    while (top) {
      const i = stack[--top], x = i % w, y = (i - x) / w;
      const tryP = (j) => {
        if (out[j]) return;
        const p = j * 4, dr = rgba[p] - r0, dg = rgba[p + 1] - g0, db = rgba[p + 2] - b0;
        if (dr * dr + dg * dg + db * db <= lim) { out[j] = 1; stack[top++] = j; }
      };
      if (x > 0) tryP(i - 1);
      if (x + 1 < w) tryP(i + 1);
      if (y > 0) tryP(i - w);
      if (y + 1 < h) tryP(i + w);
    }
    return out;
  }

  // Couleur dominante du bord de l'image (médiane par canal)
  function borderColor(rgba, w, h) {
    const rs = [], gs = [], bs = [], step = Math.max(1, Math.floor((w + h) / 400));
    const add = (x, y) => { const p = (y * w + x) * 4; rs.push(rgba[p]); gs.push(rgba[p + 1]); bs.push(rgba[p + 2]); };
    for (let x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
    for (let y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
    const med = (a) => { a.sort((u, v) => u - v); return a[a.length >> 1]; };
    return [med(rs), med(gs), med(bs)];
  }

  // Médiane de plusieurs images (fond automatique d'une vidéo filmée sans bouger)
  function medianFrames(frames, n) {
    const out = new Uint8ClampedArray(n * 4), F = frames.length, v = new Uint8Array(F);
    for (let i = 0; i < n * 4; i++) {
      if ((i & 3) === 3) { out[i] = 255; continue; }
      for (let f = 0; f < F; f++) v[f] = frames[f][i];
      v.sort();
      out[i] = v[F >> 1];
    }
    return out;
  }

  // =====================================================================
  // Opérations sur le masque (Float32Array 0..1)
  // =====================================================================
  // Moyenne sur une fenêtre carrée (2r+1), bords normalisés ; deux passes séparables
  function boxBlur(src, w, h, r, out) {
    out = out || new Float32Array(w * h);
    if (r < 1) { out.set(src); return out; }
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = 0, c = 0;
      for (let x = 0; x < Math.min(r, w); x++) { s += src[o + x]; c++; }
      for (let x = 0; x < w; x++) {
        if (x + r < w) { s += src[o + x + r]; c++; }
        if (x - r - 1 >= 0) { s -= src[o + x - r - 1]; c--; }
        tmp[o + x] = s / c;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let y = 0; y < Math.min(r, h); y++) { s += tmp[y * w + x]; c++; }
      for (let y = 0; y < h; y++) {
        if (y + r < h) { s += tmp[(y + r) * w + x]; c++; }
        if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; c--; }
        out[y * w + x] = s / c;
      }
    }
    return out;
  }
  // Flou proche d'un flou gaussien (trois moyennes successives)
  function feather(a, w, h, r) {
    if (r < 0.5) return a;
    const k = Math.max(1, Math.round(r / 1.7));
    let t = boxBlur(a, w, h, k);
    t = boxBlur(t, w, h, k);
    return boxBlur(t, w, h, k, a);
  }
  // Érosion (r < 0) ou dilatation (r > 0) par un carré, en deux passes séparables
  function morph(a, w, h, r) {
    r = Math.round(r);
    if (!r) return a;
    const grow = r > 0, R = Math.abs(r), tmp = new Float32Array(w * h);
    const pick = grow ? Math.max : Math.min;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let v = a[o + x];
        const x0 = Math.max(0, x - R), x1 = Math.min(w - 1, x + R);
        for (let k = x0; k <= x1; k++) v = pick(v, a[o + k]);
        tmp[o + x] = v;
      }
    }
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      let v = tmp[y * w + x];
      const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
      for (let k = y0; k <= y1; k++) v = pick(v, tmp[k * w + x]);
      a[y * w + x] = v;
    }
    return a;
  }

  // Filtre guidé (He et al.) : recolle le masque aux contours de l'image (cheveux, poils, bords flous)
  function guidedFilter(gray, p, w, h, r, eps) {
    const n = w * h, ip = new Float32Array(n), ii = new Float32Array(n);
    for (let i = 0; i < n; i++) { ip[i] = gray[i] * p[i]; ii[i] = gray[i] * gray[i]; }
    const mI = boxBlur(gray, w, h, r), mP = boxBlur(p, w, h, r), mIP = boxBlur(ip, w, h, r), mII = boxBlur(ii, w, h, r);
    const A = ip, B = ii;
    for (let i = 0; i < n; i++) {
      const v = mII[i] - mI[i] * mI[i], a = (mIP[i] - mI[i] * mP[i]) / (v + eps);
      A[i] = a; B[i] = mP[i] - a * mI[i];
    }
    const mA = boxBlur(A, w, h, r, mI), mB = boxBlur(B, w, h, r, mP), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const q = mA[i] * gray[i] + mB[i]; out[i] = q < 0 ? 0 : q > 1 ? 1 : q; }
    return out;
  }

  // Composantes connexes (4-connexité) des pixels où sel(i) est vrai
  function components(w, h, sel) {
    const n = w * h, lab = new Int32Array(n).fill(-1), sizes = [], border = [], stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (lab[s] !== -1 || !sel(s)) continue;
      const id = sizes.length;
      let top = 0, cnt = 0, edge = false;
      stack[top++] = s; lab[s] = id;
      while (top) {
        const i = stack[--top], x = i % w, y = (i - x) / w;
        cnt++;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        if (x > 0 && lab[i - 1] === -1 && sel(i - 1)) { lab[i - 1] = id; stack[top++] = i - 1; }
        if (x + 1 < w && lab[i + 1] === -1 && sel(i + 1)) { lab[i + 1] = id; stack[top++] = i + 1; }
        if (y > 0 && lab[i - w] === -1 && sel(i - w)) { lab[i - w] = id; stack[top++] = i - w; }
        if (y + 1 < h && lab[i + w] === -1 && sel(i + w)) { lab[i + w] = id; stack[top++] = i + w; }
      }
      sizes.push(cnt); border.push(edge);
    }
    return { lab, sizes, border };
  }

  // Retire les taches isolées (minFrac de la plus grande), ou ne garde que le sujet principal ; bouche les trous
  function cleanMask(a, w, h, opt) {
    const n = w * h;
    if (opt.islands || opt.single) {
      const { lab, sizes } = components(w, h, (i) => a[i] > 0.5);
      if (sizes.length > 1) {
        const big = Math.max(...sizes), keep = new Float32Array(n);
        const ok = sizes.map((s) => (opt.single ? s === big : s >= big * (opt.minFrac || 0.02)));
        if (opt.single) { let seen = false; ok.forEach((v, k) => { if (v && seen) ok[k] = false; if (v) seen = true; }); }
        for (let i = 0; i < n; i++) if (lab[i] >= 0 && ok[lab[i]]) keep[i] = 1;
        morph(keep, w, h, 2);
        // Le halo d'une tache retirée disparaît avec elle ; les pixels flous proches du sujet restent
        for (let i = 0; i < n; i++) a[i] *= keep[i];
      }
    }
    if (opt.holes) {
      const { lab, sizes, border } = components(w, h, (i) => a[i] <= 0.5);
      const lim = n * (opt.holeFrac || 0.01);
      for (let i = 0; i < n; i++) { const c = lab[i]; if (c >= 0 && !border[c] && sizes[c] < lim) a[i] = 1; }
    }
    return a;
  }

  // Mode automatique : garde le sujet principal (grand et proche du centre) et ce qui est presque aussi grand
  // bridge (facultatif) : pixels retirés à la main, comptés comme reliés pour ne pas couper le sujet en morceaux
  function mainSubject(a, w, h, bridge) {
    const { lab, sizes } = components(w, h, bridge ? (i) => a[i] > 0.5 || bridge[i] === 2 : (i) => a[i] > 0.5);
    if (sizes.length < 2) return a;
    const sx = new Float64Array(sizes.length), sy = new Float64Array(sizes.length);
    for (let i = 0; i < lab.length; i++) if (lab[i] >= 0) { sx[lab[i]] += i % w; sy[lab[i]] += Math.floor(i / w); }
    const score = sizes.map((s, k) => {
      const dx = sx[k] / s / w - 0.5, dy = sy[k] / s / h - 0.55;
      return s * Math.max(0.15, 1 - Math.hypot(dx, dy) * 1.6);
    });
    const best = score.indexOf(Math.max(...score)), keep = new Float32Array(w * h);
    for (let i = 0; i < lab.length; i++) { const c = lab[i]; if (c >= 0 && (c === best || score[c] >= score[best] * 0.45)) keep[i] = 1; }
    morph(keep, w, h, 2);
    for (let i = 0; i < a.length; i++) a[i] *= keep[i];
    return a;
  }

  // Estimation de la couleur du fond derrière les bords semi-transparents
  function backgroundEstimate(rgba, a, w, h, r) {
    const n = w * h, wt = new Float32Array(n), ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { const b = (1 - a[i]) ** 2; wt[i] = b; for (let c = 0; c < 3; c++) ch[c][i] = rgba[i * 4 + c] * b; }
    const W1 = boxBlur(wt, w, h, r), C = ch.map((x) => boxBlur(x, w, h, r));
    const W2 = boxBlur(wt, w, h, r * 4), C2 = ch.map((x) => boxBlur(x, w, h, r * 4));
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const near = W1[i] > 0.02;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = near ? C[c][i] / W1[i] : W2[i] > 1e-4 ? C2[c][i] / W2[i] : rgba[i * 4 + c];
      out[i * 4 + 3] = 255;
    }
    return out;
  }
  // Retire la couleur du fond mélangée aux bords : F = B + (I - B) / alpha
  function decontaminate(rgba, bg, n, getA) {
    for (let i = 0; i < n; i++) {
      const a = getA(i);
      if (a <= 0.03 || a >= 0.97) continue;
      const p = i * 4, k = 1 / Math.max(a, 0.25);
      for (let c = 0; c < 3; c++) rgba[p + c] = bg[p + c] + (rgba[p + c] - bg[p + c]) * k;
    }
  }

  function grayOf(rgba, n) {
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    return g;
  }

  // Rectangle englobant des pixels opaques (alpha > seuil) ; null si vide
  function bounds(a, w, h, th) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Cadre de sortie : format "image" | "sujet" | "1:1" | "4:5" | ... ; marge en fraction du sujet
  function outputFrame(W, H, box, format, margin) {
    if (format === "image" || !box) return { x: 0, y: 0, w: W, h: H };
    const m = Math.round(Math.max(box.w, box.h) * margin);
    let x = box.x - m, y = box.y - m, w = box.w + 2 * m, h = box.h + 2 * m;
    if (format !== "sujet") {
      const [rw, rh] = format.split(":").map(Number), ratio = rw / rh;
      if (w / h > ratio) { const nh = w / ratio; y -= (nh - h) / 2; h = nh; } else { const nw = h * ratio; x -= (nw - w) / 2; w = nw; }
    }
    return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  }

  const api = { makeGraph, addEdge, maxflow, grabcut, chromaKey, diffKey, floodFill, borderColor, medianFrames, boxBlur, feather, morph, guidedFilter, components, cleanMask, mainSubject, backgroundEstimate, decontaminate, grayOf, bounds, outputFrame };
  root.Detourage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
