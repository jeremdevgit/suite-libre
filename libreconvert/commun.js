/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// Outils communs à la suite Libre
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Hors de claude.ai (fichier téléchargé ou version serveur), les téléchargements directs fonctionnent
let standalone = false;
try { standalone = window.top === window.self; } catch (e) {}

let toastTimer = 0;
function toast(t) {
  const el = $("toast"); if (!el) return;
  el.textContent = t; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.textContent = ""), 4000);
}

async function copyText(text, selectEl) {
  try { await navigator.clipboard.writeText(text); toast(trad("Copié.")); return true; }
  catch (e) {
    if (selectEl) {
      const r = document.createRange(); r.selectNodeContents(selectEl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast(trad("Texte sélectionné : fais Cmd/Ctrl + C."));
    } else toast(trad("Copie refusée par le navigateur."));
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

const nf = (n, d = 2) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d }).format(n);
const parseNum = (s) => { const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : null; };
