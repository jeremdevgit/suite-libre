/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
(function () {
  // ---------- Unités ----------
  const U = {
    "Longueur": [["mm", "millimètre", 1e-3], ["cm", "centimètre", 1e-2], ["m", "mètre", 1], ["km", "kilomètre", 1e3], ["in", "pouce", 0.0254], ["ft", "pied", 0.3048], ["yd", "yard", 0.9144], ["mi", "mile", 1609.344], ["nmi", "mille marin", 1852]],
    "Masse": [["mg", "milligramme", 1e-6], ["g", "gramme", 1e-3], ["kg", "kilogramme", 1], ["t", "tonne", 1e3], ["oz", "once", 0.028349523125], ["lb", "livre (lb)", 0.45359237], ["st", "stone", 6.35029318]],
    "Température": [["°C", "degré Celsius"], ["°F", "degré Fahrenheit"], ["K", "kelvin"]],
    "Volume": [["mL", "millilitre", 1e-3], ["cL", "centilitre", 1e-2], ["L", "litre", 1], ["m³", "mètre cube", 1e3], ["c. à café", "cuillère à café", 0.005], ["c. à soupe", "cuillère à soupe", 0.015], ["tasse", "tasse (US)", 0.2365882365], ["gal", "gallon US", 3.785411784], ["fl oz", "once liquide US", 0.0295735295625]],
    "Surface": [["cm²", "centimètre carré", 1e-4], ["m²", "mètre carré", 1], ["a", "are", 100], ["ha", "hectare", 1e4], ["km²", "kilomètre carré", 1e6], ["ft²", "pied carré", 0.09290304], ["acre", "acre", 4046.8564224]],
    "Vitesse": [["m/s", "mètre par seconde", 1], ["km/h", "kilomètre par heure", 1 / 3.6], ["mph", "mile par heure", 0.44704], ["nœud", "nœud", 1852 / 3600]],
    "Données": [["bit", "bit", 0.125], ["o", "octet", 1], ["Ko", "kilooctet", 1e3], ["Mo", "mégaoctet", 1e6], ["Go", "gigaoctet", 1e9], ["To", "téraoctet", 1e12], ["Kio", "kibioctet", 1024], ["Mio", "mébioctet", 1048576], ["Gio", "gibioctet", 1073741824], ["Tio", "tébioctet", 1099511627776], ["Mbit", "mégabit", 125000]],
    "Durée": [["ms", "milliseconde", 1e-3], ["s", "seconde", 1], ["min", "minute", 60], ["h", "heure", 3600], ["j", "jour", 86400], ["sem.", "semaine", 604800], ["mois", "mois (moyen)", 2629746], ["an", "année", 31556952]],
    "Énergie": [["J", "joule", 1], ["kJ", "kilojoule", 1e3], ["cal", "calorie", 4.184], ["kcal", "kilocalorie", 4184], ["Wh", "wattheure", 3600], ["kWh", "kilowattheure", 3.6e6]],
    "Pression": [["Pa", "pascal", 1], ["hPa", "hectopascal", 100], ["bar", "bar", 1e5], ["atm", "atmosphère", 101325], ["psi", "psi", 6894.757293168], ["mmHg", "millimètre de mercure", 133.322387415]],
  };
  const DEF = { "Longueur": ["km", "mi"], "Masse": ["kg", "lb"], "Température": ["°C", "°F"], "Volume": ["L", "gal"], "Surface": ["m²", "ft²"], "Vitesse": ["km/h", "mph"], "Données": ["Go", "Gio"], "Durée": ["h", "min"], "Énergie": ["kcal", "kJ"], "Pression": ["bar", "psi"] };
  const toK = { "°C": (v) => v + 273.15, "°F": (v) => (v - 32) * 5 / 9 + 273.15, "K": (v) => v };
  const fromK = { "°C": (v) => v - 273.15, "°F": (v) => (v - 273.15) * 9 / 5 + 32, "K": (v) => v };
  let cat = loadPref("libreconvert-cat", "Longueur");
  if (!U[cat]) cat = "Longueur";

  // Séparateur décimal de la langue choisie
  const DEC = new Intl.NumberFormat(LOCALE).format(1.5).charAt(1);
  // Symboles d'unité propres à chaque langue (Mo → MB…) ; les autres restent identiques
  const sym = (u) => trad(u);
  const num = (v) => {
    if (!isFinite(v)) return "–";
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-6 || a >= 1e15)) return v.toExponential(6).replace(/\.?0+e/, "e").replace(".", DEC);
    return new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 12 }).format(v);
  };
  function conv(v, from, to) {
    if (cat === "Température") return fromK[to](toK[from](v));
    const f = U[cat].find((u) => u[0] === from)[2], t = U[cat].find((u) => u[0] === to)[2];
    return (v * f) / t;
  }
  function fillUnits() {
    $("cats").innerHTML = Object.keys(U).map((c) => `<button class="cat" data-c="${c}" aria-pressed="${c === cat}">${esc(trad(c))}</button>`).join("");
    const opts = U[cat].map((u) => `<option value="${esc(u[0])}">${esc(trad(u[1]))} (${esc(sym(u[0]))})</option>`).join("");
    $("u-from").innerHTML = opts; $("u-to").innerHTML = opts;
    $("u-from").value = DEF[cat][0]; $("u-to").value = DEF[cat][1];
    updUnits();
  }
  function updUnits() {
    const v = parseNum($("u-val").value), from = $("u-from").value, to = $("u-to").value;
    if (v == null) { $("u-out").textContent = "–"; $("u-all").innerHTML = ""; $("u-formula").textContent = trad("Saisis un nombre."); return; }
    const r = conv(v, from, to);
    $("u-out").textContent = num(r) + " " + sym(to);
    $("u-formula").textContent = cat === "Température" ? "" : `1 ${sym(from)} = ${num(conv(1, from, to))} ${sym(to)}`;
    $("u-all").innerHTML = U[cat].map((u) => `<tr><td>${esc(trad(u[1]))}</td><td class="num">${num(conv(v, from, u[0]))}</td><td>${esc(sym(u[0]))}</td></tr>`).join("");
  }
  $("cats").addEventListener("click", (e) => { const b = e.target.closest(".cat"); if (!b) return; cat = b.dataset.c; savePref("libreconvert-cat", cat); fillUnits(); });
  ["u-val", "u-from", "u-to"].forEach((id) => $(id).addEventListener("input", updUnits));
  $("u-swap").addEventListener("click", () => { const a = $("u-from").value; $("u-from").value = $("u-to").value; $("u-to").value = a; updUnits(); });
  $("u-copy").addEventListener("click", () => copyText($("u-out").textContent, $("u-out")));
  fillUnits();

  // ---------- Dates ----------
  const DAY = 86400000;
  const iso = (d) => d.toISOString().slice(0, 10);
  const parseD = (s) => (s ? new Date(s + "T00:00:00Z") : null);
  const longDate = (d) => new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  const holCache = {};
  function holidays(y, am) {
    const key = y + (am ? "am" : ""); if (holCache[key]) return holCache[key];
    const e = easter(y), D = (m, d) => Date.UTC(y, m - 1, d);
    const list = [[D(1, 1), trad("Jour de l’An")], [e + DAY, trad("Lundi de Pâques")], [D(5, 1), trad("Fête du Travail")], [D(5, 8), trad("Victoire 1945")], [e + 39 * DAY, trad("Ascension")], [e + 50 * DAY, trad("Lundi de Pentecôte")], [D(7, 14), trad("Fête nationale")], [D(8, 15), trad("Assomption")], [D(11, 1), trad("Toussaint")], [D(11, 11), trad("Armistice 1918")], [D(12, 25), trad("Noël")]];
    if (am) list.push([e - 2 * DAY, trad("Vendredi saint")], [D(12, 26), trad("Saint-Étienne")]);
    return (holCache[key] = new Map(list));
  }
  const isHol = (t, am) => holidays(new Date(t).getUTCFullYear(), am).get(t);
  const isWorkday = (t, am) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6 && !isHol(t, am); };
  function calDiff(a, b) {
    let y = b.getUTCFullYear() - a.getUTCFullYear(), m = b.getUTCMonth() - a.getUTCMonth(), d = b.getUTCDate() - a.getUTCDate();
    if (d < 0) { m--; d += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate(); }
    if (m < 0) { y--; m += 12; }
    return [y, m, d];
  }
  // plural(3, "{n} jour", "{n} jours") : accord selon la langue
  const plural = (n, un, plusieurs) => tradn(n, un, plusieurs, { n: nf(n, 0) });
  function updDiff() {
    let a = parseD($("d-a").value), b = parseD($("d-b").value);
    if (!a || !b) { $("d-res").innerHTML = '<div class="empty">' + trad("Choisis deux dates.") + "</div>"; $("d-hol").innerHTML = ""; return; }
    let sign = 1; if (b < a) { [a, b] = [b, a]; sign = -1; }
    const incl = $("d-incl").checked, am = $("d-am").checked;
    const end = b.getTime() + (incl ? DAY : 0);
    const days = Math.round((end - a.getTime()) / DAY);
    let work = 0, we = 0; const hol = [];
    for (let t = a.getTime(); t < end; t += DAY) {
      const w = new Date(t).getUTCDay(), h = isHol(t, am);
      if (w === 0 || w === 6) we++; else if (h) hol.push([t, h]); else work++;
      if (h && (w === 0 || w === 6)) hol.push([t, h, true]);
    }
    const [y, m, d] = calDiff(a, new Date(end));
    const tile = (big, label) => `<div class="tile"><span class="lab">${label}</span><span class="val">${big}</span></div>`;
    $("d-res").innerHTML = [
      tile(plural(days, "{n} jour", "{n} jours"), sign < 0 ? trad("Durée (dates inversées)") : trad("Durée")),
      tile(days % 7 ? trad("{semaines} et {jours}", { semaines: plural(Math.floor(days / 7), "{n} semaine", "{n} semaines"), jours: plural(days % 7, "{n} jour", "{n} jours") }) : plural(Math.floor(days / 7), "{n} semaine", "{n} semaines"), trad("En semaines")),
      tile([y && plural(y, "{n} an", "{n} ans"), m && plural(m, "{n} mois", "{n} mois"), d && plural(d, "{n} jour", "{n} jours")].filter(Boolean).join(", ") || plural(0, "{n} jour", "{n} jours"), trad("En calendrier")),
      tile(plural(work, "{n} jour ouvré", "{n} jours ouvrés"), trad("Du lundi au vendredi, hors fériés")),
      tile(plural(we, "{n} jour", "{n} jours"), trad("Week-ends")),
      tile(plural(hol.filter((h) => !h[2]).length, "{n} jour férié", "{n} jours fériés"), trad("En semaine")),
    ].join("");
    $("d-hol").innerHTML = hol.length ? '<table class="t"><tbody>' + hol.sort((p, q) => p[0] - q[0]).map(([t, n, we]) => `<tr><td>${longDate(new Date(t))}</td><td>${esc(we ? trad("{nom} (week-end)", { nom: n }) : n)}</td></tr>`).join("") + "</tbody></table>" : '<p class="hint" style="margin:0">' + trad("Aucun jour férié dans cette période.") + "</p>";
  }
  ["d-a", "d-b", "d-incl", "d-am"].forEach((id) => $(id).addEventListener("input", updDiff));

  let addSign = 1;
  function updAdd() {
    const d = parseD($("a-d").value), n = Math.trunc(parseNum($("a-n").value) ?? NaN), u = $("a-u").value;
    if (!d || !isFinite(n)) { $("a-out").textContent = ""; return; }
    const k = n * addSign, am = $("d-am").checked;
    let r = new Date(d);
    if (u === "d") r = new Date(d.getTime() + k * DAY);
    else if (u === "w") r = new Date(d.getTime() + 7 * k * DAY);
    else if (u === "m" || u === "y") {
      const months = u === "m" ? k : 12 * k, day = d.getUTCDate();
      r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
      const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
      r.setUTCDate(Math.min(day, last));
    } else {
      let t = d.getTime(), left = Math.abs(k), step = k < 0 ? -DAY : DAY;
      while (left > 0) { t += step; if (isWorkday(t, am)) left--; }
      r = new Date(t);
    }
    const h = isHol(r.getTime(), am), w = r.getUTCDay();
    $("a-out").innerHTML = esc(longDate(r)) + (h ? ` <span class="chip warn">${esc(h)}</span>` : w === 0 || w === 6 ? ' <span class="chip">' + trad("Week-end") + "</span>" : "");
  }
  ["a-d", "a-n", "a-u"].forEach((id) => $(id).addEventListener("input", updAdd));
  [$("a-plus"), $("a-minus")].forEach((b) => b.addEventListener("click", () => {
    addSign = +b.dataset.sign; $("a-plus").setAttribute("aria-pressed", addSign > 0); $("a-minus").setAttribute("aria-pressed", addSign < 0);
    $("a-plus").classList.toggle("primary", addSign > 0); $("a-minus").classList.toggle("primary", addSign < 0); updAdd();
  }));
  $("a-plus").classList.add("primary");
  $("d-am").addEventListener("input", updAdd);
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  $("d-a").value = iso(today);
  $("d-b").value = iso(new Date(Date.UTC(today.getUTCFullYear(), 11, 31)));
  $("a-d").value = iso(today);
  updDiff(); updAdd();

  // ---------- Fuseaux ----------
  let ALL = [];
  try { ALL = Intl.supportedValuesOf("timeZone"); } catch (e) {}
  const BASE = ["Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "Africa/Casablanca", "Africa/Dakar", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "Indian/Reunion", "America/Martinique", "Pacific/Tahiti", "UTC"];
  if (!ALL.length) ALL = BASE;
  if (!ALL.includes("UTC")) ALL = ALL.concat("UTC");
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  const cityName = (z) => (z === "UTC" ? trad("UTC (temps universel)") : z.split("/").pop().replace(/_/g, " "));
  const zoneOpts = (list) => list.map((z) => `<option value="${esc(z)}">${esc(cityName(z))} · ${esc(z)}</option>`).join("");
  $("z-from").innerHTML = zoneOpts(ALL); $("z-from").value = ALL.includes(local) ? local : "Europe/Paris";
  $("z-add").innerHTML = zoneOpts(ALL);
  let zones = loadPref("libreconvert-zones", ["Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Indian/Reunion"]);

  function partsIn(zone, t) {
    const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(t).forEach((x) => (p[x.type] = x.value));
    return p;
  }
  const offsetMin = (zone, t) => { const p = partsIn(zone, t); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60000; };
  function zonedToUtc(str, zone) {
    const [d, tm] = str.split("T"); const [y, mo, da] = d.split("-").map(Number); const [h, mi] = (tm || "00:00").split(":").map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    let t = guess - offsetMin(zone, guess) * 60000;
    t = guess - offsetMin(zone, t) * 60000;
    return t;
  }
  const fmtOff = (m) => "UTC" + (m >= 0 ? "+" : "−") + String(Math.floor(Math.abs(m) / 60)).padStart(2, "0") + ":" + String(Math.abs(m) % 60).padStart(2, "0");
  function updZones() {
    const v = $("z-dt").value; if (!v) return;
    const from = $("z-from").value, t = zonedToUtc(v, from);
    $("z-list").innerHTML = zones.map((z, i) => {
      const p = partsIn(z, t), off = offsetMin(z, t), h = +p.hour % 24;
      const dd = Date.UTC(+p.year, +p.month - 1, +p.day) - Date.UTC(...(() => { const s = partsIn(from, t); return [+s.year, +s.month - 1, +s.day]; })());
      const shift = dd > 0 ? '<span class="chip">' + trad("+1 j") + "</span>" : dd < 0 ? '<span class="chip">' + trad("−1 j") + "</span>" : "";
      const day = new Intl.DateTimeFormat(LOCALE, { timeZone: z, weekday: "short", day: "numeric", month: "short" }).format(t);
      return `<div class="zone"><div class="city">${esc(cityName(z))}<small>${esc(z)} · ${fmtOff(off)}</small></div>
        <div class="time">${String(h).padStart(2, "0")}:${p.minute}<small>${esc(day)} ${shift} ${h >= 7 && h < 22 ? "" : "· " + trad("nuit")}</small></div>
        <button class="iconbtn" data-rmz="${i}" aria-label="${esc(trad("Retirer {ville}", { ville: cityName(z) }))}" title="${trad("Retirer")}">×</button></div>`;
    }).join("") || '<div class="empty">' + trad("Ajoute un fuseau ci-dessous.") + "</div>";
  }
  function setNow() { const n = new Date(); const p = partsIn($("z-from").value, n.getTime()); $("z-dt").value = `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, "0")}:${p.minute}`; updZones(); }
  ["z-dt", "z-from"].forEach((id) => $(id).addEventListener("input", updZones));
  $("z-now").addEventListener("click", setNow);
  $("z-add-btn").addEventListener("click", () => { const z = $("z-add").value; if (!zones.includes(z)) { zones.push(z); savePref("libreconvert-zones", zones); } updZones(); });
  $("z-list").addEventListener("click", (e) => { const b = e.target.closest("[data-rmz]"); if (!b) return; zones.splice(+b.dataset.rmz, 1); savePref("libreconvert-zones", zones); updZones(); });
  setNow();

  // ---------- Bases ----------
  const DIG = "0123456789abcdefghijklmnopqrstuvwxyz";
  function parseBig(s, base) {
    s = s.trim().toLowerCase().replace(/[\s_]/g, "");
    let neg = false; if (s.startsWith("-")) { neg = true; s = s.slice(1); }
    if (base === 16) s = s.replace(/^0x/, ""); if (base === 2) s = s.replace(/^0b/, ""); if (base === 8) s = s.replace(/^0o/, "");
    if (!s) return null;
    let v = 0n; const B = BigInt(base);
    for (const c of s) { const d = DIG.indexOf(c); if (d < 0 || d >= base) return { bad: c }; v = v * B + BigInt(d); }
    return { v: neg ? -v : v };
  }
  const group = (s, n, sep) => s.replace(new RegExp(`\\B(?=(.{${n}})+$)`, "g"), sep);
  function updBases() {
    const base = +$("b-base").value, r = parseBig($("b-val").value, base);
    if (!r) { $("b-out").innerHTML = '<div class="empty">' + trad("Saisis un nombre entier.") + "</div>"; return; }
    if (r.bad) { $("b-out").innerHTML = `<div class="note bad">${esc(trad("« {c} » n’existe pas en base {base}.", { c: r.bad, base }))}</div>`; return; }
    const v = r.v, neg = v < 0n, a = neg ? -v : v, sg = neg ? "−" : "";
    const rows = [[trad("Décimal (10)"), group(a.toString(10), 3, " ")], [trad("Binaire (2)"), group(a.toString(2), 4, " ")], [trad("Octal (8)"), a.toString(8)], [trad("Hexadécimal (16)"), group(a.toString(16).toUpperCase(), 2, " ")], [trad("Base 36"), a.toString(36).toUpperCase()]];
    const bits = a === 0n ? 1 : a.toString(2).length;
    $("b-out").innerHTML = rows.map(([l, s]) => `<div class="base"><span class="hint">${l}</span><span class="v">${sg}${s}</span><button class="iconbtn" data-cp="${esc(sg.replace("−", "-") + s.replace(/ /g, ""))}" aria-label="${trad("Copier")}" title="${trad("Copier")}">⧉</button></div>`).join("") +
      `<p class="hint" style="margin:0">${tradn(bits, "{n} bit", "{n} bits")} · ${bits <= 8 ? trad("tient sur 1 octet") : trad("{n} octets", { n: Math.ceil(bits / 8) })}</p>`;
  }
  ["b-val", "b-base"].forEach((id) => $(id).addEventListener("input", updBases));
  $("b-out").addEventListener("click", (e) => { const b = e.target.closest("[data-cp]"); if (b) copyText(b.dataset.cp, b.previousElementSibling); });
  updBases();

  setupTabs($("tabs"));
})();
