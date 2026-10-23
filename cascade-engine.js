/* Moteur de suppression en cascade et de correction des DONNÉES DE TEST — pur, sans DOM, commun aux applications.
   Une application le configure avec : ses types (collection, libellé), ses relations parent → enfant (clé étrangère, tableau ou fonction)
   et la manière de reconnaître une donnée « Test ». Règles de sécurité :
   - seul ce qui est marqué Test se supprime ; un enfant RÉEL (non marqué) d'une donnée Test BLOQUE la suppression (jamais supprimé par ricochet) ;
   - les relations de type « bloque » (simple référence, ex. un article cité dans une commande) ne sont jamais suivies : elles bloquent si l'autre côté n'est pas supprimé ;
   - tout ce qui est retiré est conservé dans un instantané (corbeille) qui permet de tout restaurer. */
(function (G) {
  "use strict";
  function moteur(cfg) {
    var T = cfg.types, R = cfg.relations || [], types = Object.keys(T);
    var chemin = function (S, c, creer) { var p = String(c).split("."), o = S, i; for (i = 0; i < p.length - 1; i++) { if (o[p[i]] == null || typeof o[p[i]] !== "object") { if (!creer) return null; o[p[i]] = {}; } o = o[p[i]]; } if (!o) return null; var k = p[p.length - 1]; if (!Array.isArray(o[k]) && creer) o[k] = []; return Array.isArray(o[k]) ? o[k] : null; };
    var col = function (S, t) { return chemin(S, T[t].col) || []; };
    var idDe = function (t, o) { return T[t].cle ? T[t].cle(o) : o.id; };
    var nom = function (t, o) { return T[t].nom ? String(T[t].nom(o, cfg.ctx) || "") : String(o.id || ""); };
    var trouver = function (S, t, id) { var a = col(S, t); for (var i = 0; i < a.length; i++) if (idDe(t, a[i]) === id) return a[i]; return null; };
    var estTest = function (S, t, o) { return !!cfg.estTest(S, t, o); };
    var noeud = function (t, o, via) { return { type: t, id: idDe(t, o), obj: o, via: via || null, libelle: nom(t, o) }; };
    /** relations dont `t` est le parent (le caractère « * » vaut pour tous les types) */
    var rel = function (t) { return R.filter(function (r) { return r.parent === t || r.parent === "*"; }); };
    function lies(S, r, p) { // enfants de `p` selon la relation r
      var out = [], a = col(S, r.child), pid = idDe(r.parentType || p.type, p.obj);
      for (var i = 0; i < a.length; i++) {
        var c = a[i], ok;
        if (r.match) ok = r.match(c, p.obj, p);
        else if (r.fkTab) ok = Array.isArray(c[r.fk]) && c[r.fk].indexOf(pid) >= 0;
        else ok = c[r.fk] != null && c[r.fk] !== "" && c[r.fk] === pid;
        if (ok) out.push(c);
      }
      return out;
    }
    /** Fermeture : { racine, enfants:[noeud], bloquants:[noeud+raison], cles:{type:Set} } — ignore le marquage (sert à marquer et à prévisualiser) */
    function dependances(S, type, id) {
      var root = trouver(S, type, id); if (!root) return null;
      var vus = {}, enfants = [], bloquants = [], file = [noeud(type, root)];
      vus[type + "|" + id] = 1;
      while (file.length) {
        var p = file.shift();
        rel(p.type).forEach(function (r) {
          if (r.parent === "*" && p.type === r.child) return;
          lies(S, r, p).forEach(function (c) {
            var k = r.child + "|" + idDe(r.child, c);
            if (r.bloque) { var b = noeud(r.child, c, p); b.raison = r.raison || "référence"; if (!bloquants.some(function (x) { return x.type === b.type && x.id === b.id; })) bloquants.push(b); return; }
            if (vus[k]) return; vus[k] = 1;
            var n = noeud(r.child, c, p); enfants.push(n); file.push(n);
          });
        });
      }
      // un bloquant qui est lui-même supprimé avec la racine n'est plus bloquant
      bloquants = bloquants.filter(function (b) { return !vus[b.type + "|" + b.id]; });
      return { racine: noeud(type, root), enfants: enfants, bloquants: bloquants };
    }
    /** Analyse pour suppression : OK seulement si la racine et TOUS ses enfants sont marqués Test et qu'aucune référence ne bloque */
    function analyser(S, type, id) {
      var d = dependances(S, type, id); if (!d) return null;
      var tous = [d.racine].concat(d.enfants), reels = tous.filter(function (n) { return !estTest(S, n.type, n.obj); });
      var par = {}; tous.forEach(function (n) { par[n.type] = (par[n.type] || 0) + 1; });
      return { racine: d.racine, enfants: d.enfants, tous: tous, reels: reels, bloquants: d.bloquants, par: par, ok: reels.length === 0 && d.bloquants.length === 0 };
    }
    function marquer(S, type, id) { // marque la racine et toutes ses dépendances ; renvoie le nombre de nouveaux marquages
      var d = dependances(S, type, id); if (!d) return 0; var n = 0;
      [d.racine].concat(d.enfants).forEach(function (x) { if (!estTest(S, x.type, x.obj)) { cfg.marquer(S, x.type, x.obj); n++; } });
      return n;
    }
    function demarquer(S, type, id) { var o = trouver(S, type, id); if (!o) return false; cfg.demarquer(S, type, o); return true; }
    /** Retire les nœuds des collections ; renvoie l'instantané restaurable */
    function retirer(S, noeuds) {
      var snap = { v: 1, le: new Date().toISOString(), items: [] };
      noeuds.forEach(function (n) {
        var a = chemin(S, T[n.type].col); if (!a) return;
        var i = a.indexOf(n.obj); if (i < 0) { for (i = 0; i < a.length; i++) if (idDe(n.type, a[i]) === n.id) break; if (i >= a.length) return; }
        snap.items.push({ t: n.type, i: i, o: JSON.parse(JSON.stringify(a[i])), test: estTest(S, n.type, a[i]) }); a.splice(i, 1);
        if (cfg.demarquer) cfg.demarquer(S, n.type, n.obj);
      });
      return snap;
    }
    /** Restaure un instantané : réinsère à la position d'origine (quand possible), ignore ce qui existe déjà ; renvoie le nombre restauré */
    function restaurer(S, snap) {
      if (!snap || !Array.isArray(snap.items)) throw new Error("Sauvegarde illisible");
      var n = 0, L = snap.items.slice().reverse();   /* on défait les retraits dans l'ordre inverse : chaque position était relative à la collection déjà amputée */
      L.forEach(function (x) {
        if (!T[x.t]) return; var a = chemin(S, T[x.t].col, true);
        if (trouver(S, x.t, idDe(x.t, x.o))) return;
        a.splice(Math.min(x.i, a.length), 0, x.o); if (x.test) cfg.marquer(S, x.t, x.o); n++;
      });
      return n;
    }
    /** Champs simples modifiables d'un enregistrement (texte, nombre, booléen) avec contrôle des clés étrangères */
    function champs(S, type, o) {
      var fkOf = {}; R.forEach(function (r) { if (r.child === type && r.fk && !r.fkTab && r.parent !== "*") fkOf[r.fk] = r.parent; });
      return Object.keys(o).filter(function (k) { return k !== "id" && (cfg.protege || []).indexOf(k) < 0 && (o[k] === null || ["string", "number", "boolean"].indexOf(typeof o[k]) >= 0); })
        .map(function (k) { return { k: k, v: o[k], t: typeof o[k] === "number" ? "number" : typeof o[k] === "boolean" ? "bool" : (String(o[k]).length > 80 ? "area" : "text"), fk: fkOf[k] || null }; });
    }
    function modifier(S, type, id, valeurs) {
      var o = trouver(S, type, id); if (!o) throw new Error("Enregistrement introuvable");
      if (!estTest(S, type, o)) throw new Error("Donnée réelle : seules les données de test se corrigent ici");
      var F = champs(S, type, o), chg = [], res = {};
      F.forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(valeurs, f.k)) return; var v = valeurs[f.k];
        if (f.t === "number") { v = v === "" || v == null ? 0 : Number(v); if (!isFinite(v)) throw new Error("Nombre invalide : " + f.k); }
        else if (f.t === "bool") v = v === true || v === "true" || v === "1" || v === "oui";
        else v = String(v == null ? "" : v);
        if (f.fk && v !== "" && v != null && !trouver(S, f.fk, v)) throw new Error("« " + f.k + " » : l'enregistrement « " + v + " » n'existe pas (" + f.fk + ").");
        if (v !== f.v && !(f.v === null && v === "")) { chg.push({ k: f.k, avant: f.v, apres: v }); res[f.k] = v; }
      });
      if (cfg.verifier) cfg.verifier(S, type, o, res);
      chg.forEach(function (c) { o[c.k] = c.apres; });
      return chg;
    }
    return { types: types, config: cfg, col: col, trouver: trouver, estTest: estTest, dependances: dependances, analyser: analyser, marquer: marquer, demarquer: demarquer, retirer: retirer, restaurer: restaurer, champs: champs, modifier: modifier, libelle: nom };
  }
  G.ANGELS_CASCADE = { moteur: moteur };
  if (typeof module !== "undefined" && module.exports) module.exports = G.ANGELS_CASCADE;
})(typeof window !== "undefined" ? window : globalThis);
