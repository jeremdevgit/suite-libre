/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
(function () {
  enableDownloads();
  const items = []; // {id, name, file, size, w, h, meta, img, out:{blob,url,w,h}, example}
  let uid = 0;
  const fmtSize = (b) => (b < 1024 ? trad("{n} o", { n: b }) : b < 1048576 ? trad("{n} Ko", { n: nf(b / 1024, 0) }) : trad("{n} Mo", { n: nf(b / 1048576, 1) }));
  const EXT = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png", "image/gif": "gif" };

  // ---------- Lecture EXIF (JPEG) ----------
  async function readMeta(file) {
    const out = {};
    try {
      const buf = await file.slice(0, 256 * 1024).arrayBuffer();
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return out;
      let p = 2;
      while (p + 4 < v.byteLength) {
        const marker = v.getUint16(p), len = v.getUint16(p + 2);
        if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) { parseExif(v, p + 10, out); break; }
        if ((marker & 0xff00) !== 0xff00) break;
        p += 2 + len;
      }
    } catch (e) {}
    return out;
  }
  function parseExif(v, t, out) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = (o) => v.getUint16(t + o, le), u32 = (o) => v.getUint32(t + o, le);
    const str = (o, n) => { let s = ""; for (let i = 0; i < n; i++) { const c = v.getUint8(t + o + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
    const rat = (o) => u32(o) / (u32(o + 4) || 1);
    function ifd(off, fn) {
      if (!off || t + off + 2 > v.byteLength) return;
      const n = u16(off);
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (t + e + 12 > v.byteLength) return;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }[type] || 1) * count;
        const valOff = size > 4 ? u32(e + 8) : e + 8;
        fn(tag, type, count, valOff);
      }
    }
    ifd(u32(4), (tag, type, count, o) => {
      if (tag === 0x010f) out.make = str(o, count);
      else if (tag === 0x0110) out.model = str(o, count);
      else if (tag === 0x0132) out.date = str(o, count);
      else if (tag === 0x8769) ifd(u32(o), (t2, ty2, c2, o2) => { if (t2 === 0x9003) out.date = str(o2, c2); });
      else if (tag === 0x8825) {
        const g = {};
        ifd(u32(o), (t2, ty2, c2, o2) => {
          if (t2 === 1) g.latRef = str(o2, 2); else if (t2 === 3) g.lngRef = str(o2, 2);
          else if ((t2 === 2 || t2 === 4) && ty2 === 5) g[t2 === 2 ? "lat" : "lng"] = rat(o2) + rat(o2 + 8) / 60 + rat(o2 + 16) / 3600;
        });
        if (g.lat != null && g.lng != null && (g.lat || g.lng)) out.gps = [(g.latRef === "S" ? -1 : 1) * g.lat, (g.lngRef === "W" ? -1 : 1) * g.lng];
      }
    });
  }

  // ---------- Ajout ----------
  function loadImg(src) {
    return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  }
  async function addFile(file, example) {
    const it = { id: ++uid, name: file.name || "image", file, size: file.size, example };
    items.push(it); render();
    try {
      it.meta = await readMeta(file);
      it.src = URL.createObjectURL(file);
      it.img = await loadImg(it.src);
      it.w = it.img.naturalWidth; it.h = it.img.naturalHeight;
      await process(it);
    } catch (e) {
      it.error = /\.(heic|heif)$/i.test(it.name) || /hei[cf]/.test(file.type)
        ? trad("Ce navigateur ne sait pas lire le HEIC. Ouvre LibreImage dans Safari, ou règle l’iPhone sur « Le plus compatible » (Réglages › Appareil photo › Formats).")
        : trad("Ce fichier n’a pas pu être lu comme une image.");
    }
    render();
  }
  function addFiles(list) {
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) { toast(trad("Aucune image dans ce que tu as déposé.")); return; }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].example) drop(items[i].id);
    files.forEach((f) => addFile(f, false));
  }
  $("file").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  const dz = $("drop");
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  document.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile());
    if (files.length) addFiles(files);
  });
  function drop(id) {
    const i = items.findIndex((x) => x.id === id); if (i < 0) return;
    const it = items[i];
    [it.src, it.out?.url].forEach((u) => u && URL.revokeObjectURL(u));
    items.splice(i, 1);
  }

  // ---------- Traitement ----------
  function target(w, h) {
    const m = $("rmode").value, v = Math.max(1, +$("rval").value || 1);
    let k = 1;
    if (m === "long") k = v / Math.max(w, h);
    else if (m === "w") k = v / w;
    else if (m === "h") k = v / h;
    else if (m === "pct") k = v / 100;
    k = Math.min(1, k);
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }
  function outType(it) {
    const f = $("fmt").value;
    if (f !== "same") return f;
    return ["image/jpeg", "image/png", "image/webp"].includes(it.file.type) ? it.file.type : "image/png";
  }
  async function process(it) {
    if (!it.img) return;
    const [w, h] = target(it.w, it.h), type = outType(it);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (type === "image/jpeg") { ctx.fillStyle = $("bg").value; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(it.img, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, type, +$("q").value / 100));
    if (!blob) throw new Error("encode");
    if (it.out?.url) URL.revokeObjectURL(it.out.url);
    const realType = blob.type || type;
    it.out = { blob, url: URL.createObjectURL(blob), w, h, type: realType };
  }
  let timer = 0;
  function reprocessAll() {
    clearTimeout(timer);
    timer = setTimeout(async () => { for (const it of items) { try { await process(it); } catch (e) {} } render(); }, 150);
  }

  // ---------- Affichage ----------
  function outName(it) {
    const base = it.name.replace(/\.[^.]+$/, "");
    return base + "-libreimage." + (EXT[it.out.type] || "png");
  }
  function render() {
    const box = $("results");
    if (!items.length) { box.innerHTML = '<div class="empty">' + trad("Aucune image pour l’instant.") + "</div>"; $("bulk").hidden = true; $("sum").innerHTML = ""; return; }
    box.innerHTML = items.map((it) => {
      if (it.error) return `<div class="res"><div class="pic"></div><div class="body"><div class="name">${esc(it.name)}</div><div class="note bad">${esc(it.error)}</div><div class="acts"><button class="btn small" data-rm="${it.id}">${trad("Retirer")}</button></div></div></div>`;
      if (!it.out) return `<div class="res"><div class="pic"></div><div class="body"><div class="name">${esc(it.name)}</div><span class="hint">${trad("Traitement…")}</span></div></div>`;
      const gain = 1 - it.out.blob.size / it.size;
      const tags = [];
      if (it.example) tags.push('<span class="chip ex">' + trad("Exemple") + "</span>");
      tags.push(gain > 0 ? `<span class="chip good">−${Math.round(gain * 100)} %</span>` : `<span class="chip warn">${trad("+{n} % (choisis un autre format)", { n: Math.round(-gain * 100) })}</span>`);
      const m = it.meta || {};
      if (m.gps) tags.push(`<span class="chip bad" title="${m.gps.map((x) => x.toFixed(5)).join(", ")}">${trad("Position GPS retirée")}</span>`);
      if (m.make || m.model) tags.push(`<span class="chip warn">${esc(trad("Appareil retiré : {nom}", { nom: [m.make, m.model].filter(Boolean).join(" ") }))}</span>`);
      if (m.date) tags.push(`<span class="chip warn">${trad("Date retirée")}</span>`);
      const save = canSave() ? `<button class="btn small primary" data-dl="${it.id}">${trad("Télécharger")}</button>` : `<span class="hint">${trad("Clic droit sur l’aperçu › Enregistrer l’image")}</span>`;
      return `<div class="res"><div class="pic"><img src="${it.out.url}" alt="${esc(trad("Aperçu de {nom}", { nom: it.name }))}"></div><div class="body">
        <div class="name">${esc(it.name)}</div>
        <div class="facts"><span>${it.w}×${it.h} → ${it.out.w}×${it.out.h}</span><span>${fmtSize(it.size)} → ${fmtSize(it.out.blob.size)}</span><span>${(EXT[it.out.type] || "").toUpperCase()}</span></div>
        <div class="tags">${tags.join("")}</div>
        <div class="acts">${save}<button class="btn small" data-rm="${it.id}">${trad("Retirer")}</button></div></div></div>`;
    }).join("");
    const done = items.filter((i) => i.out);
    $("bulk").hidden = !done.length;
    $("zip").hidden = !canSave() || done.length < 2;
    const before = done.reduce((a, i) => a + i.size, 0), after = done.reduce((a, i) => a + i.out.blob.size, 0);
    const gps = done.filter((i) => i.meta?.gps).length;
    $("sum").innerHTML = done.length ? `<dl class="kv"><dt>${trad("Images")}</dt><dd>${done.length}</dd><dt>${trad("Poids total")}</dt><dd>${fmtSize(before)} → ${fmtSize(after)}</dd><dt>${trad("Positions GPS retirées")}</dt><dd>${gps}</dd></dl>` : "";
  }
  $("results").addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-rm]"), dl = e.target.closest("[data-dl]");
    if (rm) { drop(+rm.dataset.rm); render(); }
    if (dl) {
      const it = items.find((x) => x.id === +dl.dataset.dl);
      try { const s = await saveFile(outName(it), it.out.blob); if (s === "saved") toast(trad("Image enregistrée.")); } catch (err) { toast(saveErrorText(err)); }
    }
  });
  $("clear").addEventListener("click", () => { while (items.length) drop(items[0].id); render(); });

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
  $("zip").addEventListener("click", async () => {
    const done = items.filter((i) => i.out), used = new Set();
    const files = done.map((it) => { let n = outName(it), k = 2; while (used.has(n)) n = n.replace(/(-\d+)?(\.\w+)$/, "-" + k++ + "$2"); used.add(n); return { name: n, blob: it.out.blob }; });
    try { const s = await saveFile("libreimage.zip", await makeZip(files)); if (s === "saved") toast(trad("Archive enregistrée.")); } catch (err) { toast(saveErrorText(err)); }
  });

  // ---------- Réglages ----------
  const PREF = "libreimage-reglages-v1";
  const ids = ["fmt", "q", "bg", "rmode", "rval"];
  const saved = loadPref(PREF, null);
  if (saved) ids.forEach((id) => { if (saved[id] != null) $(id).value = saved[id]; });
  function syncUI() {
    $("q-o").textContent = $("q").value + " %";
    const png = $("fmt").value === "image/png";
    $("q").disabled = png;
    $("bg-row").hidden = $("fmt").value !== "image/jpeg";
    const m = $("rmode").value;
    $("rval-wrap").hidden = $("presets").hidden = m === "none";
    if (m === "pct") $("presets").hidden = true;
    $("rval-label").textContent = trad(m === "pct" ? "Pourcentage (%)" : m === "w" ? "Largeur maximale (px)" : m === "h" ? "Hauteur maximale (px)" : "Taille maximale (px)");
    savePref(PREF, Object.fromEntries(ids.map((id) => [id, $(id).value])));
  }
  ids.forEach((id) => $(id).addEventListener("input", () => { syncUI(); reprocessAll(); }));
  $("rmode").addEventListener("change", () => { if ($("rmode").value === "pct" && +$("rval").value > 100) $("rval").value = 50; else if ($("rmode").value !== "pct" && +$("rval").value <= 100) $("rval").value = 2048; syncUI(); reprocessAll(); });
  $("presets").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (!b) return; $("rval").value = b.dataset.p; syncUI(); reprocessAll(); });
  onSaveReady(render);
  syncUI();

  // ---------- Exemple de départ ----------
  (function sample() {
    const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
    const g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 2000); sky.addColorStop(0, "#9fb4c9"); sky.addColorStop(0.55, "#e7d9c4"); sky.addColorStop(1, "#5d6b5a");
    g.fillStyle = sky; g.fillRect(0, 0, 3000, 2000);
    g.fillStyle = "rgba(255,244,220,.9)"; g.beginPath(); g.arc(2150, 620, 150, 0, 7); g.fill();
    [["#6e7f8f", 1250, 0.0], ["#4f5f58", 1450, 1.3], ["#344238", 1650, 2.1]].forEach(([col, y, ph]) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 2000);
      for (let x = 0; x <= 3000; x += 20) g.lineTo(x, y - 180 * Math.sin(x / 520 + ph) - 90 * Math.sin(x / 190 + ph * 2));
      g.lineTo(3000, 2000); g.fill();
    });
    c.toBlob((b) => { if (b && !items.length) addFile(new File([b], trad("exemple-paysage") + ".png", { type: "image/png" }), true); }, "image/png");
  })();
  render();
})();
