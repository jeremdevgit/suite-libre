// SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit
// Tests des encodeurs de LibreMedias : node --test tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const F = require("../libremedias/formats.js");

// Décodeur GIF minimal (images pleines, palette locale) pour vérifier l'aller-retour
function decodeGIF(b) {
  assert.strictEqual(String.fromCharCode(...b.slice(0, 6)), "GIF89a");
  const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8), frames = [];
  let p = 13, trans = -1, delay = 0;
  while (p < b.length) {
    const t = b[p++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = b[p++];
      if (label === 0xf9) { const flags = b[p + 1]; delay = (b[p + 2] | (b[p + 3] << 8)) * 10; trans = flags & 1 ? b[p + 4] : -1; }
      while (b[p]) p += b[p] + 1;
      p++;
      continue;
    }
    assert.strictEqual(t, 0x2c);
    const flags = b[p + 8]; p += 9;
    const n = 1 << ((flags & 7) + 1), pal = b.slice(p, p + 3 * n); p += 3 * n;
    const minBits = b[p++], data = [];
    while (b[p]) { data.push(...b.slice(p + 1, p + 1 + b[p])); p += b[p] + 1; }
    p++;
    const clear = 1 << minBits, eoi = clear + 1, out = [];
    let size = minBits + 1, dict = [], prev = null, bitPos = 0;
    const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = []; size = minBits + 1; prev = null; };
    reset();
    for (;;) {
      let code = 0;
      for (let i = 0; i < size; i++, bitPos++) code |= ((data[bitPos >> 3] >> (bitPos & 7)) & 1) << i;
      if (code === clear) { reset(); continue; }
      if (code === eoi) break;
      let entry;
      if (code < dict.length) entry = dict[code];
      else entry = prev.concat(prev[0]);
      out.push(...entry);
      if (prev) { dict.push(prev.concat(entry[0])); if (dict.length === 1 << size && size < 12) size++; }
      prev = entry;
    }
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const k = out[i];
      if (k === trans) continue;
      rgba[i * 4] = pal[k * 3]; rgba[i * 4 + 1] = pal[k * 3 + 1]; rgba[i * 4 + 2] = pal[k * 3 + 2]; rgba[i * 4 + 3] = 255;
    }
    assert.strictEqual(out.length, w * h);
    frames.push({ rgba, delay });
  }
  return { w, h, frames };
}

function image(w, h, fn) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(fn(x, y), (y * w + x) * 4); return d; }

test("GIF : aller-retour exact avec peu de couleurs, transparence et animation", () => {
  const cols = [[255, 0, 0, 255], [0, 128, 255, 255], [20, 200, 60, 255], [0, 0, 0, 0]];
  const a = image(37, 23, (x, y) => cols[(x + y * 3) % 4]), b = image(37, 23, (x, y) => cols[(x * y) % 3]);
  const gif = F.encodeGIF([{ rgba: a, delay: 120 }, { rgba: b, delay: 50 }], 37, 23, { dither: false });
  const d = decodeGIF(gif);
  assert.strictEqual(d.frames.length, 2);
  assert.strictEqual(d.frames[0].delay, 120);
  for (const [src, fr] of [[a, d.frames[0]], [b, d.frames[1]]])
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) { assert.strictEqual(fr.rgba[i + 3], 0); continue; }
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(src[i + c] - fr.rgba[i + c]) <= 4, "pixel " + i);
    }
});

test("GIF : grande image dégradée (dictionnaire LZW plein) décodée sans erreur", () => {
  const w = 300, h = 200, a = image(w, h, (x, y) => [x % 256, y, (x * y) % 256, 255]);
  const d = decodeGIF(F.encodeGIF([{ rgba: a }], w, h));
  let err = 0;
  for (let i = 0; i < a.length; i += 4) err += Math.abs(a[i] - d.frames[0].rgba[i]);
  assert.ok(err / (w * h) < 20, "écart moyen " + err / (w * h));
});

test("BMP : en-tête et pixels", () => {
  const b = F.encodeBMP(new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128]), 2, 1);
  const v = new DataView(b.buffer);
  assert.strictEqual(String.fromCharCode(b[0], b[1]), "BM");
  assert.strictEqual(v.getUint32(2, true), b.length);
  assert.strictEqual(v.getInt32(22, true), -1);
  const off = v.getUint32(10, true);
  assert.deepStrictEqual([...b.slice(off, off + 8)], [30, 20, 10, 255, 60, 50, 40, 128]);
});

test("TIFF : structure et données", () => {
  const px = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]), b = F.encodeTIFF(px, 2, 1), v = new DataView(b.buffer);
  assert.strictEqual(v.getUint16(2, true), 42);
  const ifd = v.getUint32(4, true), n = v.getUint16(ifd, true), tags = {};
  for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; tags[v.getUint16(e, true)] = v.getUint32(e + 8, true); }
  assert.strictEqual(tags[256], 2); assert.strictEqual(tags[257], 1);
  assert.deepStrictEqual([...b.slice(tags[273], tags[273] + 8)], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("ICO et PDF : répertoire et table des références", () => {
  const ico = F.encodeICO([{ size: 16, data: new Uint8Array([1, 2, 3]) }, { size: 256, data: new Uint8Array([4, 5]) }]), v = new DataView(ico.buffer);
  assert.strictEqual(v.getUint16(4, true), 2);
  assert.strictEqual(ico[6 + 16], 0);
  assert.deepStrictEqual([...ico.slice(v.getUint32(6 + 16 + 12, true))], [4, 5]);
  const pdf = F.encodePDF([{ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), w: 100, h: 50 }]), s = Buffer.from(pdf).toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4"));
  const xref = +/startxref\n(\d+)/.exec(s)[1];
  assert.ok(s.slice(xref).startsWith("xref"));
  const offs = [...s.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1]);
  offs.forEach((o, i) => assert.ok(s.slice(o).startsWith(i + 1 + " 0 obj")));
  assert.ok(s.includes("/MediaBox [0 0 75 37.5]"));
});
