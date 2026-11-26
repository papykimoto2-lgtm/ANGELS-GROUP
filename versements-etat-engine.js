/* Moteur « ÉTAT DES VERSEMENTS DES LIVREURS » — pur, sans DOM (Distributions).
   Versement = reversement d'un livreur à ANGEL'S (S.fonds, type "reversement"). Filtres : période (du/au, AAAA-MM-JJ inclus), livreur, partenaire.
   Partenaire : "" = tous · "own" = ANGEL'S (commandes sans vendeur) · id = vendeur partenaire (fournisseur / client partenaire).
   Un versement n'est pas rattaché à une commande : il est réparti entre les partenaires AU PRORATA de l'argent encaissé par le livreur pour chacun
   (encaissements hors paiements directs). Le collecté, lui, est exact (commande → vendeur). */
(function (G) {
  "use strict";
  var MOMO = /(wave|orange|mtn|moov|momo|mobile)/i;
  function p(n) { return (n < 10 ? "0" : "") + n; }
  function jour(ts) { var d = new Date(ts); return isNaN(d) ? "" : d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function dans(ts, o) { var j = jour(ts); return !!j && (!o.du || j >= o.du) && (!o.au || j <= o.au); }
  function r0(x) { return Math.round(x); }

  function calculer(S, o) {
    o = o || {};
    var cmds = {}, i, f, c;
    (S.commandes || []).forEach(function (x) { cmds[x.id] = x; });
    var liv = {}; (S.livreurs || []).forEach(function (l) { liv[l.id] = l; });
    var vend = {}; (S.vendeurs || []).forEach(function (v) { vend[v.id] = v; });
    var cleV = function (cmd) { return cmd && cmd.vendeur_id ? cmd.vendeur_id : "own"; };
    var nomV = function (k) { return k === "own" ? "ANGEL'S (direct)" : (vend[k] ? vend[k].nom : "Vendeur inconnu"); };

    // Part de chaque partenaire dans l'argent encaissé par chaque livreur (toutes périodes) : sert à répartir les versements
    var enc = {}, encTot = {};
    (S.fonds || []).forEach(function (x) {
      if (x.type !== "encaissement" || x.direct || !x.livreur_id) return;
      var k = cleV(cmds[x.commande_id]);
      (enc[x.livreur_id] = enc[x.livreur_id] || {})[k] = ((enc[x.livreur_id] || {})[k] || 0) + (+x.montant || 0);
      encTot[x.livreur_id] = (encTot[x.livreur_id] || 0) + (+x.montant || 0);
    });
    var part = function (lid, k) { return encTot[lid] > 0 ? ((enc[lid] || {})[k] || 0) / encTot[lid] : 0; };
    // Coefficient d'un livreur selon le filtre partenaire (1 = tout)
    var coef = function (lid) { return o.vendeur ? part(lid, o.vendeur) : 1; };

    var parLiv = {}, parVend = {}, detail = [];
    var ligL = function (lid) { return parLiv[lid] || (parLiv[lid] = { livreur_id: lid, nom: (liv[lid] || {}).nom || "Livreur inconnu", collecte: 0, verse: 0, especes: 0, momo: 0, attente: 0, nb: 0 }); };
    var ligV = function (k) { return parVend[k] || (parVend[k] = { cle: k, nom: nomV(k), collecte: 0, verse: 0, attente: 0 }); };

    // Collecté sur la période (exact)
    (S.fonds || []).forEach(function (x) {
      if (x.type !== "encaissement" || x.direct || !x.livreur_id || !dans(x.ts, o)) return;
      if (o.livreur && x.livreur_id !== o.livreur) return;
      var k = cleV(cmds[x.commande_id]); if (o.vendeur && k !== o.vendeur) return;
      var m = +x.montant || 0; ligL(x.livreur_id).collecte += m; ligV(k).collecte += m;
    });
    // Versements validés (reversements) répartis au prorata
    (S.fonds || []).forEach(function (x) {
      if (x.type !== "reversement" || !x.livreur_id || !dans(x.ts, o)) return;
      if (o.livreur && x.livreur_id !== o.livreur) return;
      var cf = coef(x.livreur_id); if (o.vendeur && cf <= 0) return;
      var m = (+x.montant || 0) * cf, L = ligL(x.livreur_id), esp = !MOMO.test(x.mode || "");
      L.verse += m; L.nb++; if (esp) L.especes += m; else L.momo += m;
      if (encTot[x.livreur_id] > 0) Object.keys(enc[x.livreur_id]).forEach(function (k) { if (!o.vendeur || k === o.vendeur) ligV(k).verse += (+x.montant || 0) * part(x.livreur_id, k); });
      else if (!o.vendeur) ligV("own").verse += +x.montant || 0;
      detail.push({ ts: x.ts, livreur_id: x.livreur_id, livreur: L.nom, montant: r0(m), total: +x.montant || 0, mode: x.mode || "", ref: x.ref || "", note: x.note || "", par: x.par || "", statut: "valide", prorata: !!o.vendeur && cf < 1 });
    });
    // Déclarations Mobile Money en validation
    (S.versements || []).forEach(function (v) {
      if (v.statut !== "declare" || !dans(v.cree_le, o)) return;
      if (o.livreur && v.livreur_id !== o.livreur) return;
      var cf = coef(v.livreur_id); if (o.vendeur && cf <= 0) return;
      var m = (+v.montant || 0) * cf, L = ligL(v.livreur_id); L.attente += m;
      detail.push({ ts: v.cree_le, livreur_id: v.livreur_id, livreur: L.nom, montant: r0(m), total: +v.montant || 0, mode: v.mode || "", ref: v.ref || "", note: v.note || "", par: "", statut: "declare", prorata: !!o.vendeur && cf < 1 });
    });

    var lignes = Object.keys(parLiv).map(function (k) {
      var L = parLiv[k]; ["collecte", "verse", "especes", "momo", "attente"].forEach(function (c) { L[c] = r0(L[c]); });
      // Reste à reverser : solde global actuel du livreur (non filtrable par partenaire)
      var t = 0, rev = 0, ret = 0;
      (S.fonds || []).forEach(function (x) { if (x.livreur_id !== k) return; if (x.type === "encaissement" && !x.direct) t += +x.montant || 0; else if (x.type === "reversement") rev += +x.montant || 0; });
      (S.livraisons || []).forEach(function (l) {
        if (l.livreur_id === k && l.statut === "livree" && l.part_livreur != null) {
          var cash = 0; (S.fonds || []).forEach(function (x) { if (x.livraison_id === l.id && x.type === "encaissement" && !x.direct) cash += +x.montant || 0; });
          ret += Math.min(l.part_livreur, cash);
        }
      });
      L.reste = o.vendeur ? null : r0(t - ret - rev);
      return L;
    }).sort(function (a, b) { return b.verse - a.verse || a.nom.localeCompare(b.nom); });
    var partenaires = Object.keys(parVend).map(function (k) { var V = parVend[k]; V.collecte = r0(V.collecte); V.verse = r0(V.verse); return V; })
      .filter(function (V) { return V.collecte || V.verse; }).sort(function (a, b) { return b.collecte - a.collecte; });
    detail.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    var sum = function (k) { return lignes.reduce(function (t, l) { return t + (l[k] || 0); }, 0); };
    return { du: o.du || "", au: o.au || "", lignes: lignes, partenaires: partenaires, detail: detail,
      total: { collecte: sum("collecte"), verse: sum("verse"), especes: sum("especes"), momo: sum("momo"), attente: sum("attente"), reste: o.vendeur ? null : sum("reste"), nb: sum("nb") },
      prorata: !!o.vendeur };
  }
  G.ANGELS_VERS_ETAT = { calculer: calculer, jour: jour };
  if (typeof module !== "undefined") module.exports = G.ANGELS_VERS_ETAT;
})(typeof window !== "undefined" ? window : globalThis);
