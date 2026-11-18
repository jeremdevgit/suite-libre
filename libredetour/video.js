/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreDetour — vidéos : incrustation (fond vert ou uni), caméra fixe (différence avec le fond), aperçu en direct,
// enregistrement en vidéo WEBM ou en suite d'images PNG transparentes
(function () {
  const D = window.Detourage;
  const video = $("video"), cv = $("vcv"), ctx = cv.getContext("2d");
  const PREF = "libredetour-video-v1";
  const P = Object.assign({
    method: "couleur", key: "#00b140", keyAuto: true, tol: 18, soft: 12, spill: 70, dtol: 16, dsoft: 14,
    garbage: false, gx: 0.05, gy: 0.05, gw: 0.9, gh: 0.9, clean: 1, shift: 0, feather: 1,
    bg: "none", bgc: "#ffffff", blur: 40, view: "result", size: 1280, fps: 30, sound: false,
  }, loadPref(PREF, {}));
  const savePrefs = () => savePref(PREF, P);
  const AIDE = {
    couleur: trad("Touche le fond sur l’aperçu pour choisir la couleur à retirer. Un fond bien éclairé, sans plis ni ombres, donne le meilleur résultat."),
    fixe: trad("Pour une vidéo filmée sans bouger la caméra. Le fond est calculé à partir de la vidéo (le sujet doit bouger), ou pris sur une image où le sujet est absent."),
  };
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const fmtT = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ":" + String(r).padStart(2, "0"); };
  const canFilter = (() => {
    try { const c = mk(9, 9), g = c.getContext("2d"); g.filter = "blur(2px)"; g.fillStyle = "#fff"; g.fillRect(4, 4, 1, 1); return g.getImageData(2, 4, 1, 1).data[3] > 0; } catch (e) { return false; }
  })();
  let toastTimer = 0;
  function vtoast(t) { const el = $("vtoast"); el.textContent = t; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.textContent = ""), 5000); }

  // ---------- Source ----------
  let kind = null, url = null, stream = null, name = "video", demo = null, autoKey = [0, 177, 64];
  let pw = 0, ph = 0, work = null, wg = null, sub = null, sg = null, alpha = null, plateC = null, plateData = null;
  let bgImg = null, busy = false;
  const live = () => kind === "camera" || kind === "demo";

  function sizeFor(vw, vh) {
    const k = Math.min(1, P.size / Math.max(vw, vh));
    return [Math.max(2, Math.round(vw * k)) & ~1, Math.max(2, Math.round(vh * k)) & ~1];
  }
  function ensureSize() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;
    const [w, h] = sizeFor(vw, vh);
    if (w === pw && h === ph) return true;
    pw = w; ph = h;
    work = mk(pw, ph); wg = work.getContext("2d", { willReadFrequently: true });
    sub = mk(pw, ph); sg = sub.getContext("2d");
    cv.width = pw; cv.height = ph;
    alpha = new Float32Array(pw * ph);
    plateData = null;
    return true;
  }
  function stopSource() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (demo) { cancelAnimationFrame(demo.raf); demo = null; }
    if (url) URL.revokeObjectURL(url);
    url = null;
    video.pause(); video.removeAttribute("src"); video.srcObject = null;
    plateC = null; plateData = null; pw = ph = 0;
  }
  function shown() {
    $("vvide").hidden = true; $("vscene").hidden = false; $("verr").hidden = true;
  }
  async function useFile(file) {
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|m4v|mov|webm|mkv|ogv)$/i.test(file.name || "")) { vtoast(trad("Ce fichier n’est pas une vidéo.")); return; }
    stopSource();
    kind = "file"; name = file.name || "video"; url = URL.createObjectURL(file);
    video.src = url; video.loop = false; video.muted = !P.sound || !!audio;
    shown(); sync();
  }
  async function useCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { vtoast(trad("La caméra n’est pas disponible dans ce navigateur.")); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stopSource();
      stream = s; kind = "camera"; name = trad("camera");
      video.srcObject = s; video.muted = true;
      shown(); sync();
      await video.play();
    } catch (e) { vtoast(trad("Accès à la caméra refusé ou impossible.")); }
  }
  // Exemple : animation sur fond vert, filmée en direct
  function useDemo() {
    stopSource();
    const c = mk(960, 540), g = c.getContext("2d");
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      const bg = g.createRadialGradient(480, 200, 60, 480, 270, 620); bg.addColorStop(0, "#2fd06a"); bg.addColorStop(1, "#13923f");
      g.fillStyle = bg; g.fillRect(0, 0, 960, 540);
      const x = 480 + Math.sin(t * 0.9) * 260, y = 300 + Math.abs(Math.sin(t * 2.2)) * -40;
      g.fillStyle = "rgba(0,60,20,.35)"; g.beginPath(); g.ellipse(x, 520, 110, 16, 0, 0, 7); g.fill();
      g.fillStyle = "#3d5afe"; g.beginPath(); g.roundRect(x - 85, y + 40, 170, 200, 70); g.fill();
      g.fillStyle = "#f2c39f"; g.beginPath(); g.arc(x, y - 30, 72, 0, 7); g.fill();
      g.fillStyle = "#5a3a22"; g.beginPath(); g.arc(x, y - 48, 76, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.fillStyle = "#222"; [-24, 24].forEach((d) => { g.beginPath(); g.arc(x + d, y - 28, 7, 0, 7); g.fill(); });
      g.strokeStyle = "#a0522d"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.arc(x, y - 8, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.strokeStyle = "#f2c39f"; g.lineWidth = 26; g.beginPath(); g.moveTo(x + 70, y + 80); g.lineTo(x + 130 + Math.sin(t * 6) * 20, y - 10); g.stroke();
      demo.raf = requestAnimationFrame(step);
    };
    demo = { raf: 0 }; step();
    stream = c.captureStream(30); kind = "demo"; name = trad("exemple");
    video.srcObject = stream; video.muted = true;
    P.method = "couleur"; P.keyAuto = true; savePrefs();
    shown(); sync();
    video.play().catch(() => {});
  }
  $("vfile").addEventListener("change", (e) => { useFile(e.target.files[0]); e.target.value = ""; });
  $("vcam").addEventListener("click", useCamera);
  $("vdemo").addEventListener("click", useDemo);
  [$("vvide"), $("vstage")].forEach((dz) => {
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => useFile(e.dataTransfer.files[0]));
  });
  video.addEventListener("loadedmetadata", () => {
    ensureSize();
    if (kind === "file") { $("vin").value = 0; $("vout").value = (video.duration || 0).toFixed(1); }
    $("vfacts").textContent = `${video.videoWidth} × ${video.videoHeight}` + (kind === "file" && isFinite(video.duration) ? " · " + fmtT(video.duration) : "");
    sync();
  });
  video.addEventListener("loadeddata", () => { refreshAutoKey(); render(); });
  video.addEventListener("seeked", () => { if (!busy) render(); });
  video.addEventListener("error", () => { if (kind === "file") { $("verr").textContent = trad("Cette vidéo n’a pas pu être lue par le navigateur. Essaie un fichier MP4 (H.264) ou WEBM."); $("verr").hidden = false; } });
  video.addEventListener("timeupdate", syncTime);
  video.addEventListener("play", () => { loop(); sync(); });
  video.addEventListener("pause", sync);
  video.addEventListener("ended", sync);

  function refreshAutoKey() {
    if (!ensureSize()) return;
    wg.drawImage(video, 0, 0, pw, ph);
    autoKey = D.borderColor(wg.getImageData(0, 0, pw, ph).data, pw, ph);
    sync();
  }
  const keyColor = () => (P.keyAuto ? autoKey : hex(P.key));

  // ---------- Image par image ----------
  function render() {
    if (!ensureSize()) return;
    const n = pw * ph;
    wg.drawImage(video, 0, 0, pw, ph);
    if (P.view === "source") { ctx.clearRect(0, 0, pw, ph); ctx.drawImage(work, 0, 0); drawGarbage(); return; }
    const id = wg.getImageData(0, 0, pw, ph), d = id.data;
    let gray = null;
    if (P.bg === "gray" && P.view === "result") {
      gray = new ImageData(pw, ph);
      for (let i = 0; i < n * 4; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; gray.data[i] = gray.data[i + 1] = gray.data[i + 2] = v; gray.data[i + 3] = 255; }
    }
    if (P.method === "couleur") D.chromaKey(d, n, keyColor(), P.tol / 100, P.soft / 100, P.spill / 100, alpha);
    else if (plateC) {
      if (!plateData) { const t = mk(pw, ph).getContext("2d", { willReadFrequently: true }); t.drawImage(plateC, 0, 0, pw, ph); plateData = t.getImageData(0, 0, pw, ph).data; }
      D.diffKey(d, plateData, n, P.dtol / 100, P.dsoft / 100, alpha);
    } else alpha.fill(1);
    if (P.garbage) {
      const x0 = P.gx * pw, y0 = P.gy * ph, x1 = (P.gx + P.gw) * pw, y1 = (P.gy + P.gh) * ph;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (x < x0 || x > x1 || y < y0 || y > y1) alpha[y * pw + x] = 0;
    }
    const k = Math.max(pw, ph) / 1280;
    if (P.clean) {
      const r = Math.max(1, Math.round(P.clean * k));
      D.morph(alpha, pw, ph, -r); D.morph(alpha, pw, ph, r); // ouverture : retire les points isolés
      D.morph(alpha, pw, ph, r); D.morph(alpha, pw, ph, -r); // fermeture : bouche les petits trous
    }
    if (P.shift) D.morph(alpha, pw, ph, P.shift * k);
    if (P.feather) D.feather(alpha, pw, ph, P.feather * k);
    if (P.view === "mask") {
      for (let i = 0; i < n; i++) { const v = alpha[i] * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
      ctx.putImageData(id, 0, 0); drawGarbage(); return;
    }
    for (let i = 0; i < n; i++) d[i * 4 + 3] = alpha[i] * 255;
    sg.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    if (P.bg === "color") { ctx.fillStyle = P.bgc; ctx.fillRect(0, 0, pw, ph); }
    else if (P.bg === "blur") {
      const rad = Math.max(1, (P.blur / 100) * Math.max(pw, ph) * 0.03);
      if (canFilter) { ctx.save(); ctx.filter = `blur(${rad}px)`; ctx.drawImage(work, 0, 0); ctx.restore(); }
      else { const f = Math.max(2, rad / 2), s = mk(Math.round(pw / f), Math.round(ph / f)); s.getContext("2d").drawImage(work, 0, 0, s.width, s.height); ctx.drawImage(s, 0, 0, pw, ph); }
    } else if (P.bg === "gray" && gray) ctx.putImageData(gray, 0, 0);
    else if (P.bg === "image" && bgImg) {
      const s = Math.max(pw / bgImg.width, ph / bgImg.height);
      ctx.drawImage(bgImg, (pw - bgImg.width * s) / 2, (ph - bgImg.height * s) / 2, bgImg.width * s, bgImg.height * s);
    }
    ctx.drawImage(sub, 0, 0);
    if (!rec) drawGarbage();
  }
  function drawGarbage() {
    if (!P.garbage || rec) return;
    const r = cv.getBoundingClientRect(), lw = r.width ? cv.width / r.width : 1;
    const g = gdrag ? gdrag.r : { x: P.gx, y: P.gy, w: P.gw, h: P.gh };
    ctx.save(); ctx.lineWidth = 2 * lw; ctx.setLineDash([7 * lw, 5 * lw]);
    ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeRect(g.x * pw, g.y * ph, g.w * pw, g.h * ph);
    ctx.lineDashOffset = 6 * lw; ctx.strokeStyle = "#fff"; ctx.strokeRect(g.x * pw, g.y * ph, g.w * pw, g.h * ph);
    ctx.restore();
  }
  let looping = false;
  function loop() {
    if (looping) return;
    looping = true;
    const next = (fn) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(fn) : requestAnimationFrame(fn));
    const step = () => {
      if (video.paused || video.ended || !paneVisible()) { looping = false; return; }
      render(); syncTime();
      if (rec && kind === "file" && video.currentTime >= recEnd) { stopRec(); }
      next(step);
    };
    next(step);
  }
  let rq = 0;
  const rerender = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; if (video.paused || live()) render(); }); };
  const paneVisible = () => !document.querySelector('[data-pane="video"]').hidden;

  // ---------- Lecture ----------
  $("vplay").addEventListener("click", () => {
    if (video.paused) {
      if (kind === "file" && video.ended) video.currentTime = 0;
      video.play().catch(() => {});
    } else video.pause();
  });
  $("vseek").addEventListener("input", () => { if (kind === "file" && isFinite(video.duration)) video.currentTime = ($("vseek").value / 1000) * video.duration; });
  function syncTime() {
    if (kind !== "file" || !isFinite(video.duration)) { $("vtime").textContent = live() ? trad("en direct") : "0:00"; return; }
    $("vseek").value = Math.round((video.currentTime / video.duration) * 1000) || 0;
    $("vtime").textContent = fmtT(video.currentTime) + " / " + fmtT(video.duration);
  }
  $("vsound").addEventListener("input", () => { P.sound = $("vsound").checked; savePrefs(); applySound(); });
  function applySound() {
    if (audio) { video.muted = false; audio.gain.gain.value = P.sound ? 1 : 0; }
    else video.muted = !P.sound;
  }

  // ---------- Pointeur : pipette ou cadre ----------
  let gdrag = null;
  const ptN = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  cv.addEventListener("pointerdown", (e) => {
    if (!pw || rec) return;
    e.preventDefault();
    const p = ptN(e);
    if (P.garbage) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} gdrag = { p0: p, r: { x: p[0], y: p[1], w: 0, h: 0 } }; return; }
    if (P.method === "couleur") {
      wg.drawImage(video, 0, 0, pw, ph);
      const x = Math.floor(p[0] * pw), y = Math.floor(p[1] * ph), d = wg.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      set({ key: toHex(r / n, g / n, b / n), keyAuto: false });
      vtoast(trad("Couleur du fond choisie."));
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!gdrag) return;
    const p = ptN(e), a = gdrag.p0;
    gdrag.r = { x: Math.min(a[0], p[0]), y: Math.min(a[1], p[1]), w: Math.abs(p[0] - a[0]), h: Math.abs(p[1] - a[1]) };
    rerender();
  });
  const endG = () => {
    if (!gdrag) return;
    const r = gdrag.r; gdrag = null;
    if (r.w > 0.03 && r.h > 0.03) set({ gx: r.x, gy: r.y, gw: r.w, gh: r.h }); else rerender();
  };
  cv.addEventListener("pointerup", endG);
  cv.addEventListener("pointercancel", endG);

  // ---------- Fond automatique ----------
  async function captureFrame() {
    const c = mk(pw, ph); c.getContext("2d").drawImage(video, 0, 0, pw, ph); return c;
  }
  const seek = (t) => new Promise((ok) => {
    let done = false;
    const fin = () => { if (done) return; done = true; video.removeEventListener("seeked", fin); ok(); };
    video.addEventListener("seeked", fin);
    setTimeout(fin, 3000);
    video.currentTime = t;
  });
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  $("vplate-now").addEventListener("click", async () => {
    if (!ensureSize()) return;
    plateC = await captureFrame(); plateData = null;
    set({ method: "fixe" });
    vtoast(trad("Fond enregistré : le sujet doit être absent de cette image."));
  });
  $("vplate-auto").addEventListener("click", async () => {
    if (!ensureSize() || busy) return;
    busy = true; sync();
    const frames = [], F = 21, was = video.currentTime, playing = !video.paused;
    const bar = $("vprogress"); bar.hidden = false;
    try {
      if (kind === "file") {
        video.pause();
        const t0 = Math.max(0, +$("vin").value || 0), t1 = Math.min(video.duration || 0, +$("vout").value || video.duration || 0);
        for (let f = 0; f < F; f++) {
          await seek(t0 + ((t1 - t0) * (f + 0.5)) / F);
          wg.drawImage(video, 0, 0, pw, ph); frames.push(wg.getImageData(0, 0, pw, ph).data);
          bar.firstElementChild.style.width = Math.round(((f + 1) / F) * 100) + "%";
        }
        await seek(was);
      } else {
        for (let f = 0; f < F; f++) {
          await wait(150);
          wg.drawImage(video, 0, 0, pw, ph); frames.push(wg.getImageData(0, 0, pw, ph).data);
          bar.firstElementChild.style.width = Math.round(((f + 1) / F) * 100) + "%";
        }
      }
      const med = D.medianFrames(frames, pw * ph);
      plateC = mk(pw, ph);
      plateC.getContext("2d").putImageData(new ImageData(med, pw, ph), 0, 0);
      plateData = null;
      set({ method: "fixe" });
      vtoast(trad("Fond calculé à partir de {n} images.", { n: F }));
      if (playing) video.play().catch(() => {});
    } catch (e) { vtoast(trad("Le fond n’a pas pu être calculé.")); }
    bar.hidden = true; busy = false; sync(); render();
  });

  // ---------- Enregistrement ----------
  let rec = null, recEnd = 0, audio = null, cancel = false;
  function audioTracks() {
    if (kind !== "file") return [];
    try {
      if (!audio) {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaElementSource(video), dest = ac.createMediaStreamDestination(), gain = ac.createGain();
        src.connect(dest); src.connect(gain); gain.connect(ac.destination);
        audio = { ac, dest, gain };
        applySound();
      }
      if (audio.ac.state === "suspended") audio.ac.resume();
      return audio.dest.stream.getAudioTracks();
    } catch (e) { return []; }
  }
  function pickMime() {
    if (!window.MediaRecorder) return null;
    return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1", "video/mp4"].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
  }
  const base = () => name.replace(/\.[^.]+$/, "") + "-" + trad("detouree");
  $("vrec").addEventListener("click", async () => {
    if (rec || busy || !ensureSize()) return;
    const mime = pickMime();
    if (mime === null || !cv.captureStream) { vtoast(trad("L’enregistrement vidéo n’est pas disponible dans ce navigateur : utilise les images PNG.")); return; }
    if (!canSave()) { vtoast(trad("Le téléchargement n’est pas disponible ici.")); return; }
    const prevView = P.view;
    P.view = "result";
    const tracks = [...cv.captureStream(kind === "file" ? 30 : 30).getVideoTracks(), ...audioTracks()];
    const chunks = [];
    let r;
    try { r = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : {}); }
    catch (e) { P.view = prevView; vtoast(trad("L’enregistrement vidéo n’est pas disponible dans ce navigateur : utilise les images PNG.")); return; }
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const t0 = Math.max(0, +$("vin").value || 0);
    recEnd = Math.min(video.duration || Infinity, +$("vout").value || Infinity);
    const started = performance.now();
    rec = { r, prevView, started, t0 };
    r.onstop = async () => {
      const type = (r.mimeType || mime || "video/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      P.view = rec.prevView; rec = null; clearInterval(timer);
      $("vprogress").hidden = true; sync(); render();
      if (!blob.size) { vtoast(trad("La vidéo enregistrée est vide.")); return; }
      try { const s = await saveFile(base() + (type.includes("mp4") ? ".mp4" : ".webm"), blob); if (s === "saved") vtoast(trad("Vidéo enregistrée.")); } catch (err) { vtoast(saveErrorText(err)); }
    };
    if (kind === "file") { video.pause(); await seek(t0); }
    $("vprogress").hidden = false;
    const timer = setInterval(() => {
      if (!rec) return;
      const p = kind === "file" ? (video.currentTime - t0) / Math.max(0.1, recEnd - t0) : 0;
      $("vprogress").firstElementChild.style.width = kind === "file" ? Math.round(Math.min(1, p) * 100) + "%" : "100%";
      $("vout-hint").textContent = trad("Enregistrement… {t}", { t: fmtT((performance.now() - started) / 1000) });
    }, 250);
    r.start(250);
    sync();
    if (kind === "file") { video.play().catch(() => stopRec()); video.addEventListener("ended", stopRec, { once: true }); }
    else if (video.paused) video.play().catch(() => {});
  });
  function stopRec() {
    if (!rec) return;
    if (kind === "file") video.pause();
    try { rec.r.stop(); } catch (e) {}
  }
  $("vstop").addEventListener("click", () => { cancel = true; stopRec(); });

  $("vpng").addEventListener("click", async () => {
    if (rec || busy || kind !== "file" || !ensureSize()) return;
    if (!canSave()) { vtoast(trad("Le téléchargement n’est pas disponible ici.")); return; }
    const t0 = Math.max(0, +$("vin").value || 0), t1 = Math.min(video.duration || 0, +$("vout").value || video.duration || 0);
    const fps = P.fps, count = Math.max(1, Math.floor((t1 - t0) * fps));
    busy = true; cancel = false; sync();
    video.pause();
    const prevView = P.view; P.view = "result";
    const bar = $("vprogress"), files = [];
    bar.hidden = false; $("vstop").hidden = false;
    try {
      for (let i = 0; i < count && !cancel; i++) {
        await seek(t0 + i / fps);
        render();
        const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
        files.push({ name: base() + "/" + String(i + 1).padStart(5, "0") + ".png", blob });
        bar.firstElementChild.style.width = Math.round(((i + 1) / count) * 100) + "%";
        $("vout-hint").textContent = trad("Image {i} sur {n}", { i: i + 1, n: count });
      }
      if (!cancel && files.length) {
        const s = await saveFile(base() + "-png.zip", await window.LibreZip(files));
        if (s === "saved") vtoast(trad("Archive enregistrée."));
      }
    } catch (err) { vtoast(saveErrorText(err)); }
    P.view = prevView; busy = false; bar.hidden = true; $("vstop").hidden = true; sync(); render();
  });
  $("vframe").addEventListener("click", async () => {
    if (!ensureSize()) return;
    if (!canSave()) { vtoast(trad("Le téléchargement n’est pas disponible ici.")); return; }
    const prevView = P.view; P.view = "result"; render();
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    P.view = prevView; render();
    const t = kind === "file" ? "-" + video.currentTime.toFixed(2).replace(".", "s") : "";
    try { const s = await saveFile(base() + t + ".png", blob); if (s === "saved") vtoast(trad("Image enregistrée.")); } catch (err) { vtoast(saveErrorText(err)); }
  });
  $("vbgfile").addEventListener("change", (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const u = URL.createObjectURL(f), i = new Image();
    i.onload = () => { bgImg = i; bgImg.label = f.name; set({ bg: "image" }); };
    i.onerror = () => { URL.revokeObjectURL(u); vtoast(trad("Ce fichier n’a pas pu être lu comme une image.")); };
    i.src = u;
  });

  // ---------- Panneau ----------
  const press = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === val)));
  const out = (id, key, v) => { $(id).value = P[key]; $(id + "-o").textContent = v; };
  function sync() {
    press("#vmethods .tab", "vmethod", P.method);
    press("#vbgs .tab", "vbg", P.bg);
    press("#vviews .tab", "vview", P.view);
    $("vmethod-hint").textContent = AIDE[P.method];
    $("vm-couleur").hidden = P.method !== "couleur";
    $("vm-fixe").hidden = P.method !== "fixe";
    const kc = toHex(...keyColor());
    $("vkeysw").style.background = kc; $("vkey").value = kc;
    $("vkey-auto").setAttribute("aria-pressed", String(P.keyAuto));
    out("vtol", "tol", P.tol); out("vsoft", "soft", P.soft); out("vspill", "spill", P.spill + " %");
    out("vdtol", "dtol", P.dtol); out("vdsoft", "dsoft", P.dsoft);
    $("vplate-state").textContent = plateC ? trad("Fond prêt.") : trad("Aucun fond pour l’instant.");
    $("vgarbage").checked = P.garbage; $("vgarbage-hint").hidden = !P.garbage;
    out("vclean", "clean", P.clean); out("vshift", "shift", (P.shift > 0 ? "+" : "") + P.shift); out("vfeather", "feather", P.feather);
    $("vbg-color-row").hidden = P.bg !== "color"; $("vbgc").value = P.bgc;
    $("vblur-row").hidden = P.bg !== "blur"; out("vblur", "blur", P.blur + " %");
    $("vbgimg-row").hidden = P.bg !== "image"; $("vbgimg-name").textContent = bgImg ? bgImg.label : "";
    $("vsize").value = P.size; $("vfps").value = P.fps; $("vsound").checked = P.sound;
    const file = kind === "file", work = !!rec || busy;
    $("vplay").textContent = video.paused ? trad("Lecture") : trad("Pause");
    $("vplay").hidden = !kind; $("vseek").hidden = !file; $("vsound").closest("label").hidden = !file;
    $("vpng").hidden = !file; $("vin").closest(".f").hidden = !file; $("vout").closest(".f").hidden = !file; $("vfps").closest(".f").hidden = !file;
    ["vrec", "vpng", "vframe", "vplate-auto", "vplate-now"].forEach((id) => ($(id).disabled = !kind || work));
    $("vrec").textContent = file ? trad("Enregistrer la vidéo") : trad("Démarrer l’enregistrement");
    $("vstop").hidden = !(rec || (busy && !$("vprogress").hidden && kind === "file"));
    if (!rec && !busy) $("vout-hint").textContent = P.bg === "none" ? trad("Fond transparent : les images PNG gardent la transparence ; dans une vidéo WEBM, elle dépend du navigateur.") : "";
    cv.style.cursor = P.garbage ? "crosshair" : P.method === "couleur" ? "copy" : "default";
    syncTime();
  }
  function set(patch) { Object.assign(P, patch); savePrefs(); sync(); rerender(); }
  $("vmethods").addEventListener("click", (e) => { const b = e.target.closest("[data-vmethod]"); if (b) set({ method: b.dataset.vmethod }); });
  $("vbgs").addEventListener("click", (e) => { const b = e.target.closest("[data-vbg]"); if (!b) return; set({ bg: b.dataset.vbg }); if (b.dataset.vbg === "image" && !bgImg) $("vbgfile").click(); });
  $("vviews").addEventListener("click", (e) => { const b = e.target.closest("[data-vview]"); if (b) set({ view: b.dataset.vview }); });
  $("vkey").addEventListener("input", () => set({ key: $("vkey").value, keyAuto: false }));
  $("vkey-auto").addEventListener("click", () => { P.keyAuto = true; refreshAutoKey(); set({}); });
  [["vtol", "tol"], ["vsoft", "soft"], ["vspill", "spill"], ["vdtol", "dtol"], ["vdsoft", "dsoft"], ["vclean", "clean"], ["vshift", "shift"], ["vfeather", "feather"], ["vblur", "blur"]]
    .forEach(([id, k]) => $(id).addEventListener("input", () => set({ [k]: +$(id).value })));
  $("vgarbage").addEventListener("input", () => set({ garbage: $("vgarbage").checked }));
  $("vbgc").addEventListener("input", () => set({ bgc: $("vbgc").value }));
  $("vbgimg-btn").addEventListener("click", () => $("vbgfile").click());
  $("vsize").addEventListener("input", () => { P.size = +$("vsize").value; savePrefs(); pw = ph = 0; ensureSize(); rerender(); });
  $("vfps").addEventListener("input", () => { P.fps = +$("vfps").value; savePrefs(); });

  setupTabs($("ptabs"), (tab) => {
    if (tab !== "video" && !video.paused && !rec) video.pause();
    if (tab === "video" && !video.paused) loop();
  });
  sync();
})();
