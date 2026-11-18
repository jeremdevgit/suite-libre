/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreMedias : enregistrement dans de nombreux formats, sans dépendance.
// PNG, JPEG, WEBP et AVIF passent par le navigateur ; GIF (fixe ou animé), BMP, TIFF, ICO et PDF sont écrits ici.
(function (root) {
  "use strict";

  // ---------- Petits outils binaires ----------
  function Bytes(n) { this.b = new Uint8Array(n || 1024); this.n = 0; }
  Bytes.prototype.need = function (k) { if (this.n + k > this.b.length) { const c = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); c.set(this.b); this.b = c; } };
  Bytes.prototype.u8 = function (v) { this.need(1); this.b[this.n++] = v & 255; };
  Bytes.prototype.u16 = function (v) { this.u8(v); this.u8(v >> 8); };
  Bytes.prototype.u32 = function (v) { this.u16(v & 0xffff); this.u16((v >>> 16) & 0xffff); };
  Bytes.prototype.arr = function (a) { this.need(a.length); this.b.set(a, this.n); this.n += a.length; };
  Bytes.prototype.str = function (s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  Bytes.prototype.out = function () { return this.b.slice(0, this.n); };

  // =====================================================================
  // Palette (coupe médiane) pour le GIF
  // =====================================================================
  // Renvoie { palette: Uint8Array(3*n), map(r,g,b) -> index }. Index 0 réservé à la transparence si alpha.
  function quantize(rgbaList, maxColors, alpha) {
    const hist = new Uint32Array(32768);
    for (const d of rgbaList) for (let i = 0; i < d.length; i += 4) {
      if (alpha && d[i + 3] < 128) continue;
      hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
    }
    const bins = [];
    for (let k = 0; k < 32768; k++) if (hist[k]) bins.push(k);
    const want = Math.max(1, maxColors - (alpha ? 1 : 0));
    const comp = (k, c) => (c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31);
    let boxes = [bins];
    while (boxes.length < want) {
      // Coupe la boîte la plus peuplée qui a plus d'une couleur, selon son axe le plus long
      let bi = -1, best = 0;
      boxes.forEach((b, i) => { if (b.length > 1) { const p = b.reduce((s, k) => s + hist[k], 0); if (p > best) { best = p; bi = i; } } });
      if (bi < 0) break;
      const b = boxes[bi];
      let axis = 0, span = -1;
      for (let c = 0; c < 3; c++) { let lo = 31, hi = 0; for (const k of b) { const v = comp(k, c); if (v < lo) lo = v; if (v > hi) hi = v; } if (hi - lo > span) { span = hi - lo; axis = c; } }
      b.sort((x, y) => comp(x, axis) - comp(y, axis));
      const tot = b.reduce((s, k) => s + hist[k], 0);
      let acc = 0, cut = 1;
      for (let i = 0; i < b.length - 1; i++) { acc += hist[b[i]]; if (acc >= tot / 2) { cut = i + 1; break; } }
      boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    const off = alpha ? 1 : 0, n = boxes.length + off, pal = new Uint8Array(3 * Math.max(2, n));
    boxes.forEach((b, i) => {
      let r = 0, g = 0, bl = 0, t = 0;
      for (const k of b) { const w = hist[k]; r += ((k >> 10) * 8 + 4) * w; g += (((k >> 5) & 31) * 8 + 4) * w; bl += ((k & 31) * 8 + 4) * w; t += w; }
      pal[(i + off) * 3] = Math.round(r / t); pal[(i + off) * 3 + 1] = Math.round(g / t); pal[(i + off) * 3 + 2] = Math.round(bl / t);
    });
    const cache = new Int16Array(32768).fill(-1);
    function map(r, g, b) {
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      if (cache[k] >= 0) return cache[k];
      let bi = off, bd = Infinity;
      for (let i = off; i < n; i++) { const dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b, d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; bi = i; } }
      return (cache[k] = bi);
    }
    return { palette: pal, size: Math.max(2, n), map, transparent: alpha ? 0 : -1 };
  }
  // Indices de palette pour une image, avec tramage léger (Floyd-Steinberg) si demandé
  function indexImage(d, w, h, q, dither) {
    const idx = new Uint8Array(w * h), pal = q.palette;
    const err = dither ? new Float32Array((w + 2) * 3 * 2) : null;
    for (let y = 0; y < h; y++) {
      const cur = y & 1 ? (w + 2) * 3 : 0, nxt = y & 1 ? 0 : (w + 2) * 3;
      if (err) for (let i = 0; i < (w + 2) * 3; i++) err[nxt + i] = 0;
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (q.transparent >= 0 && d[p + 3] < 128) { idx[y * w + x] = q.transparent; continue; }
        let r = d[p], g = d[p + 1], b = d[p + 2];
        if (err) { const e = cur + (x + 1) * 3; r = Math.max(0, Math.min(255, r + err[e])); g = Math.max(0, Math.min(255, g + err[e + 1])); b = Math.max(0, Math.min(255, b + err[e + 2])); }
        const i = q.map(r | 0, g | 0, b | 0);
        idx[y * w + x] = i;
        if (err) {
          const er = r - pal[i * 3], eg = g - pal[i * 3 + 1], eb = b - pal[i * 3 + 2];
          const add = (base, k) => { err[base] += er * k; err[base + 1] += eg * k; err[base + 2] += eb * k; };
          add(cur + (x + 2) * 3, 7 / 16); add(nxt + x * 3, 3 / 16); add(nxt + (x + 1) * 3, 5 / 16); add(nxt + (x + 2) * 3, 1 / 16);
        }
      }
    }
    return idx;
  }

  // Compression LZW du GIF
  function lzw(idx, minBits, out) {
    const clear = 1 << minBits, eoi = clear + 1;
    let size = minBits + 1, next = eoi + 1, cur = 0, nbits = 0;
    const blk = [];
    const emit = (code) => {
      cur |= code << nbits; nbits += size;
      while (nbits >= 8) { blk.push(cur & 255); cur >>>= 8; nbits -= 8; if (blk.length === 255) { out.u8(255); out.arr(blk); blk.length = 0; } }
    };
    const dict = new Map();
    emit(clear);
    let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = prefix * 4096 + k, c = dict.get(key);
      if (c !== undefined) { prefix = c; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > 1 << size && size < 12) size++; }
      else { emit(clear); dict.clear(); size = minBits + 1; next = eoi + 1; }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (nbits > 0) { blk.push(cur & 255); if (blk.length === 255) { out.u8(255); out.arr(blk); blk.length = 0; } }
    if (blk.length) { out.u8(blk.length); out.arr(blk); }
    out.u8(0);
  }

  // frames : [{ rgba, delay (ms) }] de même taille ; loop : 0 = sans fin
  function encodeGIF(frames, w, h, opts) {
    opts = opts || {};
    const alpha = frames.some((f) => { for (let i = 3; i < f.rgba.length; i += 4) if (f.rgba[i] < 128) return true; return false; });
    const o = new Bytes(w * h * frames.length + 1024);
    o.str("GIF89a"); o.u16(w); o.u16(h); o.u8(0); o.u8(0); o.u8(0); // pas de palette globale
    if (frames.length > 1) { o.u8(0x21); o.u8(0xff); o.u8(11); o.str("NETSCAPE2.0"); o.u8(3); o.u8(1); o.u16(opts.loop || 0); o.u8(0); }
    for (const f of frames) {
      const q = quantize([f.rgba], 256, alpha), idx = indexImage(f.rgba, w, h, q, opts.dither !== false);
      let bits = 1; while (1 << bits < q.size) bits++;
      // Contrôle graphique : durée, transparence, effacement avant l'image suivante
      o.u8(0x21); o.u8(0xf9); o.u8(4); o.u8((alpha ? 2 << 2 : 1 << 2) | (alpha ? 1 : 0)); o.u16(Math.round((f.delay || 100) / 10)); o.u8(alpha ? q.transparent : 0); o.u8(0);
      o.u8(0x2c); o.u16(0); o.u16(0); o.u16(w); o.u16(h); o.u8(0x80 | (bits - 1));
      for (let i = 0; i < 1 << bits; i++) { o.u8(q.palette[i * 3] || 0); o.u8(q.palette[i * 3 + 1] || 0); o.u8(q.palette[i * 3 + 2] || 0); }
      const mb = Math.max(2, bits);
      o.u8(mb); lzw(idx, mb, o);
    }
    o.u8(0x3b);
    return o.out();
  }

  // =====================================================================
  // BMP (32 bits avec transparence), TIFF (sans compression), ICO (PNG), PDF (JPEG)
  // =====================================================================
  function encodeBMP(d, w, h) {
    const size = 14 + 108 + w * h * 4, o = new Bytes(size);
    o.str("BM"); o.u32(size); o.u32(0); o.u32(14 + 108);
    o.u32(108); o.u32(w); o.u32(-h); o.u16(1); o.u16(32); o.u32(3); o.u32(w * h * 4); o.u32(2835); o.u32(2835); o.u32(0); o.u32(0);
    o.u32(0x00ff0000); o.u32(0x0000ff00); o.u32(0x000000ff); o.u32(0xff000000); o.str("BGRs");
    for (let i = 0; i < 48; i++) o.u8(0);
    for (let i = 0; i < w * h * 4; i += 4) { o.u8(d[i + 2]); o.u8(d[i + 1]); o.u8(d[i]); o.u8(d[i + 3]); }
    return o.out();
  }
  function encodeTIFF(d, w, h) {
    const n = 11, ifd = 8, extra = ifd + 2 + n * 12 + 4, bps = extra, dataOff = bps + 8, o = new Bytes(dataOff + w * h * 4);
    o.str("II"); o.u16(42); o.u32(ifd);
    o.u16(n);
    const tag = (t, type, count, val) => { o.u16(t); o.u16(type); o.u32(count); o.u32(val); };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, 4, bps); tag(259, 3, 1, 1); tag(262, 3, 1, 2);
    tag(273, 4, 1, dataOff); tag(277, 3, 1, 4); tag(278, 4, 1, h); tag(279, 4, 1, w * h * 4); tag(284, 3, 1, 1); tag(338, 3, 1, 2);
    o.u32(0);
    o.u16(8); o.u16(8); o.u16(8); o.u16(8);
    o.arr(d);
    return o.out();
  }
  // pngs : [{ size, data: Uint8Array (PNG) }]
  function encodeICO(pngs) {
    const o = new Bytes();
    o.u16(0); o.u16(1); o.u16(pngs.length);
    let off = 6 + 16 * pngs.length;
    for (const p of pngs) { o.u8(p.size >= 256 ? 0 : p.size); o.u8(p.size >= 256 ? 0 : p.size); o.u8(0); o.u8(0); o.u16(1); o.u16(32); o.u32(p.data.length); o.u32(off); off += p.data.length; }
    for (const p of pngs) o.arr(p.data);
    return o.out();
  }
  // Une page par image JPEG, à la taille de l'image (96 ppp)
  function encodePDF(pages) {
    const o = new Bytes(), offs = [];
    const obj = (i, body) => { offs[i] = o.n; o.str(i + " 0 obj\n"); body(); o.str("\nendobj\n"); };
    o.str("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    const N = pages.length, kids = pages.map((_, i) => 3 + i * 3 + " 0 R").join(" ");
    obj(1, () => o.str("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => o.str(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, w = +(p.w * 0.75).toFixed(2), h = +(p.h * 0.75).toFixed(2), cs = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
      obj(pg, () => o.str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pg + 1} 0 R >> >> /Contents ${pg + 2} 0 R >>`));
      obj(pg + 1, () => { o.str(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); o.arr(p.jpeg); o.str("\nendstream"); });
      obj(pg + 2, () => o.str(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    });
    const xref = o.n, count = 3 + N * 3;
    o.str(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let i = 1; i < count; i++) o.str(String(offs[i]).padStart(10, "0") + " 00000 n \n");
    o.str(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return o.out();
  }

  // =====================================================================
  // Côté navigateur : liste des formats et enregistrement d'un canvas
  // =====================================================================
  const LIST = [
    { id: "png", mime: "image/png", ext: "png", alpha: true, label: "PNG (sans perte, transparence)" },
    { id: "jpeg", mime: "image/jpeg", ext: "jpg", quality: true, label: "JPEG (photos)" },
    { id: "webp", mime: "image/webp", ext: "webp", alpha: true, quality: true, label: "WEBP (léger, transparence)" },
    { id: "avif", mime: "image/avif", ext: "avif", alpha: true, quality: true, label: "AVIF (très léger, transparence)" },
    { id: "gif", mime: "image/gif", ext: "gif", alpha: true, label: "GIF (256 couleurs)" },
    { id: "bmp", mime: "image/bmp", ext: "bmp", alpha: true, label: "BMP (Windows, sans compression)" },
    { id: "tiff", mime: "image/tiff", ext: "tif", alpha: true, label: "TIFF (impression, sans compression)" },
    { id: "ico", mime: "image/x-icon", ext: "ico", alpha: true, label: "ICO (icône de site ou d’application)" },
    { id: "pdf", mime: "application/pdf", ext: "pdf", quality: true, label: "PDF (document)" },
  ];
  const byId = (id) => LIST.find((f) => f.id === id) || LIST[0];
  const support = { png: true, jpeg: true, gif: true, bmp: true, tiff: true, ico: true, pdf: true };
  let ready = null;
  function detect() {
    if (ready) return ready;
    ready = Promise.all(["webp", "avif"].map((id) => new Promise((ok) => {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 2;
        c.toBlob((b) => { support[id] = !!b && b.type === byId(id).mime; ok(); }, byId(id).mime, 0.8);
      } catch (e) { ok(); }
    })));
    return ready;
  }
  const toBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  function flatten(c, bg) { const t = mk(c.width, c.height), g = t.getContext("2d"); g.fillStyle = bg || "#ffffff"; g.fillRect(0, 0, t.width, t.height); g.drawImage(c, 0, 0); return t; }
  const pixels = (c) => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;

  // Enregistre un canvas au format id ; quality 0..1 ; bg : couleur sous la transparence (JPEG, PDF)
  async function save(canvas, id, quality, bg) {
    const f = byId(id), q = quality == null ? 0.9 : quality;
    if (f.id === "jpeg") return toBlob(flatten(canvas, bg), f.mime, q);
    if (f.id === "png" || f.id === "webp" || f.id === "avif") {
      const b = await toBlob(canvas, f.mime, q);
      if (!b || b.type !== f.mime) throw { code: "format" };
      return b;
    }
    if (f.id === "gif") return new Blob([encodeGIF([{ rgba: pixels(canvas), delay: 100 }], canvas.width, canvas.height)], { type: f.mime });
    if (f.id === "bmp") return new Blob([encodeBMP(pixels(canvas), canvas.width, canvas.height)], { type: f.mime });
    if (f.id === "tiff") return new Blob([encodeTIFF(pixels(canvas), canvas.width, canvas.height)], { type: f.mime });
    if (f.id === "ico") {
      const sizes = [16, 32, 48, 64, 128, 256], pngs = [];
      for (const s of sizes) {
        const t = mk(s, s), g = t.getContext("2d"), k = Math.min(s / canvas.width, s / canvas.height);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.drawImage(canvas, (s - canvas.width * k) / 2, (s - canvas.height * k) / 2, canvas.width * k, canvas.height * k);
        pngs.push({ size: s, data: new Uint8Array(await (await toBlob(t, "image/png")).arrayBuffer()) });
      }
      return new Blob([encodeICO(pngs)], { type: f.mime });
    }
    if (f.id === "pdf") {
      const j = new Uint8Array(await (await toBlob(flatten(canvas, bg), "image/jpeg", q)).arrayBuffer());
      return new Blob([encodePDF([{ jpeg: j, w: canvas.width, h: canvas.height }])], { type: f.mime });
    }
    throw { code: "format" };
  }
  // Remplit un <select> avec les formats (traduits) ; only : liste d'ids à proposer
  function fill(sel, only, value) {
    const tr = root.trad || ((s) => s);
    const ids = (only || LIST.map((f) => f.id)).filter((id) => support[id] !== false);
    sel.innerHTML = ids.map((id) => `<option value="${id}">${tr(byId(id).label)}</option>`).join("");
    sel.value = ids.includes(value) ? value : ids[0];
    detect().then(() => {
      const v = sel.value;
      [...sel.options].forEach((o) => { if (support[o.value] === false) o.remove(); });
      if (![...sel.options].some((o) => o.value === v)) sel.value = sel.options[0].value;
    });
  }
  const ext = (id) => byId(id).ext;

  const api = { quantize, indexImage, encodeGIF, encodeBMP, encodeTIFF, encodeICO, encodePDF, LIST, byId, support, detect, save, fill, ext };
  root.Formats = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
