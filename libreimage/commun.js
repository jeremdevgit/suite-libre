/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// Outils communs à la suite Libre
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Hors de claude.ai (fichier téléchargé ou version serveur), les téléchargements directs fonctionnent
let standalone = false;
try { standalone = window.top === window.self; } catch (e) {}

let downloadsApi = null;
const saveListeners = [];
function canSave() { return standalone || !!downloadsApi; }
function onSaveReady(fn) { saveListeners.push(fn); fn(); }
function connectDownloads() {
  if (standalone || !window.claude || typeof window.claude.use !== "function") return;
  window.claude.use("downloads").then((d) => { downloadsApi = d; saveListeners.forEach((f) => f()); }).catch(() => {});
}
// À appeler par les outils qui proposent des fichiers à enregistrer
function enableDownloads() {
  connectDownloads();
  if (!standalone && !window.claude) window.addEventListener("load", connectDownloads, { once: true });
}

async function saveFile(filename, data) {
  if (standalone) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "saved";
  }
  if (!downloadsApi) throw { code: "unavailable" };
  const r = await downloadsApi.save({ filename, data });
  return r.status;
}
function saveErrorText(e) {
  const c = e && e.code;
  if (c === "declined") return "Téléchargement annulé.";
  if (c === "rate_limited") return "Une demande de téléchargement est déjà ouverte. Réessaie dans un instant.";
  if (c === "too_large") return "Fichier trop lourd pour être téléchargé ici.";
  return "Le téléchargement n’est pas disponible ici.";
}

let toastTimer = 0;
function toast(t) {
  const el = $("toast"); if (!el) return;
  el.textContent = t; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.textContent = ""), 4000);
}

async function copyText(text, selectEl) {
  try { await navigator.clipboard.writeText(text); toast("Copié."); return true; }
  catch (e) {
    if (selectEl) {
      const r = document.createRange(); r.selectNodeContents(selectEl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast("Texte sélectionné : fais Cmd/Ctrl + C.");
    } else toast("Copie refusée par le navigateur.");
    return false;
  }
}

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
function savePref(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

// Onglets avec ancre (#jeton)
function setupTabs(tabsEl, onChange) {
  const tabs = [...tabsEl.querySelectorAll(".tab")];
  const names = tabs.map((t) => t.dataset.tab);
  function show(name, fromHash) {
    if (!names.includes(name)) name = names[0];
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    document.querySelectorAll("[data-pane]").forEach((p) => { if (names.includes(p.dataset.pane)) p.hidden = p.dataset.pane !== name; });
    if (!fromHash) { try { history.replaceState(null, "", "#" + name); } catch (e) {} }
    if (onChange) onChange(name);
  }
  tabsEl.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) show(b.dataset.tab); });
  const h = location.hash.replace("#", "");
  show(names.includes(h) ? h : names[0], true);
  return show;
}

const nf = (n, d = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n);
const parseNum = (s) => { const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : null; };
