/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
// LibreMedias : onglets et passage d'une image d'un outil à l'autre
(function () {
  const LM = (window.LM = window.LM || { hooks: {}, tabListeners: [] });
  LM.show = setupTabs($("ptabs"), (tab) => LM.tabListeners.forEach((f) => f(tab)));
})();
