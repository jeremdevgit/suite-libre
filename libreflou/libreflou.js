/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
(function () {
  enableDownloads();
  const cv = $("cv"), ctx = cv.getContext("2d");
  const PREF = "libreflou-reglages-v1";
  const P = Object.assign({ tool: "rect", effect: "flou", strength: 60, color: "#111111", brush: 48, outlines: true, fmt: "image/png" }, loadPref(PREF, {}));
  const EFFETS = { flou: trad("Flou"), pixels: trad("Pixels"), masque: trad("Masque") };
  const FORMES = { rect: trad("Rectangle"), ellipse: trad("Ellipse"), brush: trad("Pinceau") };
  const AIDE = {
    rect: trad("Fais glisser sur l’image pour couvrir la zone. Touche une zone existante pour la sélectionner."),
    ellipse: trad("Fais glisser sur l’image : pratique pour un visage. Touche une zone existante pour la sélectionner."),
    brush: trad("Passe le pinceau sur ce qu’il faut cacher, comme une ligne de texte."),
    select: trad("Touche une zone pour la sélectionner, fais-la glisser pour la déplacer, tire ses coins pour la redimensionner."),
  };
  const savePrefs = () => savePref(PREF, P);

  let src = null, W = 0, H = 0, name = "image", srcUrl = null;
  let zones = [], sel = null, uid = 0, hist = [], hpos = -1, drag = null, hover = null;

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const current = () => zones.find((z) => z.id === sel) || null;

  // Le flou natif du canvas n’existe pas partout (anciens Safari) : on vérifie qu’il agit vraiment
  const canFilter = (() => {
    try {
      const c = mk(9, 9), g = c.getContext("2d");
      g.filter = "blur(2px)"; g.fillStyle = "#fff"; g.fillRect(4, 4, 1, 1);
      return g.getImageData(2, 4, 1, 1).data[3] > 0;
    } catch (e) { return false; }
  })();

  // ---------- Effets ----------
  const layers = new Map();
  function layer(z, w, h) {
    const key = [z.effect, z.strength, z.effect === "masque" ? z.color : "", w, h].join("|");
    if (layers.has(key)) return layers.get(key);
    if (layers.size > 16) layers.clear();
    const big = Math.max(w, h), k = z.strength / 100;
    let c = mk(w, h);
    const g = c.getContext("2d");
    if (z.effect === "masque") {
      g.fillStyle = z.color; g.fillRect(0, 0, w, h);
    } else if (z.effect === "pixels") {
      const b = Math.max(3, Math.round(big * (0.006 + 0.05 * k)));
      const s = mk(Math.max(1, Math.ceil(w / b)), Math.max(1, Math.ceil(h / b))), sg = s.getContext("2d");
      sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
      sg.drawImage(src, 0, 0, s.width, s.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(s, 0, 0, s.width * b, s.height * b);
    } else {
      // Réduction puis agrandissement : les détails fins disparaissent vraiment, puis lissage
      const rad = Math.max(2, big * (0.004 + 0.03 * k)), f = Math.max(2, rad / 2);
      const s = mk(Math.max(1, Math.round(w / f)), Math.max(1, Math.round(h / f))), sg = s.getContext("2d");
      sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
      sg.drawImage(src, 0, 0, s.width, s.height);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      if (canFilter) {
        g.drawImage(s, 0, 0, w, h);
        const t = mk(w, h), tg = t.getContext("2d");
        tg.drawImage(c, 0, 0);
        tg.filter = `blur(${Math.max(1, rad / 2)}px)`;
        tg.drawImage(c, 0, 0);
        c = t;
      } else {
        const s2 = mk(Math.max(1, Math.round(s.width / 2)), Math.max(1, Math.round(s.height / 2))), s2g = s2.getContext("2d");
        s2g.imageSmoothingQuality = "high"; s2g.drawImage(s, 0, 0, s2.width, s2.height);
        sg.clearRect(0, 0, s.width, s.height); sg.drawImage(s2, 0, 0, s.width, s.height);
        g.drawImage(s, 0, 0, w, h);
      }
    }
    layers.set(key, c);
    return c;
  }

  // ---------- Formes ----------
  function shapePath(g, z, s) {
    g.beginPath();
    if (z.shape === "rect") g.rect(z.x * s, z.y * s, z.w * s, z.h * s);
    else g.ellipse((z.x + z.w / 2) * s, (z.y + z.h / 2) * s, Math.max(0.5, (z.w * s) / 2), Math.max(0.5, (z.h * s) / 2), 0, 0, Math.PI * 2);
  }
  function strokePath(g, z, s) {
    g.beginPath();
    z.pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
    if (z.pts.length === 1) g.lineTo(z.pts[0][0] * s + 0.01, z.pts[0][1] * s);
  }
  function bbox(z) {
    if (z.shape !== "brush") return [z.x, z.y, z.w, z.h];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of z.pts) { x0 = Math.min(x0, x - z.r); y0 = Math.min(y0, y - z.r); x1 = Math.max(x1, x + z.r); y1 = Math.max(y1, y + z.r); }
    return [x0, y0, x1 - x0, y1 - y0];
  }
  const corners = (z) => [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]];

  // ---------- Rendu ----------
  let tmp = null;
  function paint(g, w, h, overlay) {
    const s = w / W;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, w, h);
    if (!tmp || tmp.width !== w || tmp.height !== h) tmp = mk(w, h);
    const t = tmp.getContext("2d");
    for (const z of zones) {
      t.globalCompositeOperation = "source-over";
      t.clearRect(0, 0, w, h);
      t.fillStyle = t.strokeStyle = "#000";
      if (z.shape === "brush") { t.lineCap = t.lineJoin = "round"; t.lineWidth = z.r * 2 * s; strokePath(t, z, s); t.stroke(); }
      else { shapePath(t, z, s); t.fill(); }
      t.globalCompositeOperation = "source-in";
      t.drawImage(layer(z, w, h), 0, 0);
      g.drawImage(tmp, 0, 0);
    }
    t.globalCompositeOperation = "source-over";
    if (overlay) drawOverlay(g, s);
  }
  function cssScale() { const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; }
  function drawOverlay(g, s) {
    const lw = cssScale();
    for (const z of zones) {
      const on = z.id === sel;
      if (!P.outlines && !on) continue;
      const path = () => { if (z.shape === "brush") { const [x, y, w, h] = bbox(z); g.beginPath(); g.rect(x * s, y * s, w * s, h * s); } else shapePath(g, z, s); };
      g.save();
      g.lineWidth = (on ? 2 : 1.25) * lw;
      g.setLineDash([6 * lw, 4 * lw]);
      g.strokeStyle = "rgba(0,0,0,.8)"; path(); g.stroke();
      g.lineDashOffset = 5 * lw; g.strokeStyle = "#fff"; path(); g.stroke();
      g.restore();
      if (on && z.shape !== "brush") {
        const hs = 9 * lw;
        corners(z).forEach(([x, y]) => {
          g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,.8)"; g.lineWidth = 1.5 * lw;
          g.beginPath(); g.rect(x * s - hs / 2, y * s - hs / 2, hs, hs); g.fill(); g.stroke();
        });
      }
    }
    if (P.tool === "brush" && hover && !(drag && drag.mode !== "new")) {
      const r = (P.brush / 2) * lw;
      g.save(); g.lineWidth = 1.5 * lw;
      g.strokeStyle = "rgba(0,0,0,.8)"; g.beginPath(); g.arc(hover[0] * s, hover[1] * s, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#fff"; g.beginPath(); g.arc(hover[0] * s, hover[1] * s, Math.max(1, r - 1.5 * lw), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }
  let raf = 0;
  function draw() { if (!src || raf) return; raf = requestAnimationFrame(() => { raf = 0; paint(ctx, cv.width, cv.height, true); }); }

  // ---------- Historique ----------
  const snap = () => JSON.stringify(zones);
  function commit() {
    if (drag) return; // un tracé en cours sera enregistré à sa fin
    const s = snap(); if (s === hist[hpos]) return;
    hist = hist.slice(0, hpos + 1); hist.push(s);
    if (hist.length > 100) hist.shift();
    hpos = hist.length - 1; syncPanel();
  }
  let commitTimer = 0;
  const commitSoon = () => { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 400); };
  function restore(i) {
    hpos = i; zones = JSON.parse(hist[i]);
    if (!current()) sel = null;
    draw(); syncPanel();
  }
  const undo = () => { clearTimeout(commitTimer); commit(); if (hpos > 0) restore(hpos - 1); };
  const redo = () => { if (hpos < hist.length - 1) restore(hpos + 1); };
  function remove(id) { zones = zones.filter((z) => z.id !== id); if (sel === id) sel = null; commit(); draw(); syncPanel(); }

  // ---------- Pointeur ----------
  function pt(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  const clampP = ([x, y]) => [Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y))];
  const hpx = () => (14 * W) / Math.max(1, cv.getBoundingClientRect().width);
  function distSeg(x, y, [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }
  function hit(z, [x, y]) {
    if (z.shape === "rect") return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
    if (z.shape === "ellipse") {
      const rx = z.w / 2 || 1, ry = z.h / 2 || 1, dx = (x - z.x - rx) / rx, dy = (y - z.y - ry) / ry;
      return dx * dx + dy * dy <= 1;
    }
    const m = Math.max(z.r, hpx() / 2);
    for (let i = 0; i < z.pts.length; i++) if (distSeg(x, y, z.pts[i], z.pts[i + 1] || z.pts[i]) <= m) return true;
    return false;
  }
  function handleAt(z, p) {
    if (!z || z.shape === "brush") return -1;
    const h = hpx();
    return corners(z).findIndex(([cx, cy]) => Math.abs(p[0] - cx) <= h && Math.abs(p[1] - cy) <= h);
  }
  const topAt = (p) => [...zones].reverse().find((z) => hit(z, p)) || null;

  cv.addEventListener("pointerdown", (e) => {
    if (!src || e.button > 0) return;
    e.preventDefault();
    const p = pt(e), cur = current();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const h = handleAt(cur, p);
    if (h >= 0) { drag = { mode: "resize", z: cur, h, start: { ...cur } }; return; }
    const top = topAt(p);
    if (P.tool === "select" || (P.tool !== "brush" && cur && top === cur)) {
      sel = top ? top.id : null;
      if (top) drag = { mode: "move", z: top, p0: p, start: JSON.parse(JSON.stringify(top)) };
      syncPanel(); draw(); return;
    }
    leaveExample();
    const z = { id: ++uid, shape: P.tool, effect: P.effect, strength: P.strength, color: P.color };
    if (P.tool === "brush") { z.pts = [clampP(p)]; z.r = (P.brush / 2) * (W / Math.max(1, cv.getBoundingClientRect().width)); }
    else { const q = clampP(p); Object.assign(z, { x: q[0], y: q[1], w: 0, h: 0, ax: q[0], ay: q[1] }); }
    zones.push(z); sel = z.id;
    drag = { mode: "new", z, top };
    draw();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!src) return;
    const p = pt(e); hover = p;
    if (!drag) { setCursor(p); if (P.tool === "brush") draw(); return; }
    const z = drag.z;
    if (drag.mode === "new") {
      if (z.shape === "brush") {
        const l = z.pts[z.pts.length - 1], q = clampP(p);
        if (Math.hypot(q[0] - l[0], q[1] - l[1]) > z.r / 4) z.pts.push(q);
      } else {
        const q = clampP(p);
        let w = q[0] - z.ax, h = q[1] - z.ay;
        if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
        z.x = Math.min(z.ax, z.ax + w); z.y = Math.min(z.ay, z.ay + h); z.w = Math.abs(w); z.h = Math.abs(h);
      }
    } else if (drag.mode === "move") {
      const dx = p[0] - drag.p0[0], dy = p[1] - drag.p0[1];
      if (z.shape === "brush") z.pts = drag.start.pts.map(([x, y]) => [x + dx, y + dy]);
      else { z.x = drag.start.x + dx; z.y = drag.start.y + dy; }
    } else if (drag.mode === "resize") {
      const opp = corners(drag.start)[(drag.h + 2) % 4], q = clampP(p);
      z.x = Math.min(opp[0], q[0]); z.y = Math.min(opp[1], q[1]); z.w = Math.abs(q[0] - opp[0]); z.h = Math.abs(q[1] - opp[1]);
    }
    draw();
  });
  function endDrag() {
    if (!drag) return;
    clearTimeout(commitTimer);
    const z = drag.z, mode = drag.mode, top = drag.top;
    drag = null;
    if (mode === "new" && z.shape !== "brush" && (z.w < hpx() / 2 || z.h < hpx() / 2)) {
      // Simple touche : sélectionne la zone touchée, ou désélectionne
      zones = zones.filter((x) => x !== z);
      sel = top ? top.id : null;
    } else {
      delete z.ax; delete z.ay;
      if (z.shape !== "brush" && (z.w < 1 || z.h < 1)) zones = zones.filter((x) => x !== z);
      commit();
    }
    draw(); syncPanel();
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("pointerleave", () => { hover = null; if (!drag) draw(); });
  function setCursor(p) {
    const cur = current(), h = handleAt(cur, p);
    if (h >= 0) cv.style.cursor = h % 2 ? "nesw-resize" : "nwse-resize";
    else if (P.tool === "brush") cv.style.cursor = "none";
    else { const top = topAt(p); cv.style.cursor = top && (P.tool === "select" || top === cur) ? "move" : P.tool === "select" ? "default" : "crosshair"; }
  }

  // ---------- Panneau ----------
  function syncPanel() {
    document.querySelectorAll("#tools .tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === P.tool)));
    $("brush-row").hidden = P.tool !== "brush";
    $("brush").value = P.brush; $("brush-o").textContent = P.brush + " px";
    $("tool-hint").textContent = AIDE[P.tool];
    const z = current(), e = z || P;
    $("effect-title").textContent = z ? trad("Effet de la zone sélectionnée") : trad("Effet");
    document.querySelectorAll("#effects .tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.effect === e.effect)));
    $("strength").value = e.strength; $("strength-o").textContent = e.strength + " %";
    $("strength-row").hidden = e.effect === "masque";
    $("color-row").hidden = e.effect !== "masque";
    $("color").value = e.color;
    $("outlines").checked = P.outlines;
    $("fmt").value = P.fmt;
    $("undo").disabled = hpos <= 0; $("redo").disabled = hpos >= hist.length - 1;
    $("clear-all").hidden = !zones.length;
    const n = {};
    $("zones").innerHTML = zones.length ? zones.map((z) => {
      n[z.shape] = (n[z.shape] || 0) + 1;
      const fx = EFFETS[z.effect] + (z.effect === "masque" ? "" : " " + z.strength + " %");
      return `<div class="zitem" data-id="${z.id}" aria-current="${z.id === sel}"><button class="zname">${FORMES[z.shape]} ${n[z.shape]} <small>· ${esc(fx)}</small></button>
        <button class="iconbtn" data-del aria-label="${trad("Supprimer cette zone")}" title="${trad("Supprimer")}">×</button></div>`;
    }).join("") : '<div class="empty">' + trad("Aucune zone. Dessine sur l’image ce qu’il faut cacher.") + "</div>";
    const ok = !!src;
    ["dl", "copy"].forEach((id) => ($(id).disabled = !ok));
  }
  function setEffect(patch) {
    Object.assign(P, patch); savePrefs();
    const z = current();
    if (z) { Object.assign(z, patch); commitSoon(); }
    draw(); syncPanel();
  }
  $("tools").addEventListener("click", (e) => { const b = e.target.closest("[data-tool]"); if (!b) return; P.tool = b.dataset.tool; savePrefs(); syncPanel(); draw(); });
  $("effects").addEventListener("click", (e) => { const b = e.target.closest("[data-effect]"); if (b) setEffect({ effect: b.dataset.effect }); });
  $("strength").addEventListener("input", () => setEffect({ strength: +$("strength").value }));
  $("color").addEventListener("input", () => setEffect({ color: $("color").value }));
  $("brush").addEventListener("input", () => { P.brush = +$("brush").value; savePrefs(); syncPanel(); });
  $("outlines").addEventListener("input", () => { P.outlines = $("outlines").checked; savePrefs(); draw(); });
  $("fmt").addEventListener("input", () => { P.fmt = $("fmt").value; savePrefs(); });
  $("zones").addEventListener("click", (e) => {
    const it = e.target.closest(".zitem"); if (!it) return;
    const id = +it.dataset.id;
    if (e.target.closest("[data-del]")) { remove(id); return; }
    sel = sel === id ? null : id; draw(); syncPanel();
  });
  $("clear-all").addEventListener("click", () => { zones = []; sel = null; commit(); draw(); syncPanel(); toast(trad("Toutes les zones ont été retirées.")); });
  $("undo").addEventListener("click", undo);
  $("redo").addEventListener("click", redo);
  document.addEventListener("keydown", (e) => {
    if (!src || e.target.closest("input, textarea, select")) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); remove(sel); }
    else if (e.key === "Escape" && sel) { sel = null; draw(); syncPanel(); }
  });
  window.addEventListener("resize", draw);

  // ---------- Chargement ----------
  function setImage(s, w, h, n, ex) {
    src = s; W = w; H = h; name = n; layers.clear();
    const k = Math.min(1, 1600 / Math.max(w, h));
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    zones = []; sel = null; drag = null;
    $("vide").hidden = true; $("scene").hidden = false; $("example").hidden = !ex; $("err").hidden = true;
    $("facts").textContent = `${w} × ${h} px`;
  }
  function resetHistory() { hist = [snap()]; hpos = 0; draw(); syncPanel(); }
  function leaveExample() { $("example").hidden = true; }
  const loadImg = (url) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
  async function openFile(file) {
    if (!file) return;
    const heic = /\.(heic|heif)$/i.test(file.name || "") || /hei[cf]/.test(file.type);
    if (!file.type.startsWith("image/") && !heic) { toast(trad("Ce fichier n’est pas une image.")); return; }
    const url = URL.createObjectURL(file);
    try {
      const i = await loadImg(url);
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      srcUrl = url;
      setImage(i, i.naturalWidth, i.naturalHeight, file.name || "image", false);
      resetHistory();
    } catch (e) {
      URL.revokeObjectURL(url);
      const msg = heic ? trad("Ce navigateur ne sait pas lire le HEIC. Ouvre LibreFlou dans Safari, ou règle l’iPhone sur « Le plus compatible » (Réglages › Appareil photo › Formats).") : trad("Ce fichier n’a pas pu être lu comme une image.");
      if (src) { $("err").textContent = msg; $("err").hidden = false; } else toast(msg);
    }
  }
  $("file").addEventListener("change", (e) => { openFile(e.target.files[0]); e.target.value = ""; });
  [$("vide"), $("stage")].forEach((dz) => {
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => openFile(e.dataTransfer.files[0]));
  });
  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) openFile(item.getAsFile());
  });

  // ---------- Enregistrement ----------
  const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  function render() { const c = mk(W, H); paint(c.getContext("2d"), W, H, false); return c; }
  const toBlob = (c, type) => new Promise((ok) => c.toBlob(ok, type, 0.92));
  $("dl").addEventListener("click", async () => {
    if (!src) return;
    if (!canSave()) { toast(trad("Le téléchargement n’est pas disponible ici : utilise Copier l’image.")); return; }
    const blob = await toBlob(render(), P.fmt);
    if (!blob) { toast(trad("L’image n’a pas pu être créée.")); return; }
    const fname = name.replace(/\.[^.]+$/, "") + "-" + trad("floute") + "." + (EXT[blob.type] || "png");
    try { const s = await saveFile(fname, blob); if (s === "saved") toast(trad("Image enregistrée.")); } catch (err) { toast(saveErrorText(err)); }
  });
  $("copy").addEventListener("click", async () => {
    if (!src) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob(render(), "image/png") })]);
      toast(trad("Image copiée dans le presse-papiers."));
    } catch (e) { toast(trad("La copie d’image est bloquée par ce navigateur : utilise Télécharger.")); }
  });
  onSaveReady(syncPanel);

  // ---------- Exemple de départ ----------
  (function exemple() {
    const w = 1600, h = 1000, c = mk(w, h), g = c.getContext("2d");
    const F = (wt, px) => `${wt} ${px}px -apple-system, "Segoe UI", system-ui, sans-serif`;
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#a9c1d9"); sky.addColorStop(0.6, "#e9dfcf"); sky.addColorStop(1, "#b9b3a6");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8d877b"; g.fillRect(0, 760, w, 240);
    // Voiture et plaque
    g.fillStyle = "#3d5a80"; g.beginPath(); g.roundRect(90, 560, 620, 220, 60); g.fill();
    g.beginPath(); g.roundRect(200, 450, 380, 160, 70); g.fill();
    g.fillStyle = "#cfe0ee"; g.beginPath(); g.roundRect(240, 480, 300, 100, 40); g.fill();
    g.fillStyle = "#1f2933"; [210, 590].forEach((x) => { g.beginPath(); g.arc(x, 780, 62, 0, 7); g.fill(); });
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(270, 650, 260, 64, 8); g.fill();
    g.fillStyle = "#1d4ed8"; g.fillRect(270, 650, 30, 64); g.fillRect(500, 650, 30, 64);
    g.fillStyle = "#111"; g.font = F(700, 40); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("AB-123-CD", 400, 684);
    // Personnage
    g.fillStyle = "#5e5ce6"; g.beginPath(); g.roundRect(830, 520, 220, 300, 90); g.fill();
    g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(940, 420, 105, 0, 7); g.fill();
    g.fillStyle = "#4a3426"; g.beginPath(); g.arc(940, 395, 108, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.fillStyle = "#2b2b2b"; [905, 975].forEach((x) => { g.beginPath(); g.arc(x, 425, 11, 0, 7); g.fill(); });
    g.strokeStyle = "#a0522d"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(940, 455, 34, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    // Carte de membre
    g.save(); g.translate(1130, 300); g.rotate(-0.06);
    g.fillStyle = "#fffdf8"; g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = 30; g.beginPath(); g.roundRect(0, 0, 400, 250, 22); g.fill(); g.shadowBlur = 0;
    g.fillStyle = "#0a84ff"; g.beginPath(); g.roundRect(0, 0, 400, 56, [22, 22, 0, 0]); g.fill();
    g.fillStyle = "#fff"; g.font = F(700, 24); g.textAlign = "left"; g.fillText(trad("CARTE DE MEMBRE"), 24, 29);
    g.fillStyle = "#222"; g.font = F(600, 26); g.fillText("Camille Durand", 24, 104);
    g.font = F(400, 22); g.fillStyle = "#555"; g.fillText(trad("12 rue des Exemples"), 24, 146); g.fillText("N° 0123 4567 8910", 24, 188);
    g.restore();
    c.toBlob((b) => {
      if (src || !b) return;
      loadImg(URL.createObjectURL(b)).then((img) => {
        if (src) return;
        setImage(img, w, h, trad("exemple") + ".png", true);
        zones = [
          { id: ++uid, shape: "ellipse", effect: "flou", strength: 70, color: P.color, x: 820, y: 300, w: 240, h: 240 },
          { id: ++uid, shape: "rect", effect: "pixels", strength: 45, color: P.color, x: 262, y: 642, w: 276, h: 80 },
          { id: ++uid, shape: "brush", effect: "masque", strength: 60, color: "#111111", r: 22, pts: [[1158, 402], [1260, 396], [1362, 390]] },
          { id: ++uid, shape: "brush", effect: "masque", strength: 60, color: "#111111", r: 20, pts: [[1162, 486], [1262, 480], [1364, 474]] },
        ];
        resetHistory();
      });
    }, "image/png");
  })();
  syncPanel();
})();
