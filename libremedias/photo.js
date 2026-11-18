/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreMedias — photos : détourage, retouche, nouveau fond, cadrage, enregistrement (une photo ou un ZIP)
(function () {
  enableDownloads();
  const D = window.Detourage;
  const cv = $("cv"), ctx = cv.getContext("2d");
  const PREF = "libremedias-photo-v1";
  const LM = (window.LM = window.LM || { hooks: {}, tabListeners: [] });
  const P = Object.assign({
    method: "auto", quality: 512, key: "#00b140", keyAuto: true, tol: 16, soft: 12, spill: 60, dtol: 14, dsoft: 12,
    tool: "brush", act: "remove", brush: 40, wtol: 12,
    fine: true, shift: 0, feather: 1, islands: true, single: false, holes: false, decont: true,
    bg: "none", bgc1: "#ffffff", bgc2: "#cfd9ff", blur: 40, shadow: false, shadowk: 45, outline: false, outc: "#ffffff", outw: 10,
    format: "image", margin: 8, maxsize: 0, fmt: "png", view: "result", compare: 50,
  }, loadPref(PREF, {}));
  const savePrefs = () => savePref(PREF, P);
  const WORK = 1600, MAXPIX = 16777216;

  const AIDE_METHODE = {
    auto: trad("Le sujet est trouvé tout seul. S’il touche les bords ou si le fond est chargé, essaie Cadre."),
    cadre: trad("Trace un rectangle autour du sujet sur la photo : tout ce qui est dehors devient le fond."),
    couleur: trad("Pour un fond blanc, vert, bleu ou d’une seule couleur. Touche le fond avec la pipette pour choisir sa couleur."),
    diff: trad("Prends deux photos sans bouger : une avec le sujet, une du fond seul. Les différences forment le sujet."),
  };
  const AIDE_OUTIL = {
    brush: trad("Peins sur la photo ce qu’il faut garder ou retirer. Raccourcis : [ et ] pour la taille."),
    wand: trad("Touche une zone de couleur proche pour la garder ou la retirer d’un coup."),
    rect: trad("Trace un rectangle autour du sujet (méthode Cadre)."),
    pick: trad("Touche le fond pour choisir la couleur à retirer (méthode Fond uni)."),
  };

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const tick = () => new Promise((ok) => setTimeout(ok, 16));
  const canFilter = (() => {
    try { const c = mk(9, 9), g = c.getContext("2d"); g.filter = "blur(2px)"; g.fillStyle = "#fff"; g.fillRect(4, 4, 1, 1); return g.getImageData(2, 4, 1, 1).data[3] > 0; } catch (e) { return false; }
  })();

  // ---------- Photos ----------
  let items = [], cur = null, uid = 0, plate = null, bgImg = null;
  const loadImg = (url) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });

  // Données de travail (taille réduite) ; libérées quand on change de photo
  async function prepare(it) {
    if (it.wdata) return;
    if (!it.img) it.img = await loadImg(it.url);
    const k = Math.min(1, WORK / Math.max(it.W, it.H));
    it.ww = Math.max(1, Math.round(it.W * k)); it.wh = Math.max(1, Math.round(it.H * k));
    it.work = mk(it.ww, it.wh);
    const g = it.work.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(it.img, 0, 0, it.ww, it.wh);
    it.wdata = g.getImageData(0, 0, it.ww, it.wh).data;
    it.gray = D.grayOf(it.wdata, it.ww * it.wh);
    it.border = D.borderColor(it.wdata, it.ww, it.wh);
    if (!it.hints) it.hints = new Uint8Array(it.ww * it.wh);
    if (!it.hist) { it.hist = [snap(it)]; it.hpos = 0; }
  }
  function release(it) {
    if (!it || it === cur) return;
    ["work", "wdata", "gray", "base", "alpha", "fg", "gc", "baseKey", "alphaKey", "alphaCanvas"].forEach((k) => delete it[k]);
    if (it.hints && !it.hints.some((v) => v)) { delete it.hints; delete it.hist; }
  }
  const snap = (it) => ({ hints: it.hints ? it.hints.slice() : null, rect: it.rect ? { ...it.rect } : null });

  // ---------- Calcul du masque ----------
  const keyColor = (it) => (P.keyAuto ? it.border : hex(P.key));
  function baseKey(it) {
    if (P.method === "auto" || P.method === "cadre") return [P.method, P.quality, P.fine, P.method === "cadre" && it.rect ? Object.values(it.rect).map(Math.round).join(",") : "", it.hv || 0].join("|");
    if (P.method === "couleur") return ["c", keyColor(it).join(","), P.tol, P.soft, P.spill].join("|");
    return ["d", plate ? plate.id : 0, P.dtol, P.dsoft].join("|");
  }

  function runGrabcut(it) {
    const ww = it.ww, wh = it.wh, k = Math.min(1, P.quality / Math.max(ww, wh));
    const sw = Math.max(8, Math.round(ww * k)), sh = Math.max(8, Math.round(wh * k));
    const sc = mk(sw, sh), sg = sc.getContext("2d", { willReadFrequently: true });
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
    sg.drawImage(it.work, 0, 0, sw, sh);
    const px = sg.getImageData(0, 0, sw, sh).data, N = sw * sh, tri = new Uint8Array(N);
    const r = P.method === "cadre" ? it.rect : null;
    if (r && r.w > 4 && r.h > 4) {
      const x0 = (r.x / ww) * sw, y0 = (r.y / wh) * sh, x1 = ((r.x + r.w) / ww) * sw, y1 = ((r.y + r.h) / wh) * sh;
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) tri[y * sw + x] = x + 0.5 >= x0 && x + 0.5 <= x1 && y + 0.5 >= y0 && y + 0.5 <= y1 ? 2 : 0;
    } else {
      // Automatique : les bords haut, gauche et droit sont du fond ; le bas peut toucher le sujet (buste, objet posé)
      const m = Math.max(2, Math.round(Math.max(sw, sh) * 0.015));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) tri[y * sw + x] = x < m || y < m || x >= sw - m ? 0 : 2;
    }
    // Retouches (Garder / Retirer) en contraintes dures
    if (it.hints) {
      const cnt = new Int32Array(N * 2);
      for (let y = 0; y < wh; y++) {
        const sy = Math.min(sh - 1, Math.floor((y * sh) / wh));
        for (let x = 0; x < ww; x++) {
          const h = it.hints[y * ww + x];
          if (h) cnt[(sy * sw + Math.min(sw - 1, Math.floor((x * sw) / ww))) * 2 + h - 1]++;
        }
      }
      for (let i = 0; i < N; i++) if (cnt[i * 2] || cnt[i * 2 + 1]) tri[i] = cnt[i * 2] >= cnt[i * 2 + 1] ? 3 : 0;
    }
    const sameGeo = it.gc && it.gc.sw === sw && it.gc.sh === sh && it.gc.geo === (r ? [r.x, r.y, r.w, r.h].join() : "auto");
    const res = D.grabcut(px, sw, sh, tri, sameGeo ? 2 : 5, sameGeo ? it.gc.state : null);
    it.gc = res.state ? { state: res.state, sw, sh, geo: r ? [r.x, r.y, r.w, r.h].join() : "auto" } : null;
    // Agrandissement du masque, puis bords recollés à l'image
    const lc = mk(sw, sh), lg = lc.getContext("2d"), ld = lg.createImageData(sw, sh);
    for (let i = 0; i < N; i++) { ld.data[i * 4] = ld.data[i * 4 + 1] = ld.data[i * 4 + 2] = 255; ld.data[i * 4 + 3] = res.lab[i] ? 255 : 0; }
    lg.putImageData(ld, 0, 0);
    const up = alphaFromCanvas(lc, ww, wh);
    if (!r) D.mainSubject(up, ww, wh, it.hints);
    if (!P.fine) return up;
    const f = ww / sw, rad = Math.max(2, Math.round(f * 2 + 1));
    const gf = D.guidedFilter(it.gray, up, ww, wh, rad, 2e-3);
    const band = new Float32Array(ww * wh);
    for (let i = 0; i < band.length; i++) band[i] = up[i] > 0.01 && up[i] < 0.99 ? 1 : 0;
    D.morph(band, ww, wh, rad);
    for (let i = 0; i < band.length; i++) if (band[i]) up[i] = gf[i];
    return up;
  }
  function alphaFromCanvas(c, w, h) {
    const t = mk(w, h), g = t.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, a = new Float32Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
    return a;
  }

  async function computeBase(it) {
    const key = baseKey(it);
    if (it.base && it.baseKey === key) return false;
    const n = it.ww * it.wh;
    it.fg = null;
    if (P.method === "auto" || P.method === "cadre") it.base = runGrabcut(it);
    else if (P.method === "couleur") {
      const fg = new Uint8ClampedArray(it.wdata);
      it.base = D.chromaKey(fg, n, keyColor(it), P.tol / 100, P.soft / 100, P.spill / 100, new Float32Array(n));
      it.fg = fg;
    } else if (plate) {
      const g = mk(it.ww, it.wh).getContext("2d", { willReadFrequently: true });
      g.drawImage(plate.img, 0, 0, it.ww, it.wh);
      it.base = D.diffKey(it.wdata, g.getImageData(0, 0, it.ww, it.wh).data, n, P.dtol / 100, P.dsoft / 100, new Float32Array(n));
      // Petit flou contre le bruit du capteur
      D.feather(it.base, it.ww, it.wh, 1.2);
    } else it.base = new Float32Array(n).fill(1);
    it.baseKey = key;
    return true;
  }
  function postKey(it) { return [it.baseKey, it.hv || 0, P.shift, P.feather, P.islands, P.single, P.holes].join("|"); }
  function computeAlpha(it) {
    const key = postKey(it);
    if (it.alpha && it.alphaKey === key) return;
    const w = it.ww, h = it.wh, n = w * h, a = it.base.slice();
    if (it.hints) for (let i = 0; i < n; i++) { const v = it.hints[i]; if (v === 1) a[i] = 1; else if (v === 2) a[i] = 0; }
    D.cleanMask(a, w, h, { islands: P.islands, single: P.single, holes: P.holes, minFrac: 0.03, holeFrac: 0.004 });
    if (P.shift) D.morph(a, w, h, P.shift * (w / 1000));
    if (P.feather) D.feather(a, w, h, P.feather * (Math.max(w, h) / 1600));
    it.alpha = a; it.alphaKey = key; it.alphaCanvas = null; it.done = true;
  }
  function alphaCanvas(it) {
    if (it.alphaCanvas) return it.alphaCanvas;
    const c = mk(it.ww, it.wh), g = c.getContext("2d"), d = g.createImageData(it.ww, it.wh);
    for (let i = 0; i < it.alpha.length; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = it.alpha[i] * 255; }
    g.putImageData(d, 0, 0);
    return (it.alphaCanvas = c);
  }

  // ---------- Composition (aperçu et enregistrement) ----------
  // full : taille d'origine (limitée par Taille maximale) ; crop : applique le cadrage
  function compose(it, full, crop, maskOnly) {
    const k0 = full ? 1 : it.ww / it.W;
    let sw = Math.round(it.W * k0), sh = Math.round(it.H * k0);
    // Cadre dans le repère de cette taille
    let fr = { x: 0, y: 0, w: sw, h: sh };
    if (crop && P.format !== "image") {
      const b = D.bounds(it.alpha, it.ww, it.wh, 0.15), s = sw / it.ww;
      fr = D.outputFrame(sw, sh, b && { x: b.x * s, y: b.y * s, w: b.w * s, h: b.h * s }, P.format, P.margin / 100);
    }
    // Facteur de sortie (taille maximale, limite des navigateurs)
    let k = 1;
    if (full && P.maxsize) k = Math.min(1, P.maxsize / Math.max(fr.w, fr.h));
    if (fr.w * fr.h * k * k > MAXPIX) k = Math.sqrt(MAXPIX / (fr.w * fr.h));
    const ow = Math.max(1, Math.round(fr.w * k)), oh = Math.max(1, Math.round(fr.h * k));
    const tw = Math.max(1, Math.round(sw * k)), th = Math.max(1, Math.round(sh * k)), ox = -fr.x * k, oy = -fr.y * k;
    const out = mk(ow, oh), g = out.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (maskOnly) {
      g.fillStyle = "#000"; g.fillRect(0, 0, ow, oh);
      const m = mk(tw, th), mg = m.getContext("2d");
      mg.fillStyle = "#fff"; mg.fillRect(0, 0, tw, th);
      mg.globalCompositeOperation = "destination-in"; mg.drawImage(alphaCanvas(it), 0, 0, tw, th);
      g.drawImage(m, ox, oy);
      return out;
    }
    // Sujet : image + couleurs corrigées + transparence
    const src = full ? it.img : it.work;
    const S = mk(tw, th), sg = S.getContext("2d", { willReadFrequently: true });
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
    sg.drawImage(src, 0, 0, tw, th);
    const fixSpill = P.method === "couleur" && P.spill > 0, fixEdge = P.decont && P.bg !== "blur" && P.bg !== "gray";
    if (fixSpill || fixEdge) {
      const id = sg.getImageData(0, 0, tw, th), n = tw * th;
      const A = (() => { const t = mk(tw, th), tg = t.getContext("2d", { willReadFrequently: true }); tg.drawImage(alphaCanvas(it), 0, 0, tw, th); return tg.getImageData(0, 0, tw, th).data; })();
      if (fixSpill) D.chromaKey(id.data, n, keyColor(it), P.tol / 100, P.soft / 100, P.spill / 100, new Float32Array(n));
      if (fixEdge) {
        if (!it.bgEst || it.bgEstKey !== it.alphaKey) {
          const c = mk(it.ww, it.wh), cg = c.getContext("2d"), d = cg.createImageData(it.ww, it.wh);
          d.data.set(D.backgroundEstimate(it.wdata, it.alpha, it.ww, it.wh, Math.max(3, Math.round(it.ww / 200))));
          cg.putImageData(d, 0, 0);
          it.bgEst = c; it.bgEstKey = it.alphaKey;
        }
        const t = mk(tw, th), tg = t.getContext("2d", { willReadFrequently: true });
        tg.imageSmoothingEnabled = true; tg.drawImage(it.bgEst, 0, 0, tw, th);
        D.decontaminate(id.data, tg.getImageData(0, 0, tw, th).data, n, (i) => A[i * 4 + 3] / 255);
      }
      sg.putImageData(id, 0, 0);
    }
    sg.globalCompositeOperation = "destination-in";
    sg.drawImage(alphaCanvas(it), 0, 0, tw, th);
    sg.globalCompositeOperation = "source-over";

    // Fond
    const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, ow, oh); };
    if (P.bg === "color") fill(P.bgc1);
    else if (P.bg === "gradient") { const gr = g.createLinearGradient(0, 0, 0, oh); gr.addColorStop(0, P.bgc1); gr.addColorStop(1, P.bgc2); g.fillStyle = gr; g.fillRect(0, 0, ow, oh); }
    else if (P.bg === "blur" || P.bg === "gray") {
      fill(toHex(...it.border));
      if (P.bg === "blur") drawBlurred(g, src, ox, oy, tw, th, (P.blur / 100) * Math.max(tw, th) * 0.03);
      else drawGray(g, src, ox, oy, tw, th);
    } else if (P.bg === "image" && bgImg) {
      const s = Math.max(ow / bgImg.width, oh / bgImg.height);
      g.drawImage(bgImg, (ow - bgImg.width * s) / 2, (oh - bgImg.height * s) / 2, bgImg.width * s, bgImg.height * s);
    } else if (full && opaqueFmt()) fill("#ffffff");

    // Contour autocollant, puis ombre sous l'ensemble
    let T = S;
    if (P.outline) {
      const r = (P.outw * Math.max(tw, th)) / 900, pad = Math.ceil(r) + 2;
      T = mk(tw + 2 * pad, th + 2 * pad);
      const tg = T.getContext("2d"), sil = mk(tw, th), silg = sil.getContext("2d");
      silg.drawImage(S, 0, 0); silg.globalCompositeOperation = "source-in"; silg.fillStyle = P.outc; silg.fillRect(0, 0, tw, th);
      const steps = Math.max(16, Math.min(48, Math.round(r * 2)));
      for (let s = 0; s < steps; s++) { const t = (s / steps) * Math.PI * 2; tg.drawImage(sil, pad + Math.cos(t) * r, pad + Math.sin(t) * r); }
      tg.drawImage(sil, pad, pad);
      tg.drawImage(S, pad, pad);
      T.pad = pad;
    }
    const px = ox - (T.pad || 0), py = oy - (T.pad || 0);
    if (P.shadow) {
      g.save();
      const big = Math.max(tw, th);
      g.shadowColor = `rgba(0,0,0,${(P.shadowk / 100) * 0.85})`;
      g.shadowBlur = big * 0.025; g.shadowOffsetX = big * 0.006; g.shadowOffsetY = big * 0.014;
      g.drawImage(T, px, py);
      g.restore();
    }
    g.drawImage(T, px, py);
    return out;
  }
  function drawBlurred(g, src, x, y, w, h, rad) {
    rad = Math.max(1, rad);
    if (canFilter) { g.save(); g.filter = `blur(${rad}px)`; g.drawImage(src, x, y, w, h); g.restore(); return; }
    const f = Math.max(2, rad / 2), s = mk(Math.max(1, Math.round(w / f)), Math.max(1, Math.round(h / f))), sg = s.getContext("2d");
    sg.imageSmoothingQuality = "high"; sg.drawImage(src, 0, 0, s.width, s.height);
    g.drawImage(s, x, y, w, h);
  }
  function drawGray(g, src, x, y, w, h) {
    const t = mk(w, h), tg = t.getContext("2d", { willReadFrequently: true });
    tg.drawImage(src, 0, 0, w, h);
    const d = tg.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
    tg.putImageData(d, 0, 0);
    g.drawImage(t, x, y);
  }

  // ---------- Affichage ----------
  let shown = null, stroke = null, hover = null, dragRect = null;
  function cssScale() { const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; }
  function draw() {
    const it = cur;
    if (!it || !it.alpha) return;
    if (cv.width !== it.ww || cv.height !== it.wh) { cv.width = it.ww; cv.height = it.wh; }
    const w = it.ww, h = it.wh;
    ctx.clearRect(0, 0, w, h);
    if (P.view === "mask") ctx.drawImage(compose(it, false, false, true), 0, 0);
    else if (P.view === "overlay") {
      ctx.drawImage(it.work, 0, 0);
      const o = overlayCanvas(it);
      ctx.drawImage(o, 0, 0);
    } else {
      if (!shown) shown = compose(it, false, false);
      if (P.view === "compare") {
        const x = Math.round((P.compare / 100) * w);
        ctx.drawImage(it.work, 0, 0, x, h, 0, 0, x, h);
        ctx.drawImage(shown, x, 0, w - x, h, x, 0, w - x, h);
        const lw = cssScale();
        ctx.fillStyle = "#fff"; ctx.fillRect(x - lw, 0, 2 * lw, h);
      } else ctx.drawImage(shown, 0, 0);
    }
    drawTools();
  }
  let ovCache = null;
  function overlayCanvas(it) {
    const key = it.alphaKey + "|" + (it.hv || 0);
    if (ovCache && ovCache.key === key && ovCache.it === it) return ovCache.c;
    const c = mk(it.ww, it.wh), g = c.getContext("2d"), d = g.createImageData(it.ww, it.wh), a = it.alpha, hn = it.hints;
    for (let i = 0; i < a.length; i++) {
      const p = i * 4, hv = hn ? hn[i] : 0;
      if (hv === 1) { d.data[p] = 40; d.data[p + 1] = 200; d.data[p + 2] = 120; d.data[p + 3] = 90; }
      else if (hv === 2) { d.data[p] = 255; d.data[p + 1] = 40; d.data[p + 2] = 70; d.data[p + 3] = 190; }
      else { d.data[p] = 255; d.data[p + 1] = 40; d.data[p + 2] = 70; d.data[p + 3] = (1 - a[i]) * 140; }
    }
    g.putImageData(d, 0, 0);
    ovCache = { key, it, c };
    return c;
  }
  function drawTools() {
    const lw = cssScale(), it = cur;
    const rect = dragRect || (P.method === "cadre" && it.rect);
    if (rect) {
      ctx.save(); ctx.lineWidth = 2 * lw; ctx.setLineDash([7 * lw, 5 * lw]);
      ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineDashOffset = 6 * lw; ctx.strokeStyle = "#fff"; ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
    if (stroke && stroke.pts.length) {
      ctx.save(); ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = stroke.r * 2;
      ctx.strokeStyle = stroke.v === 1 ? "rgba(40,200,120,.55)" : "rgba(255,40,70,.55)";
      ctx.beginPath(); stroke.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (stroke.pts.length === 1) ctx.lineTo(stroke.pts[0][0] + 0.01, stroke.pts[0][1]);
      ctx.stroke(); ctx.restore();
    }
    if (hover && P.tool === "brush" && P.view !== "compare") {
      const r = brushR();
      ctx.save(); ctx.lineWidth = 1.5 * lw;
      ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.beginPath(); ctx.arc(hover[0], hover[1], r, 0, 7); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(hover[0], hover[1], Math.max(1, r - 1.5 * lw), 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  let raf = 0;
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

  let finalTimer = 0;
  function drawFinal() {
    clearTimeout(finalTimer);
    finalTimer = setTimeout(() => {
      const it = cur, f = $("final");
      if (!it || !it.alpha) return;
      const c = P.fmt === "mask" ? compose(it, false, true, true) : compose(it, false, true);
      const k = Math.min(1, 420 / Math.max(c.width, c.height));
      f.width = Math.max(1, Math.round(c.width * k)); f.height = Math.max(1, Math.round(c.height * k));
      const g = f.getContext("2d");
      g.imageSmoothingQuality = "high";
      if (opaqueFmt() && P.bg === "none") { g.fillStyle = "#fff"; g.fillRect(0, 0, f.width, f.height); }
      g.drawImage(c, 0, 0, f.width, f.height);
      // Taille réelle du fichier enregistré
      const s = it.W / it.ww;
      let ow = c.width * s, oh = c.height * s;
      let k2 = P.maxsize ? Math.min(1, P.maxsize / Math.max(ow, oh)) : 1;
      if (ow * oh * k2 * k2 > MAXPIX) k2 = Math.sqrt(MAXPIX / (ow * oh));
      $("out-facts").textContent = trad("Fichier enregistré : {w} × {h} px", { w: Math.round(ow * k2), h: Math.round(oh * k2) });
    }, 120);
  }

  // ---------- Recalcul ----------
  let job = 0, busyTimer = 0;
  function setBusy(on) {
    clearTimeout(busyTimer);
    if (on) busyTimer = setTimeout(() => ($("busy").hidden = false), 120);
    else $("busy").hidden = true;
  }
  async function update() {
    const it = cur, my = ++job;
    if (!it) return;
    await prepare(it);
    if (my !== job) return;
    if (it.baseKey !== baseKey(it)) {
      setBusy(true);
      await tick(); await tick();
      if (my !== job) return;
      try { await computeBase(it); } catch (e) { console.error(e); showErr(trad("Le détourage a échoué sur cette photo.")); }
    }
    if (my !== job) return;
    computeAlpha(it);
    setBusy(false);
    shown = null;
    draw(); drawFinal(); syncPanel(); renderThumbs();
  }
  const restyle = () => { shown = null; redraw(); drawFinal(); };

  // ---------- Historique des retouches ----------
  function commit(it) {
    it.hist = it.hist.slice(0, it.hpos + 1);
    it.hist.push(snap(it));
    if (it.hist.length > 25) it.hist.shift();
    it.hpos = it.hist.length - 1;
    it.hv = (it.hv || 0) + 1;
  }
  function restore(it, i) {
    it.hpos = i;
    const s = it.hist[i];
    it.hints = s.hints ? s.hints.slice() : new Uint8Array(it.ww * it.wh);
    it.rect = s.rect ? { ...s.rect } : null;
    it.hv = (it.hv || 0) + 1;
    update();
  }
  const undo = () => { if (cur && cur.hist && cur.hpos > 0) restore(cur, cur.hpos - 1); };
  const redo = () => { if (cur && cur.hist && cur.hpos < cur.hist.length - 1) restore(cur, cur.hpos + 1); };

  // ---------- Pointeur ----------
  function pt(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; }
  const brushR = () => (P.brush / 2) * cssScale();
  function stamp(it, x, y, r, v) {
    const w = it.ww, h = it.wh, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r)), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r)), r2 = r * r;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= r2) it.hints[yy * w + xx] = v;
  }
  function paintTo(it, q) {
    const l = stroke.pts[stroke.pts.length - 1], d = Math.hypot(q[0] - l[0], q[1] - l[1]), step = Math.max(1, stroke.r / 3);
    for (let s = step; s < d; s += step) stamp(it, l[0] + ((q[0] - l[0]) * s) / d, l[1] + ((q[1] - l[1]) * s) / d, stroke.r, stroke.v);
    stamp(it, q[0], q[1], stroke.r, stroke.v);
    stroke.pts.push(q);
  }
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    const it = cur;
    if (!it || !it.alpha || e.button > 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const p = pt(e);
    leaveExample();
    if (P.view === "compare") { drag = { mode: "compare" }; setCompare(p[0]); return; }
    if (P.tool === "brush") {
      stroke = { r: brushR(), v: P.act === "keep" ? 1 : 2, pts: [p] };
      stamp(it, p[0], p[1], stroke.r, stroke.v);
      drag = { mode: "brush" }; redraw();
    } else if (P.tool === "rect") {
      drag = { mode: "rect", p0: p }; dragRect = { x: p[0], y: p[1], w: 0, h: 0 };
    } else if (P.tool === "wand") {
      const m = D.floodFill(it.wdata, it.ww, it.wh, p[0], p[1], P.wtol / 100), v = P.act === "keep" ? 1 : 2;
      for (let i = 0; i < m.length; i++) if (m[i]) it.hints[i] = v;
      commit(it); update();
    } else if (P.tool === "pick") {
      const x = Math.floor(p[0]), y = Math.floor(p[1]);
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
        if (xx < 0 || yy < 0 || xx >= it.ww || yy >= it.wh) continue;
        const q = (yy * it.ww + xx) * 4; r += it.wdata[q]; g += it.wdata[q + 1]; b += it.wdata[q + 2]; n++;
      }
      if (n) { P.key = toHex(r / n, g / n, b / n); P.keyAuto = false; P.method = "couleur"; savePrefs(); syncPanel(); update(); }
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!cur || !cur.alpha) return;
    const p = pt(e);
    hover = p;
    if (!drag) { if (P.tool === "brush") redraw(); return; }
    if (drag.mode === "compare") setCompare(p[0]);
    else if (drag.mode === "brush") { paintTo(cur, p); redraw(); }
    else if (drag.mode === "rect") {
      const q = [Math.max(0, Math.min(cv.width, p[0])), Math.max(0, Math.min(cv.height, p[1]))];
      dragRect = { x: Math.min(drag.p0[0], q[0]), y: Math.min(drag.p0[1], q[1]), w: Math.abs(q[0] - drag.p0[0]), h: Math.abs(q[1] - drag.p0[1]) };
      redraw();
    }
  });
  function endDrag() {
    if (!drag) return;
    const it = cur, mode = drag.mode;
    drag = null;
    if (mode === "brush") { stroke = null; commit(it); update(); }
    else if (mode === "rect") {
      const r = dragRect; dragRect = null;
      if (r && r.w > 8 && r.h > 8) { it.rect = r; P.method = "cadre"; savePrefs(); commit(it); syncPanel(); update(); }
      else redraw();
    }
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("pointerleave", () => { hover = null; if (!drag) redraw(); });
  function setCompare(x) { P.compare = Math.round(Math.max(0, Math.min(100, (x / cv.width) * 100))); $("compare").value = P.compare; $("compare-o").textContent = P.compare + " %"; redraw(); }

  // ---------- Panneau ----------
  const press = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === val)));
  const out = (id, v) => { $(id).value = P[id]; $(id + "-o").textContent = v; };
  function syncPanel() {
    press("#methods .tab", "method", P.method);
    press("#tools .tab", "tool", P.tool);
    press("#actions .tab", "act", P.act);
    press("#views .tab", "view", P.view);
    press("#bgs .tab", "bg", P.bg);
    $("method-hint").textContent = AIDE_METHODE[P.method];
    $("m-auto").hidden = !(P.method === "auto" || P.method === "cadre");
    $("m-couleur").hidden = P.method !== "couleur";
    $("m-diff").hidden = P.method !== "diff";
    $("quality").value = P.quality;
    const kc = cur && cur.border ? toHex(...keyColor(cur)) : P.key;
    $("keysw").style.background = kc; $("key").value = kc;
    $("key-auto").setAttribute("aria-pressed", String(P.keyAuto));
    out("tol", P.tol); out("soft", P.soft); out("spill", P.spill + " %"); out("dtol", P.dtol); out("dsoft", P.dsoft);
    $("plate-name").textContent = plate ? plate.name : trad("Aucune photo du fond");
    $("actions").hidden = !(P.tool === "brush" || P.tool === "wand");
    $("brush-row").hidden = P.tool !== "brush"; out("brush", P.brush + " px");
    $("wand-row").hidden = P.tool !== "wand"; out("wtol", P.wtol);
    $("tool-hint").textContent = AIDE_OUTIL[P.tool];
    $("clear-hints").hidden = !(cur && ((cur.hints && cur.hints.some((v) => v)) || cur.rect));
    $("fine").checked = P.fine;
    out("shift", (P.shift > 0 ? "+" : "") + P.shift); out("feather", P.feather);
    ["islands", "single", "holes", "decont", "shadow", "outline"].forEach((k) => ($(k).checked = P[k]));
    $("bg-colors").hidden = !(P.bg === "color" || P.bg === "gradient");
    $("bgc2-w").hidden = P.bg !== "gradient";
    $("bgc1-l").textContent = P.bg === "gradient" ? trad("Couleur 1") : trad("Couleur");
    $("bgc1").value = P.bgc1; $("bgc2").value = P.bgc2;
    $("bg-presets").hidden = !(P.bg === "color" || P.bg === "gradient");
    $("blur-row").hidden = P.bg !== "blur"; out("blur", P.blur + " %");
    $("bgimg-row").hidden = P.bg !== "image"; $("bgimg-name").textContent = bgImg ? bgImg.label : "";
    $("shadow-row").hidden = !P.shadow; out("shadowk", P.shadowk + " %");
    $("outline-row").hidden = !P.outline; $("outc").value = P.outc; out("outw", P.outw);
    $("format").value = P.format; $("maxsize").value = P.maxsize;
    $("margin-row").hidden = P.format === "image"; out("margin", P.margin + " %");
    $("fmt").value = P.fmt;
    $("compare-row").hidden = P.view !== "compare"; out("compare", P.compare + " %");
    $("undo").disabled = !(cur && cur.hist && cur.hpos > 0);
    $("redo").disabled = !(cur && cur.hist && cur.hpos < cur.hist.length - 1);
    const ready = !!(cur && cur.alpha);
    ["dl", "copy"].forEach((id) => ($(id).disabled = !ready));
    $("zip").hidden = items.length < 2 || !canSave();
    cv.style.cursor = P.view === "compare" ? "ew-resize" : P.tool === "brush" ? "none" : "crosshair";
  }
  function on(id, ev, fn) { $(id).addEventListener(ev, fn); }
  function setP(patch, level) {
    Object.assign(P, patch); savePrefs(); syncPanel();
    if (level === "compute") update(); else if (level === "style") restyle(); else redraw();
  }
  on("methods", "click", (e) => { const b = e.target.closest("[data-method]"); if (!b) return; const m = b.dataset.method; setP({ method: m, tool: m === "cadre" ? "rect" : m === "couleur" ? "pick" : P.tool === "rect" || P.tool === "pick" ? "brush" : P.tool }, "compute"); if (m === "diff" && !plate) $("platefile").click(); });
  on("tools", "click", (e) => {
    const b = e.target.closest("[data-tool]"); if (!b) return;
    const t = b.dataset.tool, patch = { tool: t };
    if (t === "rect" && P.method !== "cadre") patch.method = "cadre";
    if (t === "pick" && P.method !== "couleur") patch.method = "couleur";
    if (P.view === "compare") patch.view = "overlay";
    setP(patch, patch.method ? "compute" : "draw");
  });
  on("actions", "click", (e) => { const b = e.target.closest("[data-act]"); if (b) setP({ act: b.dataset.act }); });
  on("views", "click", (e) => { const b = e.target.closest("[data-view]"); if (b) setP({ view: b.dataset.view }); });
  on("bgs", "click", (e) => { const b = e.target.closest("[data-bg]"); if (!b) return; setP({ bg: b.dataset.bg }, "style"); if (b.dataset.bg === "image" && !bgImg) $("bgfile").click(); });
  on("quality", "input", () => setP({ quality: +$("quality").value }, "compute"));
  on("key", "input", () => setP({ key: $("key").value, keyAuto: false }, "compute"));
  on("key-auto", "click", () => setP({ keyAuto: true }, "compute"));
  ["tol", "soft", "spill", "dtol", "dsoft"].forEach((id) => on(id, "input", () => setP({ [id]: +$(id).value }, "compute")));
  on("brush", "input", () => setP({ brush: +$("brush").value }));
  on("wtol", "input", () => setP({ wtol: +$("wtol").value }));
  on("fine", "input", () => setP({ fine: $("fine").checked }, "compute"));
  ["shift", "feather"].forEach((id) => on(id, "input", () => setP({ [id]: +$(id).value }, "compute")));
  ["islands", "single", "holes"].forEach((id) => on(id, "input", () => setP({ [id]: $(id).checked }, "compute")));
  ["decont", "shadow", "outline"].forEach((id) => on(id, "input", () => setP({ [id]: $(id).checked }, "style")));
  ["bgc1", "bgc2", "outc"].forEach((id) => on(id, "input", () => setP({ [id]: $(id).value }, "style")));
  ["blur", "shadowk", "outw", "margin"].forEach((id) => on(id, "input", () => setP({ [id]: +$(id).value }, "style")));
  on("format", "input", () => setP({ format: $("format").value }, "style"));
  on("maxsize", "input", () => setP({ maxsize: +$("maxsize").value }, "style"));
  on("fmt", "input", () => setP({ fmt: $("fmt").value }, "style"));
  on("compare", "input", () => setP({ compare: +$("compare").value }));
  on("clear-hints", "click", () => { if (!cur) return; cur.hints = new Uint8Array(cur.ww * cur.wh); cur.rect = null; commit(cur); update(); toast(trad("Retouches effacées.")); });
  on("undo", "click", undo);
  on("redo", "click", redo);
  on("plate-btn", "click", () => $("platefile").click());
  on("bgimg-btn", "click", () => $("bgfile").click());
  const PRESETS = [["#ffffff"], ["#000000"], ["#f2f2f2"], ["#ffd9e2"], ["#d8f3e6"], ["#d6e6ff"], ["#fff1c9"], ["#ffffff", "#cfd9ff"], ["#ffecd2", "#fcb69f"], ["#a1c4fd", "#c2e9fb"], ["#d4fc79", "#96e6a1"], ["#232526", "#414345"]];
  $("bg-presets").innerHTML = PRESETS.map((c, i) => `<button class="sw" data-i="${i}" title="${c.join(" → ")}"><i style="background:${c[0]}"></i>${c[1] ? `<i style="background:${c[1]}"></i>` : ""}</button>`).join("");
  on("bg-presets", "click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const c = PRESETS[+b.dataset.i]; setP(c[1] ? { bg: "gradient", bgc1: c[0], bgc2: c[1] } : { bg: "color", bgc1: c[0] }, "style"); });

  document.addEventListener("keydown", (e) => {
    if (!cur || $("scene").hidden || e.target.closest("input, textarea, select") || document.querySelector('[data-pane="photo"]').hidden) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if (e.key === "[") setP({ brush: Math.max(4, P.brush - 6) });
    else if (e.key === "]") setP({ brush: Math.min(200, P.brush + 6) });
  });
  window.addEventListener("resize", redraw);

  // ---------- Chargement ----------
  function showErr(m) { $("err").textContent = m; $("err").hidden = false; }
  function leaveExample() { $("example").hidden = true; }
  async function select(it) {
    const prev = cur;
    cur = it; shown = null; ovCache = null;
    release(prev);
    $("vide").hidden = true; $("scene").hidden = false; $("err").hidden = true;
    $("example").hidden = !it.example;
    $("facts").textContent = `${it.W} × ${it.H} px`;
    renderThumbs(); syncPanel();
    await update();
  }
  function renderThumbs() {
    const t = $("thumbs");
    t.hidden = items.length < 2;
    if (t.hidden) return;
    t.innerHTML = items.map((it) => `<button data-id="${it.id}" aria-current="${it === cur}" title="${esc(it.name)}"><img src="${it.url}" alt="">${it.done ? "<i></i>" : ""}</button>`).join("");
  }
  on("thumbs", "click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; const it = items.find((x) => x.id === +b.dataset.id); if (it && it !== cur) select(it); });

  async function addFiles(files) {
    files = [...files].filter(Boolean);
    let first = null;
    for (const file of files) {
      const heic = /\.(heic|heif)$/i.test(file.name || "") || /hei[cf]/.test(file.type);
      if (!file.type.startsWith("image/") && !heic) { toast(trad("Ce fichier n’est pas une image.")); continue; }
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImg(url);
        const it = { id: ++uid, name: file.name || "image", url, img, W: img.naturalWidth, H: img.naturalHeight };
        if (items.length === 1 && items[0].example) { URL.revokeObjectURL(items[0].url); items = []; cur = null; }
        items.push(it);
        if (!first) first = it;
      } catch (e) {
        URL.revokeObjectURL(url);
        const msg = heic ? trad("Ce navigateur ne sait pas lire le HEIC. Ouvre LibreMedias dans Safari, ou règle l’iPhone sur « Le plus compatible » (Réglages › Appareil photo › Formats).") : trad("Ce fichier n’a pas pu être lu comme une image.");
        if (cur) showErr(msg); else toast(msg);
      }
    }
    if (first) select(first);
  }
  on("file", "change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  [$("vide"), $("stage")].forEach((dz) => {
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  });
  document.addEventListener("paste", (e) => {
    if (document.querySelector('[data-pane="photo"]').hidden) return;
    const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile());
    if (files.length) addFiles(files);
  });
  async function readImage(file) {
    const url = URL.createObjectURL(file);
    try { const img = await loadImg(url); return img; } catch (e) { URL.revokeObjectURL(url); toast(trad("Ce fichier n’a pas pu être lu comme une image.")); return null; }
  }
  on("platefile", "change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const img = await readImage(f);
    if (!img) return;
    plate = { img, name: f.name, id: ++uid };
    setP({ method: "diff" }, "compute");
  });
  on("bgfile", "change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const img = await readImage(f);
    if (!img) return;
    bgImg = img; bgImg.label = f.name;
    setP({ bg: "image" }, "style");
  });

  // ---------- Enregistrement ----------
  const toBlob = (c, type) => new Promise((ok) => c.toBlob(ok, type, 0.92));
  const outName = (it) => it.name.replace(/\.[^.]+$/, "") + "-" + trad(P.fmt === "mask" ? "masque" : "detoure") + "." + (P.fmt === "mask" ? "png" : Formats.ext(P.fmt));
  async function renderFile(it) {
    const c = P.fmt === "mask" ? compose(it, true, true, true) : compose(it, true, true);
    return Formats.save(c, P.fmt === "mask" ? "png" : P.fmt, 0.92, "#ffffff");
  }
  on("dl", "click", async () => {
    if (!cur || !cur.alpha) return;
    if (!canSave()) { toast(trad("Le téléchargement n’est pas disponible ici : utilise Copier l’image.")); return; }
    setBusy(true); await tick();
    let blob = null;
    try { blob = await renderFile(cur); } catch (e) { setBusy(false); toast(trad("Ce navigateur ne sait pas créer ce format : choisis-en un autre.")); return; }
    setBusy(false);
    if (!blob) { toast(trad("L’image n’a pas pu être créée.")); return; }
    let name = outName(cur);
    try { const s = await saveFile(name, blob); if (s === "saved") toast(trad("Image enregistrée.")); } catch (err) { toast(saveErrorText(err)); }
  });
  on("copy", "click", async () => {
    if (!cur || !cur.alpha) return;
    try {
      const c = P.fmt === "mask" ? compose(cur, true, true, true) : compose(cur, true, true);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob(c, "image/png") })]);
      toast(trad("Image copiée dans le presse-papiers."));
    } catch (e) { toast(trad("La copie d’image est bloquée par ce navigateur : utilise Télécharger.")); }
  });
  on("zip", "click", async () => {
    if (items.length < 2) return;
    const bar = $("zip-progress"), files = [], used = new Set(), keep = cur;
    bar.hidden = false; $("zip").disabled = true;
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        bar.firstElementChild.style.width = Math.round((i / items.length) * 100) + "%";
        await prepare(it); await tick();
        await computeBase(it); computeAlpha(it);
        const blob = await renderFile(it);
        let n = outName(it), k = 2;
        while (used.has(n)) n = n.replace(/(-\d+)?(\.\w+)$/, "-" + k++ + "$2");
        used.add(n);
        if (blob) files.push({ name: n, blob });
        if (it !== keep) release(it);
      }
      bar.firstElementChild.style.width = "100%";
      const s = await saveFile("libremedias.zip", await makeZip(files));
      if (s === "saved") toast(trad("Archive enregistrée."));
    } catch (err) { toast(saveErrorText(err)); }
    bar.hidden = true; $("zip").disabled = false; renderThumbs();
  });

  const opaqueFmt = () => P.fmt !== "mask" && !Formats.byId(P.fmt).alpha;
  if (P.fmt.includes("/")) P.fmt = "png";
  Formats.fill($("fmt"), null, P.fmt);
  $("fmt").insertAdjacentHTML("beforeend", `<option value="mask">${trad("Masque noir et blanc (PNG)")}</option>`);
  $("fmt").value = P.fmt;
  // Passage vers les autres onglets
  LM.hooks.photo = (f) => addFiles([f]);
  on("to-retouche", "click", async () => {
    if (!cur || !cur.alpha || !LM.hooks.retouche) return;
    const b = await toBlob(compose(cur, true, true), "image/png");
    LM.show("retouche"); LM.hooks.retouche(new File([b], cur.name.replace(/\.[^.]+$/, "") + "-" + trad("detoure") + ".png", { type: "image/png" }));
  });
  onSaveReady(syncPanel);

  // ---------- Exemple de départ ----------
  (function exemple() {
    const w = 1200, h = 900, c = mk(w, h), g = c.getContext("2d");
    const wall = g.createLinearGradient(0, 0, w, h); wall.addColorStop(0, "#9fb7c9"); wall.addColorStop(1, "#c9d6c3");
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    // Étagère et plante en arrière-plan
    g.fillStyle = "#7d8f86"; g.fillRect(0, 560, w, 26);
    g.fillStyle = "#6c7f75"; g.fillRect(70, 470, 90, 90);
    g.fillStyle = "#4f7a52"; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(115 + Math.cos(i) * 40, 430 - i * 12, 18, 46, i * 0.5 - 1.5, 0, 7); g.fill(); }
    g.fillStyle = "#b9a58c"; g.fillRect(960, 500, 60, 60); g.fillStyle = "#c86b4f"; g.fillRect(1030, 520, 40, 40);
    // Personnage
    g.fillStyle = "#e3572f"; g.beginPath(); g.moveTo(380, h); g.bezierCurveTo(390, 640, 470, 560, 600, 560); g.bezierCurveTo(730, 560, 810, 640, 820, h); g.fill();
    g.fillStyle = "#c94b28"; g.fillRect(560, 560, 80, 60);
    g.fillStyle = "#f0c19a"; g.beginPath(); g.roundRect(560, 470, 80, 110, 30); g.fill();
    g.beginPath(); g.ellipse(600, 380, 108, 128, 0, 0, 7); g.fill();
    g.fillStyle = "#3b2618"; g.beginPath(); g.ellipse(600, 330, 120, 100, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(500, 360, 34, 80, 0.15, 0, 7); g.fill(); g.beginPath(); g.ellipse(700, 360, 34, 80, -0.15, 0, 7); g.fill();
    g.fillStyle = "#2b2b2b"; [560, 640].forEach((x) => { g.beginPath(); g.arc(x, 395, 10, 0, 7); g.fill(); });
    g.strokeStyle = "#9a4a2c"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(600, 430, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    // Grain de photo
    const id = g.getImageData(0, 0, w, h);
    let s = 7;
    for (let i = 0; i < id.data.length; i += 4) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const n = ((s >>> 24) - 128) / 22; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    g.putImageData(id, 0, 0);
    c.toBlob((b) => {
      if (items.length || !b) return;
      const url = URL.createObjectURL(b);
      loadImg(url).then((img) => {
        if (items.length) return;
        const it = { id: ++uid, name: trad("exemple") + ".png", url, img, W: w, H: h, example: true };
        items.push(it); select(it);
      });
    }, "image/png");
  })();

  // ---------- ZIP (sans compression : les images le sont déjà) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }
  window.LibreZip = makeZip;

  syncPanel();
})();
