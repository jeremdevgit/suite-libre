/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
(function () {
  enableDownloads();
  const KEY = "librenotes-v1";
  const EXAMPLE = () => ({
    example: true, title: trad("Semestre 3 (exemple)"), target: 10,
    ues: [
      { name: trad("Économie"), coef: 3, evals: [{ name: trad("Contrôle continu 1"), note: "14", sur: "20", coef: "1" }, { name: trad("Contrôle continu 2"), note: nf(8.5, 1), sur: "20", coef: "1" }, { name: trad("Partiel"), note: "", sur: "20", coef: "2" }] },
      { name: trad("Statistiques"), coef: 2, evals: [{ name: trad("TD"), note: "16", sur: "20", coef: "1" }, { name: trad("Examen"), note: "7", sur: "20", coef: "2" }] },
      { name: trad("Anglais"), coef: 1, evals: [{ name: trad("Oral"), note: "15", sur: "20", coef: "1" }, { name: trad("Écrit"), note: "", sur: "20", coef: "1" }] },
    ],
  });
  let S = loadPref(KEY, null) || EXAMPLE();
  const save = () => savePref(KEY, S);
  const blankUE = () => ({ name: "", coef: 1, evals: [{ name: "", note: "", sur: "20", coef: "1" }] });

  // ---------- Calcul ----------
  // x = note (sur 20) supposée pour chaque évaluation sans note ; null = les ignorer
  function ueAvg(ue, x) {
    let s = 0, c = 0;
    for (const e of ue.evals) {
      const k = parseNum(e.coef), sur = parseNum(e.sur) || 20;
      if (!k || k <= 0) continue;
      let n = parseNum(e.note);
      if (n == null) { if (x == null) continue; n = (x * sur) / 20; }
      s += k * (n / sur) * 20; c += k;
    }
    return c ? s / c : null;
  }
  function overall(x) {
    let s = 0, c = 0;
    for (const ue of S.ues) {
      const k = parseNum(ue.coef), a = ueAvg(ue, x);
      if (!k || k <= 0 || a == null) continue;
      s += k * a; c += k;
    }
    return c ? s / c : null;
  }
  const pending = () => S.ues.flatMap((u) => u.evals.filter((e) => parseNum(e.note) == null && parseNum(e.coef) > 0));
  function mention(a) {
    if (a >= 16) return [trad("Très bien"), "good"]; if (a >= 14) return [trad("Bien"), "good"]; if (a >= 12) return [trad("Assez bien"), "good"];
    if (a >= 10) return [trad("Passable"), "good"]; return [trad("Non validé"), "bad"];
  }
  const fmt = (v) => (v == null ? "–" : nf(v, 2));

  // ---------- Affichage des matières ----------
  function evRow(ui, ei, e) {
    return `<div class="ev" data-u="${ui}" data-e="${ei}">
      <input type="text" data-f="name" value="${esc(e.name)}" placeholder="${trad("Évaluation")}" aria-label="${trad("Nom de l’évaluation")}">
      <input type="text" data-f="note" value="${esc(e.note)}" inputmode="decimal" placeholder="${trad("à venir")}" aria-label="${trad("Note")}">
      <input type="text" data-f="sur" value="${esc(e.sur)}" inputmode="decimal" aria-label="${trad("Note sur")}">
      <input type="text" data-f="coef" value="${esc(e.coef)}" inputmode="decimal" aria-label="${trad("Coefficient")}">
      <button class="iconbtn" data-del-ev aria-label="${trad("Supprimer l’évaluation")}" title="${trad("Supprimer")}">×</button>
      <div class="need" data-need></div></div>`;
  }
  function renderUEs() {
    $("title").value = S.title || "";
    $("example").hidden = !S.example;
    $("reset").hidden = !!S.example;
    $("ues").innerHTML = S.ues.length ? S.ues.map((ue, ui) => `
      <div class="ue" data-u="${ui}">
        <div class="ue-head">
          <label class="f"><span>${trad("Matière")}</span><input type="text" data-uf="name" value="${esc(ue.name)}" placeholder="${trad("Nom de la matière")}"></label>
          <label class="f"><span>${trad("Coefficient")}</span><input type="text" data-uf="coef" value="${esc(ue.coef)}" inputmode="decimal"></label>
          <div class="avg" data-avg></div>
          <button class="iconbtn" data-del-ue aria-label="${trad("Supprimer la matière")}" title="${trad("Supprimer la matière")}" style="margin-bottom:4px">×</button>
        </div>
        <div class="ev ev-labels"><span>${trad("Évaluation")}</span><span>${trad("Note")}</span><span>${trad("Sur")}</span><span>${trad("Coef.")}</span><span></span></div>
        ${ue.evals.map((e, ei) => evRow(ui, ei, e)).join("")}
        <button class="btn small add" data-add-ev>${trad("+ Évaluation")}</button>
      </div>`).join("") : '<div class="empty">' + trad("Aucune matière. Ajoute ta première matière pour commencer.") + "</div>";
    compute();
  }

  // ---------- Résumé ----------
  function compute() {
    $("target-o").textContent = nf(S.target, 1);
    $("target").value = S.target;
    const now = overall(null), pend = pending();
    $("avg").textContent = fmt(now);
    let st = "";
    if (now == null) st = '<span class="chip">' + trad("Pas encore de note") + "</span>";
    else {
      const [m, cls] = mention(now);
      st = `<span class="chip ${cls}">${now >= 10 ? trad("Validé") : trad("Non validé")}</span>` + (now >= 10 ? `<span class="chip">${m}</span>` : "");
      if (pend.length) st += '<span class="chip warn">' + trad("Provisoire") + "</span>";
    }
    $("status").innerHTML = st;
    const nEv = S.ues.reduce((a, u) => a + u.evals.length, 0);
    $("facts").innerHTML = `<dt>${trad("Matières")}</dt><dd>${S.ues.length}</dd><dt>${trad("Évaluations notées")}</dt><dd>${nEv - pend.length} / ${nEv}</dd>`;

    // Moyenne par matière
    document.querySelectorAll(".ue").forEach((el) => {
      const ue = S.ues[+el.dataset.u], a = ueAvg(ue, null);
      el.querySelector("[data-avg]").innerHTML = `${fmt(a)} <small>/ 20</small>`;
    });

    // Note nécessaire, la même sur chaque évaluation à venir
    let msg = "";
    document.querySelectorAll("[data-need]").forEach((n) => (n.textContent = ""));
    if (!pend.length) msg = now == null ? "" : `<p class="hint" style="margin:0">${trad("Toutes les notes sont saisies : ta moyenne finale est de <b>{moy}</b>.", { moy: fmt(now) })}</p>`;
    else {
      const f0 = overall(0), f20 = overall(20);
      const x = (S.target - f0) / ((f20 - f0) / 20);
      if (f20 < S.target) msg = `<div class="note bad">${trad("Même avec 20/20 partout, la moyenne plafonne à {max}. L’objectif de {obj} n’est plus atteignable.", { max: fmt(f20), obj: nf(S.target, 1) })}</div>`;
      else if (f0 >= S.target) msg = `<div class="note" style="background:var(--good-wash);color:var(--good)">${trad("Objectif déjà assuré : même avec 0 aux évaluations restantes, ta moyenne serait de {min}.", { min: fmt(f0) })}</div>`;
      else {
        msg = `<p style="margin:0">${tradn(pend.length, "Il te faut en moyenne <b class=\"mono\" style=\"font-size:20px\">{note} / 20</b> sur l’évaluation à venir.", "Il te faut en moyenne <b class=\"mono\" style=\"font-size:20px\">{note} / 20</b> sur les {n} évaluations à venir.", { note: nf(x, 2) })}</p>
          <p class="hint" style="margin:0">${trad("Fourchette possible : de {min} (tout à 0) à {max} (tout à 20).", { min: fmt(f0), max: fmt(f20) })}</p>`;
        document.querySelectorAll(".ev[data-e]").forEach((row) => {
          const e = S.ues[+row.dataset.u].evals[+row.dataset.e];
          if (parseNum(e.note) == null && parseNum(e.coef) > 0) {
            const sur = parseNum(e.sur) || 20;
            row.querySelector("[data-need]").textContent = trad("Il te faut {note} / {sur} à cette évaluation.", { note: nf((x * sur) / 20, 2), sur: nf(sur, 0) });
          }
        });
      }
    }
    $("need").innerHTML = msg || '<p class="hint" style="margin:0">' + trad("Ajoute des évaluations pour voir ce qu’il te faut.") + "</p>";
    save();
  }

  // ---------- Événements ----------
  function leaveExample() { if (S.example) { S.example = false; $("example").hidden = true; $("reset").hidden = false; } }
  $("ues").addEventListener("input", (e) => {
    const t = e.target, ueEl = t.closest(".ue"); if (!ueEl) return;
    const ue = S.ues[+ueEl.dataset.u];
    if (t.dataset.uf) ue[t.dataset.uf] = t.value;
    const row = t.closest(".ev[data-e]");
    if (row && t.dataset.f) ue.evals[+row.dataset.e][t.dataset.f] = t.value;
    leaveExample(); compute();
  });
  $("ues").addEventListener("click", (e) => {
    const ueEl = e.target.closest(".ue"); if (!ueEl) return;
    const ui = +ueEl.dataset.u;
    if (e.target.closest("[data-del-ue]")) S.ues.splice(ui, 1);
    else if (e.target.closest("[data-del-ev]")) S.ues[ui].evals.splice(+e.target.closest(".ev").dataset.e, 1);
    else if (e.target.closest("[data-add-ev]")) S.ues[ui].evals.push({ name: "", note: "", sur: "20", coef: "1" });
    else return;
    leaveExample(); renderUEs();
  });
  $("add-ue").addEventListener("click", () => { S.ues.push(blankUE()); leaveExample(); renderUEs(); const all = document.querySelectorAll('.ue [data-uf="name"]'); all[all.length - 1]?.focus(); });
  $("title").addEventListener("input", () => { S.title = $("title").value; save(); });
  $("target").addEventListener("input", () => { S.target = +$("target").value; compute(); });
  $("start").addEventListener("click", () => { S = { example: false, title: trad("Mon semestre"), target: S.target, ues: [blankUE()] }; renderUEs(); });
  $("reset").addEventListener("click", () => { S = EXAMPLE(); renderUEs(); toast(trad("Exemple rechargé.")); });

  $("export").addEventListener("click", async () => {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [[trad("Matière"), trad("Coef. matière"), trad("Évaluation"), trad("Note"), trad("Sur"), trad("Coef.")].map(q).join(";")];
    S.ues.forEach((u) => u.evals.forEach((e) => lines.push([u.name, u.coef, e.name, e.note, e.sur, e.coef].map(q).join(";"))));
    lines.push("", [q(trad("Moyenne générale")), q(fmt(overall(null)))].join(";"));
    const csv = "﻿" + lines.join("\r\n");
    const name = (S.title || "notes").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-") + ".csv";
    if (!canSave()) { copyText(csv.slice(1)); toast(trad("Téléchargement indisponible ici : le CSV a été copié.")); return; }
    try { const s = await saveFile(name, csv); if (s === "saved") toast(trad("CSV enregistré.")); } catch (err) { toast(saveErrorText(err)); }
  });

  renderUEs();
})();
