/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE = "librerr-style-v1";
  // Hors de claude.ai (fichier téléchargé ou version serveur), les téléchargements directs fonctionnent
  let standalone = false;
  try { standalone = window.top === window.self; } catch (e) {}
  if (standalone && /^https?:$/.test(location.protocol)) $("dl-app").hidden = false;

  // ---------- Contenu ----------
  const TABS = ["lien", "courriel", "texte", "wifi", "telephone", "sms", "contact", "lieu"];
  let tab = "lien";

  const enc = encodeURIComponent;
  const wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");
  const vEsc = (s) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
  const telClean = (s) => s.replace(/[^\d+]/g, "");

  function mailto() {
    const to = $("m-to").value.split(/[,;]/).map((s) => s.trim()).filter(Boolean).join(",");
    const q = [];
    const cc = $("m-cc").value.trim(), bcc = $("m-bcc").value.trim();
    const subj = $("m-subject").value, body = $("m-body").value;
    if (cc) q.push("cc=" + enc(cc));
    if (bcc) q.push("bcc=" + enc(bcc));
    if (subj) q.push("subject=" + enc(subj));
    if (body) q.push("body=" + enc(body.replace(/\r?\n/g, "\r\n")));
    return "mailto:" + to + (q.length ? "?" + q.join("&") : "");
  }

  function payload() {
    switch (tab) {
      case "lien": {
        let u = $("url").value.trim();
        if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
        return u;
      }
      case "courriel": return mailto();
      case "texte": return $("txt").value;
      case "wifi": {
        const t = $("w-type").value;
        let s = "WIFI:T:" + t + ";S:" + wifiEsc($("w-ssid").value) + ";";
        if (t !== "nopass") s += "P:" + wifiEsc($("w-pass").value) + ";";
        if ($("w-hidden").checked) s += "H:true;";
        return s + ";";
      }
      case "telephone": return "tel:" + telClean($("tel").value);
      case "sms": return "SMSTO:" + telClean($("s-num").value) + ":" + $("s-msg").value;
      case "contact": {
        const f = $("c-first").value.trim(), l = $("c-last").value.trim();
        const lines = ["BEGIN:VCARD", "VERSION:3.0", "N:" + vEsc(l) + ";" + vEsc(f) + ";;;", "FN:" + vEsc([f, l].filter(Boolean).join(" "))];
        const add = (k, id) => { const v = $(id).value.trim(); if (v) lines.push(k + ":" + vEsc(v)); };
        add("ORG", "c-org"); add("TITLE", "c-title");
        if ($("c-tel").value.trim()) lines.push("TEL;TYPE=CELL:" + telClean($("c-tel").value));
        add("EMAIL", "c-mail"); add("URL", "c-url");
        if ($("c-adr").value.trim()) lines.push("ADR:;;" + vEsc($("c-adr").value.trim()) + ";;;;");
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      case "lieu": {
        const la = $("g-lat").value, lo = $("g-lng").value;
        return $("g-fmt").value === "geo" ? "geo:" + la + "," + lo : "https://www.google.com/maps?q=" + la + "," + lo;
      }
    }
    return "";
  }

  function setTab(t, fromHash) {
    if (!TABS.includes(t)) t = "lien";
    tab = t;
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    document.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== t));
    if (!fromHash) { try { history.replaceState(null, "", "#" + t); } catch (e) {} }
    render();
  }
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) setTab(b.dataset.tab); });

  // ---------- Style ----------
  const DOTS = [
    ["square", trad("Carrés"), '<rect x="3" y="3" width="11" height="11"/><rect x="16" y="3" width="11" height="11"/><rect x="3" y="16" width="11" height="11"/>'],
    ["dots", trad("Ronds"), '<circle cx="8.5" cy="8.5" r="5.5"/><circle cx="21.5" cy="8.5" r="5.5"/><circle cx="8.5" cy="21.5" r="5.5"/>'],
    ["rounded", trad("Arrondis"), '<rect x="3" y="3" width="24" height="11" rx="5.5"/><rect x="3" y="16" width="11" height="11" rx="5.5"/>'],
    ["extra-rounded", trad("Très arrondis"), '<rect x="3" y="3" width="24" height="11" rx="5.5"/><circle cx="8.5" cy="21.5" r="5.5"/>'],
    ["classy", trad("Élégants"), '<path d="M3 3h11v11H8.5A5.5 5.5 0 0 1 3 8.5zM16 16h11v5.5a5.5 5.5 0 0 1-5.5 5.5H16z"/>'],
    ["classy-rounded", trad("Élégants ronds"), '<path d="M3 8.5A5.5 5.5 0 0 1 8.5 3H14v11H3zM16 16h11v5.5a5.5 5.5 0 0 1-5.5 5.5H16z"/>'],
  ];
  const CORNERS = [
    ["square", trad("Carrés"), '<path d="M3 3h24v24H3zM7 7v16h16V7z" fill-rule="evenodd"/><rect x="11" y="11" width="8" height="8"/>'],
    ["extra-rounded", trad("Arrondis"), '<path d="M10 3h10a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7V10a7 7 0 0 1 7-7zm0 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3z" fill-rule="evenodd"/><rect x="11" y="11" width="8" height="8" rx="2"/>'],
    ["dot", trad("Ronds"), '<path d="M15 3a12 12 0 1 1 0 24 12 12 0 0 1 0-24zm0 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" fill-rule="evenodd"/><circle cx="15" cy="15" r="4.5"/>'],
  ];
  const PALETTES = [
    ["#15201e", "#ffffff"], ["#000000", "#ffffff"], ["#0f6e66", "#ffffff"], ["#1d3a8a", "#eef2ff"],
    ["#7a1f3d", "#fff4f6"], ["#3b2a1a", "#f7efe3"], ["#14532d", "#f0fdf4"], ["#4c1d95", "#faf5ff"],
  ];

  const DEFAULTS = {
    size: 1024, margin: 40, ecl: "M", dots: "#15201e", bg: "#ffffff", bgT: false,
    grad: false, dots2: "#0f6e66", gradType: "linear", gradRot: 45,
    dotType: "rounded", cornerType: "extra-rounded", cornerCustom: false, corner: "#0f6e66", cornerDot: "#0f6e66",
    imgSize: 0.32, imgMargin: 8, imgHide: true,
  };
  let S = Object.assign({}, DEFAULTS);
  let image = null; // data URL, gardée pour la session seulement

  try { const saved = JSON.parse(localStorage.getItem(STORE) || "null"); if (saved) S = Object.assign(S, saved); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };

  function shapeButtons(el, list, key) {
    el.innerHTML = list.map(([v, n, svg]) =>
      `<button class="shape" data-v="${v}" aria-pressed="false"><svg viewBox="0 0 30 30" aria-hidden="true">${svg}</svg>${n}</button>`).join("");
    el.addEventListener("click", (e) => { const b = e.target.closest(".shape"); if (!b) return; S[key] = b.dataset.v; syncUI(); render(); });
  }
  shapeButtons($("dot-shapes"), DOTS, "dotType");
  shapeButtons($("corner-shapes"), CORNERS, "cornerType");

  $("swatches").innerHTML = PALETTES.map(([a, b], i) =>
    `<button class="sw" data-i="${i}" aria-label="${trad("Palette {a} sur {b}", { a, b })}" title="${trad("{a} sur {b}", { a, b })}"><i style="background:${b}"></i><i style="background:${a}"></i></button>`).join("");
  $("swatches").addEventListener("click", (e) => {
    const b = e.target.closest(".sw"); if (!b) return;
    const [a, bg] = PALETTES[+b.dataset.i];
    S.dots = a; S.bg = bg; S.bgT = false; S.grad = false; syncUI(); render();
  });

  const BIND = [
    ["size", "size", "num"], ["margin", "margin", "num"], ["ecl", "ecl"], ["c-dots", "dots"], ["c-bg", "bg"],
    ["bg-transparent", "bgT", "bool"], ["grad", "grad", "bool"], ["c-dots2", "dots2"], ["grad-type", "gradType"],
    ["grad-rot", "gradRot", "num"], ["corner-custom", "cornerCustom", "bool"], ["c-corner", "corner"], ["c-cornerdot", "cornerDot"],
    ["img-size", "imgSize", "num"], ["img-margin", "imgMargin", "num"], ["img-hide", "imgHide", "bool"],
  ];
  BIND.forEach(([id, key, kind]) => {
    $(id).addEventListener("input", () => {
      const el = $(id);
      S[key] = kind === "bool" ? el.checked : kind === "num" ? +el.value : el.value;
      syncUI(); render();
    });
  });

  function syncUI() {
    BIND.forEach(([id, key, kind]) => { const el = $(id); if (kind === "bool") el.checked = !!S[key]; else if (el.value != S[key]) el.value = S[key]; });
    $("size-o").textContent = S.size + " px";
    $("margin-o").textContent = S.margin + " px";
    $("grad-rot-o").textContent = S.gradRot + "°";
    $("img-size-o").textContent = Math.round(S.imgSize * 100) + " %";
    $("img-margin-o").textContent = S.imgMargin + " px";
    $("c-dots-o").textContent = S.dots;
    $("c-bg-o").textContent = S.bgT ? trad("transparent") : S.bg;
    $("c-bg").disabled = S.bgT;
    $("grad-opts").hidden = !S.grad;
    $("c-corner").disabled = $("c-cornerdot").disabled = !S.cornerCustom;
    $("grad-rot").disabled = S.gradType === "radial";
    document.querySelectorAll("#dot-shapes .shape").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === S.dotType)));
    document.querySelectorAll("#corner-shapes .shape").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === S.cornerType)));
  }

  // ---------- Image ----------
  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) { toast(trad("Ce fichier n’est pas une image.")); return; }
    const r = new FileReader();
    r.onload = () => {
      // Convertit en PNG (max 600 px) : l’image est intégrée telle quelle, sans requête réseau
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 600, h = img.naturalHeight || 600;
        const k = Math.min(1, 600 / Math.max(w, h));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        try { image = c.toDataURL("image/png"); } catch (e) { image = r.result; }
        $("thumb").innerHTML = '<img alt="" src="' + image + '">';
        $("drop-txt").textContent = file.name;
        $("img-clear").hidden = false;
        if (S.ecl === "L" || S.ecl === "M") { S.ecl = "H"; syncUI(); toast(trad("Correction passée à H pour que le code reste lisible avec l’image.")); }
        render();
      };
      img.onerror = () => toast(trad("Impossible de lire cette image. Essaie un PNG ou un JPG."));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  $("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
  $("img-clear").addEventListener("click", () => {
    image = null; $("thumb").innerHTML = ""; $("file").value = "";
    $("drop-txt").textContent = trad("Aucune image. Glisse un logo ici ou choisis un fichier (PNG, JPG, SVG).");
    $("img-clear").hidden = true; render();
  });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) loadFile(item.getAsFile());
  });

  // ---------- Rendu ----------
  const CAP = { L: 2953, M: 2331, Q: 1663, H: 1273 }; // octets max (version 40, mode octet)
  const bytes = (s) => new TextEncoder().encode(s).length;

  function lum(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function options(data) {
    const color = S.dots;
    const gradient = S.grad ? { type: S.gradType, rotation: (S.gradRot * Math.PI) / 180, colorStops: [{ offset: 0, color: S.dots }, { offset: 1, color: S.dots2 }] } : undefined;
    const o = {
      width: S.size, height: S.size, type: "canvas", data, margin: S.margin,
      qrOptions: { errorCorrectionLevel: S.ecl },
      dotsOptions: { type: S.dotType, color },
      backgroundOptions: { color: S.bgT ? "rgba(0,0,0,0)" : S.bg },
      cornersSquareOptions: { type: S.cornerType, color: S.cornerCustom ? S.corner : color },
      cornersDotOptions: { type: S.cornerType === "dot" ? "dot" : "square", color: S.cornerCustom ? S.cornerDot : color },
      imageOptions: { saveAsBlob: false, margin: S.imgMargin, imageSize: S.imgSize, hideBackgroundDots: S.imgHide },
    };
    if (gradient) {
      o.dotsOptions.gradient = gradient;
      if (!S.cornerCustom) { o.cornersSquareOptions.gradient = gradient; o.cornersDotOptions.gradient = gradient; }
    }
    if (image) o.image = image;
    return o;
  }

  let qr = null, timer = 0;
  function render() { clearTimeout(timer); timer = setTimeout(draw, 60); }

  function draw() {
    save();
    $("export-out").hidden = true;
    const data = payload();
    const n = bytes(data);
    $("payload").textContent = data || "—";
    $("sp-len").textContent = trad("{n} o", { n });
    const notes = [];
    const box = $("qr");

    if (typeof QRCodeStyling === "undefined") {
      box.innerHTML = '<div class="err">' + trad("La bibliothèque QR n’a pas pu se charger. Vérifie ta connexion puis recharge la page.") + "</div>";
      return;
    }
    if (!data) {
      qr = null; box.innerHTML = '<div class="err">' + trad("Remplis le contenu pour générer le code.") + "</div>";
      $("sp-ver").textContent = $("sp-mod").textContent = "–"; $("notes").innerHTML = ""; return;
    }
    if (n > CAP[S.ecl]) {
      qr = null;
      box.innerHTML = `<div class="err">${trad("Trop de données : {n} octets pour {max} au maximum en correction {ecl}. Raccourcis le texte ou baisse la correction.", { n, max: CAP[S.ecl], ecl: S.ecl })}</div>`;
      $("sp-ver").textContent = $("sp-mod").textContent = "–"; $("notes").innerHTML = ""; return;
    }
    try {
      qr = new QRCodeStyling(options(data));
      box.innerHTML = "";
      qr.append(box);
    } catch (e) {
      qr = null; box.innerHTML = '<div class="err">' + esc(trad("Impossible de générer ce code : {erreur}", { erreur: e.message || e })) + "</div>"; return;
    }

    let mods = 0;
    try { mods = qr._qr.getModuleCount(); } catch (e) {}
    $("sp-ver").textContent = mods ? String((mods - 17) / 4) : "–";
    $("sp-mod").textContent = mods ? mods + "×" + mods : "–";

    const bgHex = S.bgT ? "#ffffff" : S.bg;
    const L1 = lum(S.dots), L2 = lum(bgHex);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3) notes.push(["bad", trad("Contraste faible entre le motif et le fond : beaucoup de téléphones n’arriveront pas à le lire.")]);
    if (L1 > L2) notes.push(["", trad("Motif plus clair que le fond : certains lecteurs ne lisent pas les codes inversés.")]);
    if (S.bgT) notes.push(["", trad("Fond transparent : place le code sur une surface claire et unie.")]);
    if (image && S.imgSize > 0.4 && S.ecl !== "H") notes.push(["bad", trad("Image grande avec une correction faible : passe en H ou réduis l’image.")]);
    else if (image && (S.ecl === "L" || S.ecl === "M")) notes.push(["", trad("Avec une image, une correction Q ou H est plus sûre.")]);
    if (S.margin < 16) notes.push(["", trad("Marge très fine : laisse de l’espace blanc autour du code à l’impression.")]);
    if (mods > 57) notes.push(["", trad("Code dense ({m}×{m}) : imprime-le à au moins {cm} cm de côté.", { m: mods, cm: Math.ceil(mods * 0.5 / 10) })]);
    $("notes").innerHTML = notes.map(([k, t]) => `<div class="note ${k}">${t}</div>`).join("");
  }

  // ---------- Export ----------
  let lastBlob = null, lastUrl = null;
  $("export").addEventListener("click", async () => {
    if (!qr) { toast(trad("Aucun code à exporter.")); return; }
    const fmt = $("fmt").value;
    try {
      const blob = await qr.getRawData(fmt);
      lastBlob = blob;
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(blob);
      $("export-img").src = lastUrl;
      $("export-out").hidden = false;
      $("copy-svg").hidden = fmt !== "svg";
      $("copy-img").hidden = fmt === "svg";
      $("dl").hidden = !standalone;
      $("dl").dataset.ext = fmt === "jpeg" ? "jpg" : fmt;
      toast(trad("Export {fmt} prêt ({t}×{t} px).", { fmt: fmt.toUpperCase(), t: S.size }));
    } catch (e) { toast(trad("L’export a échoué : {erreur}", { erreur: e.message || e })); }
  });
  $("dl").addEventListener("click", () => {
    if (!lastUrl) return;
    const a = document.createElement("a");
    a.href = lastUrl; a.download = "librerr-qr." + ($("dl").dataset.ext || "png");
    document.body.appendChild(a); a.click(); a.remove();
  });
  $("copy-img").addEventListener("click", async () => {
    try {
      const png = $("fmt").value === "png" ? lastBlob : await qr.getRawData("png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast(trad("Image copiée dans le presse-papiers."));
    } catch (e) { toast(trad("La copie d’image est bloquée ici. Utilise clic droit › Copier l’image.")); }
  });
  $("copy-svg").addEventListener("click", async () => {
    try { const t = await lastBlob.text(); await navigator.clipboard.writeText(t); toast(trad("Code SVG copié.")); }
    catch (e) { toast(trad("Copie refusée par le navigateur.")); }
  });
  $("copy-payload").addEventListener("click", () => {
    const text = payload();
    navigator.clipboard.writeText(text).then(() => toast(trad("Texte encodé copié.")), () => {
      const r = document.createRange(); r.selectNodeContents($("payload"));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast(trad("Texte sélectionné : fais Cmd/Ctrl + C."));
    });
  });
  $("reset").addEventListener("click", () => { S = Object.assign({}, DEFAULTS); syncUI(); render(); toast(trad("Style réinitialisé.")); });

  let tt = 0;
  function toast(t) { $("toast").textContent = t; clearTimeout(tt); tt = setTimeout(() => ($("toast").textContent = ""), 4000); }

  // Toute modification de contenu redessine
  document.querySelectorAll("[data-pane] input, [data-pane] textarea, [data-pane] select").forEach((el) => {
    el.addEventListener("input", render); el.addEventListener("change", render);
  });

  syncUI();
  const h = location.hash.replace("#", "");
  setTab(TABS.includes(h) ? h : "lien", true);
})();
