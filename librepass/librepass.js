/* SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit — voir LICENSE */
(function () {
  const WORDS = [...new Set(`abeille abricot acier action affiche agenda aigle aile aimant album alerte allure alpage amande ambre ami ancre angle anneau antenne arbre arcade argent armoire arome atelier atlas aube auberge aurore autruche avenue avion azur badge bagage baguette baie balade balcon baleine ballon bambou banane banc bande banque barque bassin bateau baume bijou biscuit bison blason bleuet bocal bois boisson bonbon bonnet bordure bouche bougie boussole bouton branche brebis brioche brique brise brume bureau buisson cabane cacao cactus cadeau cadran cahier caillou calme camion campagne canal canard canoe capitaine caramel carnet carotte carte cascade casque castor cerise chalet chameau champ chanson chapeau charbon chariot chat chateau chemin cheval chocolat ciel cigale cinema cirque citron clairon clavier clef cloche clocher coccinelle colline comete compas concert corail corde cornet costume coton couleur coupole courage crayon creme crepe cristal croissant cuivre cygne dauphin dentelle desert diamant domino dragon drapeau dune echelle eclair ecorce ecureuil ecume element elephant emeraude encre energie enigme epice epopee escalier etoile etang facteur falaise famille fanfare farine fenetre ferme festin feuille fiole flamme fleur fleuve flocon foret fontaine fougere fourmi framboise fromage fusee galaxie galet gant garage gateau gazelle geant girafe glace glacier gland globe gomme gorille gouttes grain grenade grenier griffon grotte guitare hamac hamster harpe hautbois herisson hibou hirondelle horizon hotel huile ile image indigo insecte jardin jasmin jeton jongleur journal jungle kayak kiwi koala lagune lampe lanterne lapin laurier lavande legume lettre levier lezard liane licorne lierre limace lion livre loutre lucarne lumiere lune lutin machine magasin magie maison manege mangue manteau marche marin marmotte marron masque matin medaille melon mercure merle metal meteore miel miroir moineau montagne moulin mouton musique nacre narval navire neige nectar nuage oasis ocean olive ombre opale orage orange orchidee orgue ortie otarie ours outil palmier panda panier papillon parapluie parc pastel patin pelican pepite perle phare piano pigeon pinceau pirate piscine plage planete plume poivre pomme pont portail potager poulpe prairie prune puzzle pyramide quartz radeau radis raisin rameau ravin reglisse renard requin riviere robot rocher roseau rubis ruche sable safran sapin satellite saumon savane serpent silex singe sirop soleil sorbet source sourire stylo sucre sureau tableau tambour tapis tarte taupe theiere tigre tilleul timbre tisane tomate tonnerre tortue toucan tournesol train trefle tresor tribu trompette tulipe tunnel vague valise vallee vanille velours vent verger violon volcan voyage wagon yaourt zebre zephyr`.split(/\s+/).filter(Boolean))];
  // Dans les autres langues : mots anglais courts et faciles à taper sur tous les claviers
  const WORDS_EN = [...new Set(`acorn actor adobe advice airport album alley almond amber anchor angel ankle answer anthem apple apricot apron arcade arch arena armor arrow artist ash atlas attic autumn avenue award axis badge bagel bakery balcony ball bamboo banana band banjo banner barn barrel basket beach beacon bean bear beaver bee beetle bell bench berry bicycle bike birch bird biscuit bison blanket blossom boat bonfire book boot bottle boulder bowl box bracelet branch bread breeze brick bridge brook broom bubble bucket buffalo bundle butter button cabin cactus cake camel camera camp canal candle candy canoe canyon cape captain caramel card carpet carrot castle cat cave cedar cello chair chalk channel cheese cherry chess chimney cider cinema circle circus city clam cliff clock cloud clover coast cobra cocoa coconut coffee comet compass copper coral cotton cougar country cowboy crab crane crayon creek cricket crown crystal cup curtain cushion cyclone daisy dancer deer desert diamond dinner dock dolphin domino donkey door dragon drawer dream drum duck dune eagle earth echo eclipse elbow elephant elm ember emerald engine falcon farm feather fence fern ferry festival fiddle field fig finch fire flag flame flute fog forest fork fossil fountain fox frog frost galaxy garden garlic gate gecko gem giant ginger giraffe glacier glass globe glove goat gold goose grape grass gravel guitar gull hammer harbor harp harvest hat hawk hazel heart hedge helmet heron hill hippo honey horizon horse hotel island ivory ivy jacket jaguar jam jar jasmine jelly jewel jungle kayak kettle key kite kitten koala ladder lagoon lake lamp lantern lark lava lawn leaf lemon leopard letter lily lime lion lizard llama lobster locket lotus lunch magnet mango maple marble market meadow melon meteor mill mint mirror mist mitten mole moon moose moss mountain mouse mug museum music nectar needle nest nickel night oak oasis ocean octopus olive onion orange orbit orchard orchid otter owl oyster paddle palace palm panda paper parade parrot pasta peach pear pebble pencil penguin pepper piano pickle pigeon pillow pilot pine pirate pizza planet plum pocket pond poppy potato prairie puzzle quartz quilt rabbit raccoon radio rain raven reef ribbon river robin robot rocket rose ruby saddle sail salmon sand saturn scarf school seal seed shadow shark shell ship shore silver singer skate sky sled snail snow soap sock sofa spark spider spoon spring squid star statue stone storm stream sugar summer sun swan table tea temple tent thunder tiger toast tomato topaz torch tower tractor trail train treasure tree tulip tunnel turtle umbrella valley vanilla velvet violet violin volcano wagon walnut walrus wave whale wheat whistle willow window winter wolf wood yacht yarn zebra zephyr`.split(/\s+/).filter(Boolean))];
  const LISTE = LANG === "fr" ? WORDS : WORDS_EN;
  $("wcount").textContent = LISTE.length;

  function randInt(n) {
    const max = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    let x; do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
    return x % n;
  }
  const pick = (arr) => arr[randInt(arr.length)];

  // ---------- Solidité ----------
  function crackTime(bits) {
    const sec = Math.pow(2, bits - 1) / 1e10;
    if (sec < 1) return trad("instantané");
    const Y = 31557600, years = sec / Y;
    if (years >= 1e9) return trad("des milliards d’années");
    if (years >= 1e6) return trad("{n} millions d’années", { n: nf(years / 1e6, 0) });
    const U = [["{n} an", "{n} ans", Y], ["{n} jour", "{n} jours", 86400], ["{n} heure", "{n} heures", 3600], ["{n} minute", "{n} minutes", 60], ["{n} seconde", "{n} secondes", 1]];
    for (const [un, plusieurs, s] of U) if (sec >= s) {
      const v = Math.floor(sec / s);
      return tradn(v, un, plusieurs, { n: nf(v, 0) });
    }
    return trad("instantané");
  }
  function level(bits) {
    if (bits < 36) return [trad("Faible"), "bad"];
    if (bits < 60) return [trad("Moyen"), "warn"];
    if (bits < 80) return [trad("Fort"), "good"];
    return [trad("Très fort"), "good"];
  }
  function card(value, bits) {
    const [lab, cls] = level(bits);
    return `<div class="pw"><div class="pw-top"><div class="pw-val">${esc(value)}</div><button class="iconbtn" data-copy="${esc(value)}" aria-label="${trad("Copier")}" title="${trad("Copier")}">⧉</button></div>
      <div class="pw-meta"><span class="chip ${cls}">${lab}</span><div class="meter ${cls}"><i style="width:${Math.min(100, bits / 1.28)}%"></i></div>
      <span class="mono">${tradn(Math.round(bits), "{n} bit", "{n} bits")}</span><span>${esc(trad("Pour le deviner : {temps}", { temps: crackTime(bits) }))}</span></div></div>`;
  }

  // ---------- Mot de passe ----------
  const SETS = { upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", digits: "0123456789" };
  const AMBIG = /[lI1O0o|`'"]/g;
  function genPassword() {
    const len = +$("len").value;
    const groups = [];
    if ($("o-upper").checked) groups.push(SETS.upper);
    if ($("o-lower").checked) groups.push(SETS.lower);
    if ($("o-digits").checked) groups.push(SETS.digits);
    if ($("o-symbols").checked && $("o-symset").value) groups.push([...new Set($("o-symset").value.replace(/\s/g, ""))].join(""));
    let g = groups.map((s) => ($("o-ambig").checked ? s.replace(AMBIG, "") : s)).filter(Boolean);
    if (!g.length) return null;
    const pool = [...new Set(g.join(""))];
    let pw;
    for (let tries = 0; tries < 200; tries++) {
      pw = Array.from({ length: len }, () => pick(pool)).join("");
      if (!$("o-each").checked || len < g.length || g.every((s) => [...pw].some((c) => s.includes(c)))) break;
    }
    return { value: pw, bits: len * Math.log2(pool.length) };
  }

  // ---------- Phrase de passe ----------
  function genPhrase() {
    const n = +$("words").value, sep = $("sep").value;
    let w = Array.from({ length: n }, () => pick(LISTE));
    if ($("cap").checked) w = w.map((x) => x[0].toUpperCase() + x.slice(1));
    let bits = n * Math.log2(LISTE.length);
    if ($("num").checked) { const i = randInt(n); w[i] = w[i] + randInt(100); bits += Math.log2(100) + Math.log2(n); }
    return { value: w.join(sep), bits };
  }

  let mode = "motdepasse";
  function generate() {
    const out = [];
    for (let i = 0; i < +$("count").value; i++) {
      const r = mode === "phrase" ? genPhrase() : genPassword();
      if (!r) { $("list").innerHTML = '<div class="empty">' + trad("Coche au moins un type de caractères.") + "</div>"; return; }
      out.push(card(r.value, r.bits));
    }
    $("list").innerHTML = out.join("");
  }
  $("list").addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copyText(b.dataset.copy, b.previousElementSibling); });
  $("regen").addEventListener("click", generate);
  $("count").addEventListener("change", generate);

  function syncOut() { $("len-o").textContent = $("len").value; $("words-o").textContent = $("words").value; }
  ["len", "o-upper", "o-lower", "o-digits", "o-symbols", "o-ambig", "o-each", "o-symset", "words", "sep", "cap", "num"].forEach((id) =>
    $(id).addEventListener("input", () => { syncOut(); generate(); }));

  // ---------- Tester ----------
  const COMMON = ["123456", "123456789", "12345678", "password", "motdepasse", "azerty", "azertyuiop", "qwerty", "000000", "111111", "123123", "soleil", "doudou", "loulou", "marseille", "chouchou", "nicolas", "jetaime", "bonjour", "football", "princesse", "iloveyou", "admin", "dragon", "monkey", "sunshine", "abc123", "coucou", "camille", "julien", "thomas", "chocolat", "pokemon", "anthony", "doudou", "liverpool", "letmein", "welcome", "master", "superman", "batman"];
  const SEQS = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "azertyuiop", "qsdfghjklm", "wxcvbn", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  function analyse(p) {
    const tips = [];
    if (!p) return null;
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26;
    if (/[A-Z]/.test(p)) pool += 26;
    if (/\d/.test(p)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(p)) pool += 33;
    let bits = p.length * Math.log2(Math.max(pool, 2));
    const low = p.toLowerCase();
    const core = low.replace(/[^a-z]/g, "");
    if (COMMON.includes(low) || COMMON.includes(core)) { bits = Math.min(bits, 10); tips.push(trad("C’est l’un des mots de passe les plus utilisés au monde : il est testé en premier.")); }
    else if (COMMON.some((c) => c.length >= 5 && low.includes(c))) { bits -= 18; tips.push(trad("Il contient un mot de passe très courant.")); }
    if (/(.)\1{2,}/.test(p)) { bits -= 8; tips.push(trad("Évite les caractères répétés (aaa, 111).")); }
    for (const s of SEQS) for (let i = 0; i + 4 <= s.length; i++) if (low.includes(s.slice(i, i + 4))) { bits -= 10; tips.push(trad("Évite les suites du clavier ou de l’alphabet (azer, 1234).")); i = s.length; break; }
    if (/(19|20)\d{2}/.test(p)) { bits -= 6; tips.push(trad("Une année (2024, 1999) est facile à deviner.")); }
    if (/^[A-Z][a-z]+\d+[^a-zA-Z0-9]?$/.test(p)) { bits -= 10; tips.push(trad("Le schéma « Mot + chiffres + symbole » est le premier que les pirates essaient.")); }
    if (p.length < 12) tips.push(trad("Vise au moins 12 caractères, ou une phrase de 4 mots."));
    if (pool < 60 && p.length < 16) tips.push(trad("Mélange majuscules, minuscules, chiffres et symboles."));
    bits = Math.max(0, bits);
    return { bits, tips: [...new Set(tips)], pool };
  }
  function test() {
    const p = $("test").value, r = analyse(p);
    if (!r) { $("verdict").innerHTML = '<div class="empty">' + trad("Tape un mot de passe pour voir sa solidité.") + "</div>"; return; }
    const [lab, cls] = level(r.bits);
    $("verdict").innerHTML = `
      <div class="row" style="gap:12px"><span class="chip ${cls}" style="font-size:14px;padding:6px 14px">${lab}</span><span class="mono">${trad("{n} bits estimés", { n: Math.round(r.bits) })}</span></div>
      <div class="meter ${cls}"><i style="width:${Math.min(100, r.bits / 1.28)}%"></i></div>
      <dl class="kv"><dt>${trad("Longueur")}</dt><dd>${tradn([...p].length, "{n} caractère", "{n} caractères")}</dd><dt>${trad("Pour le deviner")}</dt><dd>${crackTime(r.bits)}</dd></dl>
      ${r.tips.length ? '<h2>' + trad("À améliorer") + '</h2><ul class="advice">' + r.tips.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" : '<p class="hint" style="margin:0">' + trad("Rien à redire : garde-le pour un seul site.") + "</p>"}`;
  }
  $("test").addEventListener("input", test);
  $("show").addEventListener("click", () => { const t = $("test"); const v = t.type === "password"; t.type = v ? "text" : "password"; $("show").textContent = v ? trad("Masquer") : trad("Afficher"); });

  // L’onglet « tester » masque la liste générée
  setupTabs($("tabs"), (name) => {
    $("gen-section").hidden = name === "tester";
    if (name !== "tester") { mode = name; generate(); } else test();
  });
  syncOut();
})();
