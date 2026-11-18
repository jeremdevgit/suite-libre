/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreMedias : onglets et passage d'une image d'un outil à l'autre
(function () {
  const LM = (window.LM = window.LM || { hooks: {}, tabListeners: [] });
  // Version en ligne : propose la version hors ligne (un seul fichier), comme les autres outils
  if (standalone && /^https?:$/.test(location.protocol)) $("dl-app").hidden = false;
  LM.show = setupTabs($("ptabs"), (tab) => LM.tabListeners.forEach((f) => f(tab)));
})();
