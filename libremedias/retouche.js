/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreMedias — retouche : recadrage, rotation, miroir, redressement, réglages, filtres, texte,
// bibliothèque de pictogrammes et de logos, filigrane, dimensions en pixels, enregistrement dans de nombreux formats
(function () {
  enableDownloads();
  const LM = (window.LM = window.LM || { hooks: {}, tabListeners: [] });
  const $r = (id) => document.getElementById("r-" + id);
  const cv = $r("cv"), ctx = cv.getContext("2d");
  const PREF = "libremedias-retouche-v1", LOGOS = "libremedias-logos-v1";
  const P = Object.assign({ fmt: "jpeg", q: 88, bg: "#ffffff", ratio: "free", iconColor: "#ffffff", font: "sans", tcolor: "#ffffff", lock: true }, loadPref(PREF, {}));
  const savePrefs = () => savePref(PREF, P);
  const PREVIEW = 1400, MAXPIX = 16777216;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const tick = () => new Promise((ok) => setTimeout(ok, 16));
  let toastT = 0;
  const rtoast = (t) => { const el = $r("toast"); el.textContent = t; clearTimeout(toastT); toastT = setTimeout(() => (el.textContent = ""), 4000); };

  // ---------- Pictogrammes (dessinés pour LibreMedias, grille 24 × 24) ----------
  const C = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z ";
  const ICONS = {
    etoile: ["M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"],
    coeur: ["M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"],
    ok: [C + "M10.6 16.2L6.4 12l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4z", 1],
    non: [C + "M8.5 7.1L12 10.6l3.5-3.5 1.4 1.4L13.4 12l3.5 3.5-1.4 1.4L12 13.4l-3.5 3.5-1.4-1.4 3.5-3.5-3.5-3.5z", 1],
    fleche: ["M2 10h13V5l7 7-7 7v-5H2z"],
    haut: ["M10 22V9H5l7-7 7 7h-5v13z"],
    bulle: ["M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"],
    lieu: ["M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z M12 6.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z", 1],
    soleil: ["M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z M11 1h2v4h-2z M11 19h2v4h-2z M1 11h4v2H1z M19 11h4v2h-4z M3.5 4.9l1.4-1.4 2.8 2.8-1.4 1.4z M16.3 17.7l1.4-1.4 2.8 2.8-1.4 1.4z M3.5 19.1l2.8-2.8 1.4 1.4-2.8 2.8z M16.3 6.3l2.8-2.8 1.4 1.4-2.8 2.8z"],
    lune: ["M14.5 2.3A10 10 0 1 0 21.7 14.5 8 8 0 1 1 14.5 2.3z"],
    nuage: ["M6.5 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.6 8.6 5 5 0 0 1 17.5 19z"],
    eclair: ["M13 2L4 14h6l-1 8 9-12h-6z"],
    note: ["M9 3v11.3A3.5 3.5 0 1 0 11 17V7h8V3z"],
    photo: ["M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M12 9.5a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", 1],
    mail: ["M2 5h20v14H2z M4 7v.4l8 6 8-6V7l-8 6z", 1],
    tel: ["M6.6 2.5l3 3.8-1.8 2.3c1.3 2.7 3.4 4.8 6.1 6.1l2.3-1.8 3.8 3-1.8 3.6C11.4 20.5 3.5 12.6 3 4.3z"],
    maison: ["M12 3l10 9h-3v9h-5v-6h-4v6H5v-9H2z"],
    panier: ["M2 3h3.2l.7 3H22l-2.6 9H8.1l.5 2H19v2H7L4.2 5H2z M9 19.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z M17 19.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z"],
    cadeau: ["M3 8h18v4H3z M4 13h16v9H4z M11 8h2v14h-2z M12 8C10 4 6.5 4 7 7z M12 8c2-4 5.5-4 5-1z", 1],
    prix: ["M2 12V3h9l11 11-8 8z M7 5.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z", 1],
    heure: [C + "M11 6h2v5.6l3.6 3.6-1.4 1.4L11 12.4z", 1],
    cadenas: ["M6 10V7a6 6 0 0 1 12 0v3h1v12H5V10z M8 10h8V7a4 4 0 0 0-8 0z", 1],
    couronne: ["M2 7l5 4 5-7 5 7 5-4-2 12H4z"],
    eclat: ["M12 1c1 6 4 9 11 11-7 2-10 5-11 11-1-6-4-9-11-11 7-2 10-5 11-11z"],
    sourire: [C + "M8.5 8a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z M15.5 8a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z M7 14h10a5 5 0 0 1-10 0z", 1],
    lecture: [C + "M10 7.5v9l7-4.5z", 1],
    info: [C + "M11 10h2v7h-2z M11 6.5h2v2h-2z", 1],
    attention: ["M12 2L1 21h22z M11 9h2v6h-2z M11 16.5h2v2h-2z", 1],
    copyright: [C + "M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z M15.5 9.3A4.5 4.5 0 1 0 15.5 14.7l-1.5-1.3A2.5 2.5 0 1 1 14 10.6z", 1],
    medaille: ["M12 1l2.4 2 3.1-.3.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.3L12 19l-2.4-2-3.1.3-.9-3-2.7-1.6 1-3-1-3 2.7-1.6.9-3 3.1.3z"],
    drapeau: ["M5 2h2v20H5z M8 3h11l-2.5 4.5L19 12H8z"],
    cloche: ["M12 2a1.5 1.5 0 0 0-1.5 1.5v.7A6 6 0 0 0 6 10v5l-2 3h16l-2-3v-5a6 6 0 0 0-4.5-5.8v-.7A1.5 1.5 0 0 0 12 2z M10 20a2 2 0 0 0 4 0z"],
    plus: ["M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"],
    rond: [C],
    carre: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"],
    cadre: ["M2 2h20v20H2z M4 4v16h16V4z", 1],
  };
  const NOMS = { etoile: "Étoile", coeur: "Cœur", ok: "Validé", non: "Refusé", fleche: "Flèche", haut: "Flèche vers le haut", bulle: "Bulle", lieu: "Lieu", soleil: "Soleil", lune: "Lune", nuage: "Nuage", eclair: "Éclair", note: "Note de musique", photo: "Appareil photo", mail: "E-mail", tel: "Téléphone", maison: "Maison", panier: "Panier", cadeau: "Cadeau", prix: "Étiquette de prix", heure: "Horloge", cadenas: "Cadenas", couronne: "Couronne", eclat: "Étincelle", sourire: "Sourire", lecture: "Lecture", info: "Information", attention: "Attention", copyright: "Copyright", medaille: "Médaille", drapeau: "Drapeau", cloche: "Cloche", plus: "Plus", rond: "Rond", carre: "Carré", cadre: "Cadre" };
  const paths = {};
  const iconPath = (id) => paths[id] || (paths[id] = new Path2D(ICONS[id][0]));

  // ---------- Logos de l'utilisateur (gardés dans ce navigateur) ----------
  let logos = [];
  try { logos = JSON.parse(localStorage.getItem(LOGOS) || "[]"); } catch (e) { logos = []; }
  const logoImgs = new Map();
  function logoImg(id) {
    if (logoImgs.has(id)) return logoImgs.get(id);
    const l = logos.find((x) => x.id === id);
    if (!l) return null;
    const i = new Image(); i.onload = () => redraw(); i.src = l.src;
    logoImgs.set(id, i);
    return i;
  }
  function saveLogos() {
    try { localStorage.setItem(LOGOS, JSON.stringify(logos)); return true; }
    catch (e) { rtoast(trad("Plus de place pour garder ce logo dans le navigateur : retires-en un.")); return false; }
  }

  // ---------- État ----------
  let src = null, name = "image", W = 0, H = 0, E = null, hist = [], hpos = -1, sel = null, mode = "edit";
  const ADJ = { bri: 0, con: 0, exp: 0, sat: 0, temp: 0, tint: 0, sharp: 0, vig: 0 };
  const FILTRES = {
    aucun: {}, nb: { sat: -100, con: 10 }, sepia: { sepia: 1, con: 5 }, vintage: { sepia: 0.45, con: -12, sat: -20, vig: 35, bri: 4 },
    chaud: { temp: 30, sat: 10 }, froid: { temp: -30, tint: -5 }, vif: { sat: 35, con: 15 }, doux: { con: -18, bri: 6, sat: -8 },
    drame: { con: 40, sat: -25, vig: 45, exp: -10 }, mat: { con: -25, bri: 8, sat: -12, fade: 1 },
  };
  function fresh() {
    return { rot: 0, fh: false, fv: false, str: 0, crop: null, adj: { ...ADJ }, filter: "aucun", items: [], out: null };
  }
  const odims = () => (E.rot % 2 ? [H, W] : [W, H]);
  const crop = () => E.crop || { x: 0, y: 0, w: odims()[0], h: odims()[1] };
  const curItem = () => E.items.find((i) => i.id === sel) || null;

  // ---------- Rendu ----------
  // Image orientée (rotation, miroir, redressement) puis réglée, à l'échelle k
  const cache = { key: "", c: null };
  function base(k) {
    const [ow, oh] = odims(), key = [k, E.rot, E.fh, E.fv, E.str, JSON.stringify(E.adj), E.filter].join("|");
    if (cache.key === key) return cache.c;
    const c = mk(ow * k, oh * k), g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    const a = (E.str * Math.PI) / 180, z = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * Math.max(ow / oh, oh / ow);
    g.translate(c.width / 2, c.height / 2);
    g.rotate((E.rot * Math.PI) / 2 + a);
    g.scale((E.fh ? -1 : 1) * z, (E.fv ? -1 : 1) * z);
    g.drawImage(src, (-W * k) / 2, (-H * k) / 2, W * k, H * k);
    g.setTransform(1, 0, 0, 1, 0, 0);
    adjust(g, c.width, c.height);
    cache.key = key; cache.c = c;
    return c;
  }
  function adjust(g, w, h) {
    const f = FILTRES[E.filter] || {}, a = {};
    for (const k in ADJ) a[k] = E.adj[k] + (f[k] || 0);
    const sepia = f.sepia || 0, fade = f.fade || 0;
    if (!Object.keys(ADJ).some((k) => k !== "vig" && a[k]) && !sepia && !fade) return;
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const ex = Math.pow(2, a.exp / 50), br = a.bri * 1.28, cf = (259 * (a.con * 1.275 + 255)) / (255 * (259 - a.con * 1.275)), sf = 1 + a.sat / 100;
    const tr = a.temp * 0.6, tg = -a.tint * 0.5, lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) { let x = (v * ex + br - 128) * cf + 128; if (fade) x = 20 + x * 0.88; lut[v] = x; }
    for (let i = 0; i < d.length; i += 4) {
      let r = lut[d[i]] + tr, gg = lut[d[i + 1]] + tg, b = lut[d[i + 2]] - tr;
      const y = 0.299 * r + 0.587 * gg + 0.114 * b;
      r = y + (r - y) * sf; gg = y + (gg - y) * sf; b = y + (b - y) * sf;
      if (sepia) {
        const sr = 0.393 * r + 0.769 * gg + 0.189 * b, sg = 0.349 * r + 0.686 * gg + 0.168 * b, sb = 0.272 * r + 0.534 * gg + 0.131 * b;
        r += (sr - r) * sepia; gg += (sg - gg) * sepia; b += (sb - b) * sepia;
      }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
    if (a.sharp > 0) sharpen(d, w, h, a.sharp / 100);
    g.putImageData(id, 0, 0);
  }
  // Accentuation : image + amount × (image − moyenne 3 × 3)
  function sharpen(d, w, h, amt) {
    const s = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const m = (s[p - 4 + c] + s[p + 4 + c] + s[p - w * 4 + c] + s[p + w * 4 + c] + s[p - w * 4 - 4 + c] + s[p - w * 4 + 4 + c] + s[p + w * 4 - 4 + c] + s[p + w * 4 + 4 + c] + s[p + c]) / 9;
        d[p + c] = s[p + c] + (s[p + c] - m) * amt * 2.5;
      }
    }
  }
  // Image finale (cadre de recadrage) à l'échelle k
  function compose(k, withItems) {
    const c = crop(), out = mk(c.w * k, c.h * k), g = out.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    const bk = Math.min(1, k), b = base(bk);
    g.drawImage(b, c.x * bk, c.y * bk, c.w * bk, c.h * bk, 0, 0, out.width, out.height);
    const f = FILTRES[E.filter] || {}, vig = E.adj.vig + (f.vig || 0);
    if (vig > 0) {
      const r = Math.hypot(out.width, out.height) / 2, gr = g.createRadialGradient(out.width / 2, out.height / 2, r * 0.35, out.width / 2, out.height / 2, r);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${(vig / 100) * 0.85})`);
      g.fillStyle = gr; g.fillRect(0, 0, out.width, out.height);
    }
    if (withItems) for (const it of E.items) drawItem(g, it, k, c);
    return out;
  }
  const FONTS = { sans: "Figtree, system-ui, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "'JetBrains Mono', ui-monospace, monospace", script: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive", impact: "Impact, Haettenschweiler, 'Arial Black', sans-serif" };
  function itemSize(it, g) {
    if (it.type === "text") {
      g.font = `${it.bold ? 800 : 500} ${it.size}px ${FONTS[it.font] || FONTS.sans}`;
      const lines = String(it.text || " ").split("\n"), lh = it.size * 1.2;
      const w = Math.max(...lines.map((l) => g.measureText(l || " ").width)) + (it.box ? it.size * 0.8 : 0);
      return [w, lines.length * lh + (it.box ? it.size * 0.4 : 0)];
    }
    if (it.type === "logo") { const i = logoImg(it.logo); return [it.w, i && i.naturalWidth ? (it.w * i.naturalHeight) / i.naturalWidth : it.w]; }
    return [it.w, it.w];
  }
  const measure = mk(1, 1).getContext("2d");
  function drawOne(g, it) {
    // Dessine l'élément centré sur l'origine, en unités de l'image d'origine
    const [w, h] = itemSize(it, g);
    if (it.type === "text") {
      g.font = `${it.bold ? 800 : 500} ${it.size}px ${FONTS[it.font] || FONTS.sans}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      if (it.box) { g.fillStyle = it.box; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, it.size * 0.25); g.fill(); }
      const lines = String(it.text || "").split("\n"), lh = it.size * 1.2;
      lines.forEach((l, i) => {
        const y = (i - (lines.length - 1) / 2) * lh;
        if (it.stroke) { g.lineJoin = "round"; g.lineWidth = it.size * 0.14; g.strokeStyle = it.stroke; g.strokeText(l, 0, y); }
        if (it.shadow) { g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = it.size * 0.25; g.shadowOffsetY = it.size * 0.06; }
        g.fillStyle = it.color; g.fillText(l, 0, y);
        g.shadowColor = "transparent";
      });
    } else if (it.type === "icon") {
      g.save(); g.scale(w / 24, h / 24); g.translate(-12, -12);
      if (it.shadow) { g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 1.2; g.shadowOffsetY = 0.4; }
      g.fillStyle = it.color; g.fill(iconPath(it.icon), ICONS[it.icon][1] ? "evenodd" : "nonzero");
      g.restore();
    } else {
      const i = logoImg(it.logo);
      if (i && i.complete && i.naturalWidth) g.drawImage(i, -w / 2, -h / 2, w, h);
    }
    return [w, h];
  }
  function drawItem(g, it, k, c) {
    g.save();
    g.globalAlpha = it.opacity / 100;
    if (it.tile) {
      // Filigrane répété sur toute l'image
      const [w, h] = itemSize(it, measure), sx = Math.max(w, h) * 1.8, sy = Math.max(w, h) * 1.4;
      for (let y = -sy; y < c.h + sy; y += sy) for (let x = -sx + ((y / sy) % 2 ? sx / 2 : 0); x < c.w + sx; x += sx) {
        g.save(); g.scale(k, k); g.translate(x, y); g.rotate((it.rot * Math.PI) / 180); drawOne(g, it); g.restore();
      }
    } else {
      g.scale(k, k); g.translate(it.x - c.x, it.y - c.y); g.rotate((it.rot * Math.PI) / 180); drawOne(g, it);
    }
    g.restore();
  }

  // ---------- Affichage ----------
  let s = 1, cropDrag = null, itemDrag = null;
  const pk = () => Math.min(1, PREVIEW / Math.max(...odims()));
  function draw() {
    if (!src) return;
    s = pk();
    if (mode === "crop") {
      const b = base(s);
      if (cv.width !== b.width || cv.height !== b.height) { cv.width = b.width; cv.height = b.height; }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(b, 0, 0);
      const c = cropDrag ? cropDrag.r : crop();
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x * s, c.y * s, c.w * s, c.h * s); ctx.fill("evenodd");
      const lw = cssK();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * lw; ctx.strokeRect(c.x * s, c.y * s, c.w * s, c.h * s);
      ctx.lineWidth = 1 * lw; ctx.strokeStyle = "rgba(255,255,255,.5)";
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo((c.x + (c.w * i) / 3) * s, c.y * s); ctx.lineTo((c.x + (c.w * i) / 3) * s, (c.y + c.h) * s);
        ctx.moveTo(c.x * s, (c.y + (c.h * i) / 3) * s); ctx.lineTo((c.x + c.w) * s, (c.y + (c.h * i) / 3) * s); ctx.stroke();
      }
      const hs = 10 * lw;
      ctx.fillStyle = "#fff";
      cropCorners(c).forEach(([x, y]) => ctx.fillRect(x * s - hs / 2, y * s - hs / 2, hs, hs));
      ctx.restore();
    } else {
      const out = compose(s, true);
      if (cv.width !== out.width || cv.height !== out.height) { cv.width = out.width; cv.height = out.height; }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(out, 0, 0);
      const it = curItem();
      if (it && !it.tile) {
        const c = crop(), [w, h] = itemSize(it, measure), lw = cssK();
        ctx.save();
        ctx.translate((it.x - c.x) * s, (it.y - c.y) * s); ctx.rotate((it.rot * Math.PI) / 180);
        ctx.setLineDash([6 * lw, 4 * lw]); ctx.lineWidth = 1.5 * lw;
        ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.strokeRect((-w / 2) * s, (-h / 2) * s, w * s, h * s);
        ctx.lineDashOffset = 5 * lw; ctx.strokeStyle = "#fff"; ctx.strokeRect((-w / 2) * s, (-h / 2) * s, w * s, h * s);
        ctx.setLineDash([]);
        const hs = 12 * lw;
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.8)";
        ctx.beginPath(); ctx.rect((w / 2) * s - hs / 2, (h / 2) * s - hs / 2, hs, hs); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    sync();
  }
  let raf = 0;
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  function cssK() { const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; }
  const cropCorners = (c) => [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]];

  // ---------- Historique ----------
  const snap = () => JSON.stringify(E);
  function commit() {
    const v = snap(); if (v === hist[hpos]) return;
    hist = hist.slice(0, hpos + 1); hist.push(v);
    if (hist.length > 80) hist.shift();
    hpos = hist.length - 1; sync();
  }
  let ct = 0;
  const commitSoon = () => { clearTimeout(ct); ct = setTimeout(commit, 350); };
  function restore(i) { hpos = i; E = JSON.parse(hist[i]); if (!curItem()) sel = null; cache.key = ""; draw(); syncPanel(); }
  const undo = () => { clearTimeout(ct); commit(); if (hpos > 0) restore(hpos - 1); };
  const redo = () => { if (hpos < hist.length - 1) restore(hpos + 1); };
  function change(fn, soon) { fn(); cache.key = cache.key; if (soon) commitSoon(); else commit(); redraw(); syncPanel(); }

  // ---------- Pointeur ----------
  function pt(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width / s, ((e.clientY - r.top) / r.height) * cv.height / s]; }
  const ratioOf = () => {
    if (P.ratio === "free") return 0;
    if (P.ratio === "orig") return W / H;
    const [a, b] = P.ratio.split(":").map(Number); return a / b;
  };
  function fitRatio(r, anchor) {
    const R = ratioOf(), [ow, oh] = odims();
    if (R) { if (r.w / r.h > R) r.w = r.h * R; else r.h = r.w / R; }
    if (anchor) { if (anchor[0] > r.x) r.x = anchor[0] - r.w; if (anchor[1] > r.y) r.y = anchor[1] - r.h; }
    r.x = Math.max(0, Math.min(ow - r.w, r.x)); r.y = Math.max(0, Math.min(oh - r.h, r.y));
    r.w = Math.min(r.w, ow); r.h = Math.min(r.h, oh);
    return r;
  }
  function hitItem(p) {
    const c = crop();
    for (let i = E.items.length - 1; i >= 0; i--) {
      const it = E.items[i];
      if (it.tile) continue;
      const [w, h] = itemSize(it, measure), a = (-it.rot * Math.PI) / 180, dx = p[0] + c.x - it.x, dy = p[1] + c.y - it.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a), m = 10 * cssK() / s;
      if (Math.abs(lx - w / 2) < m * 1.5 && Math.abs(ly - h / 2) < m * 1.5 && it.id === sel) return { it, handle: true };
      if (Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2) return { it };
    }
    return null;
  }
  cv.addEventListener("pointerdown", (e) => {
    if (!src || e.button > 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const p = pt(e);
    if (mode === "crop") {
      const c = crop(), m = (14 * cssK()) / s;
      const h = cropCorners(c).findIndex(([x, y]) => Math.abs(p[0] - x) < m && Math.abs(p[1] - y) < m);
      if (h >= 0) cropDrag = { kind: "corner", opp: cropCorners(c)[(h + 2) % 4], r: { ...c } };
      else if (p[0] > c.x && p[0] < c.x + c.w && p[1] > c.y && p[1] < c.y + c.h) cropDrag = { kind: "move", p0: p, c0: { ...c }, r: { ...c } };
      else cropDrag = { kind: "corner", opp: p, r: { x: p[0], y: p[1], w: 1, h: 1 } };
      return;
    }
    const hit = hitItem(p);
    if (hit) {
      sel = hit.it.id;
      itemDrag = hit.handle ? { kind: "size", it: hit.it, p0: p, w0: hit.it.type === "text" ? hit.it.size : hit.it.w } : { kind: "move", it: hit.it, p0: p, x0: hit.it.x, y0: hit.it.y };
    } else sel = null;
    draw(); syncPanel();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!src) return;
    const p = pt(e), [ow, oh] = odims();
    if (cropDrag) {
      if (cropDrag.kind === "move") {
        const r = cropDrag.r, c0 = cropDrag.c0;
        r.x = Math.max(0, Math.min(ow - r.w, c0.x + p[0] - cropDrag.p0[0])); r.y = Math.max(0, Math.min(oh - r.h, c0.y + p[1] - cropDrag.p0[1]));
      } else {
        const q = [Math.max(0, Math.min(ow, p[0])), Math.max(0, Math.min(oh, p[1]))], o = cropDrag.opp;
        cropDrag.r = fitRatio({ x: Math.min(o[0], q[0]), y: Math.min(o[1], q[1]), w: Math.max(4, Math.abs(q[0] - o[0])), h: Math.max(4, Math.abs(q[1] - o[1])) }, q[0] < o[0] || q[1] < o[1] ? o : null);
      }
      redraw(); return;
    }
    if (itemDrag) {
      const it = itemDrag.it;
      if (itemDrag.kind === "move") { it.x = itemDrag.x0 + p[0] - itemDrag.p0[0]; it.y = itemDrag.y0 + p[1] - itemDrag.p0[1]; }
      else {
        const c = crop(), d0 = Math.hypot(itemDrag.p0[0] + c.x - it.x, itemDrag.p0[1] + c.y - it.y), d1 = Math.hypot(p[0] + c.x - it.x, p[1] + c.y - it.y);
        const v = Math.max(4, itemDrag.w0 * (d1 / Math.max(1, d0)));
        if (it.type === "text") it.size = v; else it.w = v;
      }
      redraw(); syncPanel();
      return;
    }
    if (mode === "edit") { const h = hitItem(p); cv.style.cursor = h ? (h.handle ? "nwse-resize" : "move") : "default"; }
  });
  function endDrag() {
    if (cropDrag) { const r = cropDrag.r; cropDrag = null; if (r.w > 4 && r.h > 4) change(() => { E.crop = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }; }); else redraw(); }
    if (itemDrag) { itemDrag = null; commit(); }
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  // ---------- Panneau ----------
  const SL = { bri: [-100, 100], con: [-100, 100], exp: [-100, 100], sat: [-100, 100], temp: [-100, 100], tint: [-100, 100], sharp: [0, 100], vig: [0, 100] };
  function outSize() {
    const c = crop();
    if (!E.out) return [c.w, c.h];
    return [E.out.w, E.out.h];
  }
  function syncPanel() {
    const ok = !!src;
    $r("vide").hidden = ok; $r("demo-row").hidden = ok; $r("scene").hidden = !ok;
    if (!ok) return;
    document.querySelectorAll("#r-modes .tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    $r("ratio").value = P.ratio;
    for (const k in SL) { $r(k).value = E.adj[k]; $r(k + "-o").textContent = (E.adj[k] > 0 && SL[k][0] < 0 ? "+" : "") + E.adj[k]; }
    $r("str").value = E.str; $r("str-o").textContent = E.str + "°";
    document.querySelectorAll("#r-filtres [data-f]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === E.filter)));
    const it = curItem();
    $r("sel").hidden = !it;
    $r("sel-text").hidden = !(it && it.type === "text");
    $r("sel-color").hidden = !(it && (it.type === "text" || it.type === "icon"));
    if (it) {
      if (document.activeElement !== $r("text")) $r("text").value = it.text || "";
      $r("font").value = it.font || "sans"; $r("bold").checked = !!it.bold;
      $r("icolor").value = it.color || "#ffffff";
      $r("stroke").checked = !!it.stroke; $r("boxed").checked = !!it.box; $r("ishadow").checked = !!it.shadow;
      $r("isize").value = Math.round(it.type === "text" ? it.size : it.w); $r("isize-o").textContent = Math.round(it.type === "text" ? it.size : it.w) + " px";
      $r("isize").max = Math.max(...odims());
      $r("irot").value = it.rot; $r("irot-o").textContent = it.rot + "°";
      $r("iop").value = it.opacity; $r("iop-o").textContent = it.opacity + " %";
      $r("tile").checked = !!it.tile;
    }
    const [w, h] = outSize();
    if (document.activeElement !== $r("ow")) $r("ow").value = w;
    if (document.activeElement !== $r("oh")) $r("oh").value = h;
    $r("lock").checked = P.lock;
    const f = Formats.byId(P.fmt);
    $r("fmt").value = P.fmt; $r("q-row").hidden = !f.quality; $r("q").value = P.q; $r("q-o").textContent = P.q + " %";
    $r("bg-row").hidden = f.alpha; $r("bg").value = P.bg;
    $r("facts").textContent = `${W} × ${H} px → ${w} × ${h} px`;
    $r("logos").innerHTML = logos.map((l) => `<span class="lg"><button class="sw lib" data-logo="${l.id}" title="${esc(l.name)}"><img src="${l.src}" alt=""></button><button class="iconbtn x" data-dellogo="${l.id}" aria-label="${esc(trad("Supprimer ce logo"))}" title="${esc(trad("Supprimer ce logo"))}">×</button></span>`).join("");
  }
  function sync() { $r("undo").disabled = hpos <= 0; $r("redo").disabled = hpos >= hist.length - 1; }

  $r("modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (!b) return; mode = b.dataset.mode; sel = null; draw(); syncPanel(); });
  $r("ratio").addEventListener("input", () => {
    P.ratio = $r("ratio").value; savePrefs();
    if (P.ratio === "free") return;
    mode = "crop";
    const [ow, oh] = odims(), R = ratioOf();
    let w = ow, h = ow / R; if (h > oh) { h = oh; w = oh * R; }
    change(() => { E.crop = { x: Math.round((ow - w) / 2), y: Math.round((oh - h) / 2), w: Math.round(w), h: Math.round(h) }; });
  });
  $r("crop-reset").addEventListener("click", () => change(() => { E.crop = null; }));
  const rotate = (d) => change(() => { E.rot = (E.rot + d + 4) % 4; E.crop = null; E.out = null; });
  $r("rotl").addEventListener("click", () => rotate(-1));
  $r("rotr").addEventListener("click", () => rotate(1));
  $r("fliph").addEventListener("click", () => change(() => { E.fh = !E.fh; }));
  $r("flipv").addEventListener("click", () => change(() => { E.fv = !E.fv; }));
  $r("str").addEventListener("input", () => change(() => { E.str = +$r("str").value; }, true));
  for (const k in SL) $r(k).addEventListener("input", () => change(() => { E.adj[k] = +$r(k).value; }, true));
  $r("adj-reset").addEventListener("click", () => change(() => { E.adj = { ...ADJ }; E.filter = "aucun"; }));
  $r("filtres").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) change(() => { E.filter = b.dataset.f; }); });

  // Éléments ajoutés
  let uid = 0;
  function addItem(it) {
    const c = crop();
    it.id = Date.now() + ++uid; it.x = c.x + c.w / 2; it.y = c.y + c.h / 2; it.rot = 0; it.opacity = 100;
    mode = "edit"; sel = it.id;
    change(() => E.items.push(it));
  }
  $r("add-text").addEventListener("click", () => {
    const c = crop();
    addItem({ type: "text", text: trad("Ton texte"), font: P.font, size: Math.round(Math.max(c.w, c.h) / 12), color: P.tcolor, bold: true, stroke: "", box: "", shadow: true });
    setTimeout(() => { $r("text").focus(); $r("text").select(); }, 50);
  });
  $r("icons").innerHTML = Object.keys(ICONS).map((k) => `<button class="sw lib" data-icon="${k}" title="${esc(trad(NOMS[k]))}" aria-label="${esc(trad(NOMS[k]))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k][0]}" fill-rule="${ICONS[k][1] ? "evenodd" : "nonzero"}"/></svg></button>`).join("");
  $r("icons").addEventListener("click", (e) => {
    const b = e.target.closest("[data-icon]"); if (!b || !src) return;
    const c = crop();
    addItem({ type: "icon", icon: b.dataset.icon, color: P.iconColor, w: Math.round(Math.min(c.w, c.h) / 5), shadow: false });
  });
  $r("logos").addEventListener("click", (e) => {
    const d = e.target.closest("[data-dellogo]");
    if (d) { logos = logos.filter((l) => l.id !== d.dataset.dellogo); logoImgs.delete(d.dataset.dellogo); saveLogos(); syncPanel(); return; }
    const b = e.target.closest("[data-logo]"); if (!b || !src) return;
    const c = crop();
    addItem({ type: "logo", logo: b.dataset.logo, w: Math.round(Math.min(c.w, c.h) / 4) });
  });
  $r("logo-add").addEventListener("click", () => $r("logofile").click());
  $r("logofile").addEventListener("change", async (e) => {
    for (const f of [...e.target.files]) {
      try {
        const url = URL.createObjectURL(f), i = await loadImg(url);
        // Réduit à 600 px au plus et garde la transparence
        const k = Math.min(1, 600 / Math.max(i.naturalWidth || 600, i.naturalHeight || 600)), c = mk((i.naturalWidth || 600) * k, (i.naturalHeight || 600) * k);
        c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const l = { id: "l" + Date.now() + Math.floor(Math.random() * 1e4), name: f.name, src: c.toDataURL("image/png") };
        logos.push(l);
        if (!saveLogos()) logos.pop();
        else if (src) addItem({ type: "logo", logo: l.id, w: Math.round(Math.min(crop().w, crop().h) / 4) });
      } catch (err) { rtoast(trad("Ce fichier n’a pas pu être lu comme une image.")); }
    }
    e.target.value = ""; syncPanel();
  });
  $r("ipcolor").value = P.iconColor;
  $r("ipcolor").addEventListener("input", () => { P.iconColor = $r("ipcolor").value; savePrefs(); });
  const editSel = (fn, soon) => { const it = curItem(); if (it) change(() => fn(it), soon); };
  $r("text").addEventListener("input", () => editSel((it) => (it.text = $r("text").value), true));
  $r("font").addEventListener("input", () => { P.font = $r("font").value; savePrefs(); editSel((it) => (it.font = P.font)); });
  $r("bold").addEventListener("input", () => editSel((it) => (it.bold = $r("bold").checked)));
  $r("icolor").addEventListener("input", () => editSel((it) => { it.color = $r("icolor").value; if (it.type === "text") P.tcolor = it.color; else P.iconColor = it.color; savePrefs(); }, true));
  $r("stroke").addEventListener("input", () => editSel((it) => (it.stroke = $r("stroke").checked ? (luma(it.color) > 128 ? "#000000" : "#ffffff") : "")));
  $r("boxed").addEventListener("input", () => editSel((it) => (it.box = $r("boxed").checked ? (luma(it.color) > 128 ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.8)") : "")));
  $r("ishadow").addEventListener("input", () => editSel((it) => (it.shadow = $r("ishadow").checked)));
  $r("isize").addEventListener("input", () => editSel((it) => { if (it.type === "text") it.size = +$r("isize").value; else it.w = +$r("isize").value; }, true));
  $r("irot").addEventListener("input", () => editSel((it) => (it.rot = +$r("irot").value), true));
  $r("iop").addEventListener("input", () => editSel((it) => (it.opacity = +$r("iop").value), true));
  $r("tile").addEventListener("input", () => editSel((it) => { it.tile = $r("tile").checked; if (it.tile && it.opacity === 100) it.opacity = 35; }));
  $r("idel").addEventListener("click", () => { const it = curItem(); if (it) { sel = null; change(() => (E.items = E.items.filter((x) => x !== it))); } });
  $r("idup").addEventListener("click", () => { const it = curItem(); if (!it) return; const n = JSON.parse(JSON.stringify(it)); n.id = Date.now() + ++uid; n.x += 30; n.y += 30; sel = n.id; change(() => E.items.push(n)); });
  $r("ifront").addEventListener("click", () => { const it = curItem(); if (it) change(() => { E.items = E.items.filter((x) => x !== it); E.items.push(it); }); });
  const luma = (h) => { const v = parseInt(String(h).slice(1), 16) || 0; return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255); };

  // Dimensions de sortie
  function setOut(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (w * h > MAXPIX) { const k = Math.sqrt(MAXPIX / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); rtoast(trad("Taille limitée à 16 millions de pixels.")); }
    const c = crop();
    change(() => { E.out = w === c.w && h === c.h ? null : { w, h }; }, true);
  }
  $r("ow").addEventListener("change", () => { const c = crop(), w = +$r("ow").value || 1; setOut(w, P.lock ? (w * c.h) / c.w : outSize()[1]); });
  $r("oh").addEventListener("change", () => { const c = crop(), h = +$r("oh").value || 1; setOut(P.lock ? (h * c.w) / c.h : outSize()[0], h); });
  $r("lock").addEventListener("input", () => { P.lock = $r("lock").checked; savePrefs(); });
  $r("sizes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    const c = crop(), v = b.dataset.s;
    if (v.endsWith("%")) { const k = parseFloat(v) / 100; setOut(c.w * k, c.h * k); }
    else { const k = +v / Math.max(c.w, c.h); setOut(c.w * k, c.h * k); }
  });

  // ---------- Enregistrement ----------
  Formats.fill($r("fmt"), null, P.fmt);
  $r("fmt").addEventListener("input", () => { P.fmt = $r("fmt").value; savePrefs(); syncPanel(); });
  $r("q").addEventListener("input", () => { P.q = +$r("q").value; savePrefs(); syncPanel(); });
  $r("bg").addEventListener("input", () => { P.bg = $r("bg").value; savePrefs(); });
  function renderOut() {
    const c = crop(), [w, h] = outSize(), k = w / c.w, img = compose(k, true);
    if (img.width === w && img.height === h) return img;
    const o = mk(w, h), g = o.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, w, h);
    return o;
  }
  const baseName = () => name.replace(/\.[^.]+$/, "");
  $r("dl").addEventListener("click", async () => {
    if (!src) return;
    if (!canSave()) { rtoast(trad("Le téléchargement n’est pas disponible ici : utilise Copier l’image.")); return; }
    $r("dl").disabled = true; await tick();
    try {
      const blob = await Formats.save(renderOut(), P.fmt, P.q / 100, P.bg);
      const s2 = await saveFile(baseName() + "-" + trad("retouche") + "." + Formats.ext(P.fmt), blob);
      if (s2 === "saved") rtoast(trad("Image enregistrée."));
    } catch (err) { rtoast(err && err.code === "format" ? trad("Ce navigateur ne sait pas créer ce format : choisis-en un autre.") : saveErrorText(err)); }
    $r("dl").disabled = false;
  });
  $r("copy").addEventListener("click", async () => {
    if (!src) return;
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": new Promise((ok) => renderOut().toBlob(ok, "image/png")) })]); rtoast(trad("Image copiée dans le presse-papiers.")); }
    catch (e) { rtoast(trad("La copie d’image est bloquée par ce navigateur : utilise Télécharger.")); }
  });
  async function sendTo(tab) {
    if (!src || !LM.hooks[tab]) return;
    const b = await new Promise((ok) => renderOut().toBlob(ok, "image/png"));
    LM.show(tab); LM.hooks[tab](new File([b], baseName() + ".png", { type: "image/png" }));
  }
  $r("to-photo").addEventListener("click", () => sendTo("photo"));
  $r("to-flou").addEventListener("click", () => sendTo("flou"));
  $r("undo").addEventListener("click", undo);
  $r("redo").addEventListener("click", redo);
  const visible = () => !document.querySelector('[data-pane="retouche"]').hidden;
  document.addEventListener("keydown", (e) => {
    if (!src || !visible() || e.target.closest("input, textarea, select")) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); $r("idel").click(); }
    else if (e.key === "Escape") { sel = null; draw(); syncPanel(); }
  });
  window.addEventListener("resize", redraw);

  // ---------- Chargement ----------
  const loadImg = (url) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
  let srcUrl = null;
  async function openFile(file) {
    if (!file) return;
    const heic = /\.(heic|heif)$/i.test(file.name || "") || /hei[cf]/.test(file.type);
    if (!file.type.startsWith("image/") && !heic) { rtoast(trad("Ce fichier n’est pas une image.")); return; }
    const url = URL.createObjectURL(file);
    try {
      const i = await loadImg(url);
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      srcUrl = url; setSource(i, i.naturalWidth, i.naturalHeight, file.name || "image");
    } catch (e) {
      URL.revokeObjectURL(url);
      rtoast(heic ? trad("Ce navigateur ne sait pas lire le HEIC. Ouvre LibreMedias dans Safari, ou règle l’iPhone sur « Le plus compatible » (Réglages › Appareil photo › Formats).") : trad("Ce fichier n’a pas pu être lu comme une image."));
    }
  }
  function setSource(i, w, h, n) {
    src = i; W = w; H = h; name = n; E = fresh(); sel = null; mode = "edit"; cache.key = "";
    hist = [snap()]; hpos = 0;
    syncPanel(); draw();
  }
  LM.hooks.retouche = openFile;
  $r("file").addEventListener("change", (e) => { openFile(e.target.files[0]); e.target.value = ""; });
  [$r("vide"), $r("stage")].forEach((dz) => {
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => openFile(e.dataTransfer.files[0]));
  });
  document.addEventListener("paste", (e) => {
    if (!visible()) return;
    const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (it) openFile(it.getAsFile());
  });
  // Exemple : paysage dessiné
  $r("demo").addEventListener("click", () => {
    const w = 1600, h = 1000, c = mk(w, h), g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#5b8fd6"); sky.addColorStop(0.55, "#f6c48f"); sky.addColorStop(1, "#e88d63");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff4cf"; g.beginPath(); g.arc(1120, 520, 90, 0, 7); g.fill();
    [["#6d5a8a", 640, 0.9], ["#4b3f6b", 720, 1.4], ["#2d2846", 820, 2.1]].forEach(([col, y, f]) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x / (180 / f)) * 50 + Math.cos(x / 97) * 22);
      g.lineTo(w, h); g.fill();
    });
    c.toBlob((b) => openFile(new File([b], trad("exemple") + ".png", { type: "image/png" })), "image/png");
  });
  syncPanel();
})();
