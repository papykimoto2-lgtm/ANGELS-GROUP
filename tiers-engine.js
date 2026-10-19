/* ANGEL'S GROUP — moteur commun « comptes de tiers » : relevé de compte individuel (client, fournisseur, vendeur partenaire, chauffeur…) et ancienneté des créances / dettes.
   Modèle : module « Comptes tiers » de Menko immo (relevé de compte, balance âgée), mais avec une ancienneté PAR PIÈCE : les règlements s'imputent sur les pièces les plus anciennes
   (et non un seul âge pour tout le solde du tiers). Rien n'est enregistré : tout est dérivé de la comptabilité de l'application hôte.

   Contrat de l'hôte (host) :
     division : "distribution" | "transport" | "agro"
     can(a)   : "v" consulter, "p" imprimer / exporter
     user()   : nom de l'utilisateur ; identite() : {nom, siege, tel, rccm, ncc} ; render() ; util.fcfa ; aller() : affiche l'écran du relevé
     comptes(): [{compte:"411", lib:"Clients", nature:"D"|"C"}]       nature : D = créance (le tiers nous doit), C = dette (nous lui devons)
     lignes(compte) : [{k, date:"AAAA-MM-JJ", piece, libelle, journal, debit, credit, tiers:"clé", tn:"nom", lettre:"", echeance?:"AAAA-MM-JJ"}]  (toutes les lignes du compte, tous tiers) */
(function (G) {
  "use strict";
  var H = null;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fcfa = function (n) { return H && H.util && H.util.fcfa ? H.util.fcfa(n) : Math.round(n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F"; };
  var R = Math.round;
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var fd = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : (d || "—"); };
  var diffJ = function (a, b) { return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5); };
  var norm = function (s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); };
  var TR = ["Non échu", "0-30 j", "31-60 j", "61-90 j", "> 90 j"];
  var UIS = { compte: "", tiers: "", du: "", au: "", nl: false, q: "" };

  /* ---------- Calculs ---------- */
  function comptes() { try { return H.comptes() || []; } catch (e) { return []; } }
  function infoCompte(c) { return comptes().filter(function (x) { return x.compte === c; })[0] || null; }
  function lignesDe(compte) {
    var L = [];
    try { L = H.lignes(compte) || []; } catch (e) { L = []; }
    return L.map(function (x) { return { k: x.k, date: String(x.date || "").slice(0, 10), piece: x.piece || "", libelle: x.libelle || "", journal: x.journal || "", debit: R(+x.debit || 0), credit: R(+x.credit || 0), tiers: x.tiers == null ? "" : String(x.tiers), tn: x.tn || "(sans tiers)", lettre: x.lettre || "", echeance: x.echeance ? String(x.echeance).slice(0, 10) : "" }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.piece).localeCompare(String(b.piece)); });
  }
  var signe = function (nat, x) { return nat === "C" ? x.credit - x.debit : x.debit - x.credit; };   // solde « dû » positif dans le sens de la nature du compte

  /* Ancienneté par pièce : les règlements s'imputent sur les pièces les plus anciennes. Résultat : tranches [non échu, 0-30, 31-60, 61-90, >90] + avance (excédent de règlements) */
  function age(lignes, nat, au) {
    au = au || today();
    var items = [], pay = 0;
    lignes.forEach(function (x) { var m = nat === "C" ? x.credit - x.debit : x.debit - x.credit; if (m > 0) items.push({ d: x.date, e: x.echeance, m: m }); else pay += -m; });
    var tr = [0, 0, 0, 0, 0], ouv = [];
    items.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }).forEach(function (i) {
      var r = i.m, u = Math.min(pay, r); pay -= u; r -= u;
      if (r > 0) { var ref = i.e || i.d, j = diffJ(au, ref); tr[i.e && j < 0 ? 0 : j <= 30 ? 1 : j <= 60 ? 2 : j <= 90 ? 3 : 4] += r; ouv.push({ d: i.d, e: i.e, m: r, j: Math.max(0, j) }); }
    });
    return { tr: tr, tot: tr.reduce(function (a, b) { return a + b; }, 0), avance: pay, ouv: ouv };
  }
  /* Liste des tiers d'un compte : solde, nombre de pièces, pièces non lettrées, ancienneté */
  function liste(compte) {
    var inf = infoCompte(compte); if (!inf) return [];
    var L = lignesDe(compte), G = {};
    L.forEach(function (x) { var g = G[x.tiers] || (G[x.tiers] = { id: x.tiers, nom: x.tn, lignes: [] }); g.lignes.push(x); });
    return Object.keys(G).map(function (k) {
      var g = G[k], d = g.lignes.reduce(function (s, x) { return s + x.debit; }, 0), c = g.lignes.reduce(function (s, x) { return s + x.credit; }, 0), a = age(g.lignes, inf.nature);
      var plus = g.lignes.reduce(function (m, x) { return x.date > m ? x.date : m; }, "");
      return { id: g.id, nom: g.nom, debit: d, credit: c, solde: inf.nature === "C" ? c - d : d - c, nb: g.lignes.length, nl: g.lignes.filter(function (x) { return !x.lettre; }).length, age: a, derniere: plus };
    }).sort(function (a, b) { return Math.abs(b.solde) - Math.abs(a.solde) || a.nom.localeCompare(b.nom); });
  }
  /* Relevé d'un tiers : report, lignes avec solde cumulé, totaux, ancienneté des pièces ouvertes */
  function releve(compte, tid, o) {
    o = o || {}; var inf = infoCompte(compte); if (!inf) throw new Error("Compte de tiers inconnu.");
    var tous = lignesDe(compte).filter(function (x) { return x.tiers === String(tid); }); if (!tous.length) throw new Error("Aucun mouvement pour ce tiers sur le compte " + compte + ".");
    var du = o.du || "", au = o.au || "";
    if (du && au && au < du) throw new Error("La date de fin est antérieure à la date de début.");
    var base = o.nl ? tous.filter(function (x) { return !x.lettre; }) : tous;
    var avant = du ? base.filter(function (x) { return x.date < du; }) : [], per = base.filter(function (x) { return (!du || x.date >= du) && (!au || x.date <= au); });
    var rep = avant.reduce(function (s, x) { return s + signe(inf.nature, x); }, 0), cum = rep, td = 0, tc = 0;
    var lignes = per.map(function (x) { cum += signe(inf.nature, x); td += x.debit; tc += x.credit; return Object.assign({}, x, { cumul: cum }); });
    var jusque = au ? tous.filter(function (x) { return x.date <= au; }) : tous;
    return { compte: compte, lib: inf.lib, nature: inf.nature, tiers: { id: String(tid), nom: tous[0].tn }, du: du, au: au, nl: !!o.nl, report: rep, lignes: lignes, debit: td, credit: tc, solde: cum, age: age(jusque, inf.nature, au || today()), nbLettrees: per.filter(function (x) { return x.lettre; }).length, edite: today() };
  }

  /* ---------- Affichage ---------- */
  var CSS = ".tr-w{overflow:auto}.tr-w table{width:100%;border-collapse:collapse;font-size:13px}.tr-w th,.tr-w td{border-bottom:1px solid var(--bd,#d5dbe3);padding:6px 8px;text-align:left;vertical-align:top}.tr-w th{font-size:12px;color:var(--mu,#5b6572);white-space:nowrap}.tr-w td.n,.tr-w th.n{text-align:right;white-space:nowrap}" +
    ".tr-b{font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid var(--bd,#d5dbe3);background:var(--card,#fff);color:var(--tx,#1c2430);cursor:pointer}.tr-b.p{background:var(--b2,#1f3a5f);color:#fff;border-color:var(--b2,#1f3a5f)}" +
    ".tr-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:10px 0}.tr-k div{border:1px solid var(--bd,#d5dbe3);border-radius:10px;padding:9px 11px;background:var(--card,#fff)}.tr-k b{display:block;font-size:17px}.tr-k span{font-size:12px;color:var(--mu,#5b6572)}" +
    ".tr-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:8px 0}.tr-bar label{font-size:12px;color:var(--mu,#5b6572);display:block}.tr-bar input,.tr-bar select{font:inherit;padding:7px;border:1px solid var(--bd,#d5dbe3);border-radius:8px;background:var(--bg,#fff);color:var(--tx,#1c2430)}" +
    ".tr-n{background:var(--card,#fff);border:1px solid var(--bd,#d5dbe3);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:13px;color:var(--mu,#5b6572)}.tr-bd{display:inline-block;border-radius:99px;padding:1px 8px;font-size:12px;border:1px solid var(--bd,#d5dbe3)}.tr-bd.ok{border-color:#1f8a4c;color:#1f8a4c}.tr-bd.wa{border-color:#b26a00;color:#b26a00}.tr-bd.er{border-color:#b3261e;color:#b3261e}";
  function css() { if (document.getElementById("tr-css")) return; var s = document.createElement("style"); s.id = "tr-css"; s.textContent = CSS; document.head.appendChild(s); }
  var kpi = function (v, l) { return "<div><b>" + v + "</b><span>" + esc(l) + "</span></div>"; };
  var btn = function (a, id, l, c) { return '<button type="button" class="tr-b ' + (c || "") + '" data-tr="' + a + '" data-id="' + esc(id == null ? "" : id) + '">' + l + "</button>"; };
  var tbl = function (cols, rows, empty) { return '<div class="tr-w"><table><thead><tr>' + cols.map(function (c) { return '<th class="' + (c[1] || "") + '">' + esc(c[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" + (rows.length ? rows.join("") : '<tr><td colspan="' + cols.length + '" style="color:var(--mu,#5b6572)">' + esc(empty || "Aucune donnée.") + "</td></tr>") + "</tbody></table></div>"; };
  var nature = function (r) { return r.nature === "C" ? ["Nous lui devons", "Avance versée (il nous doit)"] : ["Il nous doit", "Avance reçue (nous lui devons)"]; };
  var cellsAge = function (a) { return a.tr.map(function (v, i) { return '<td class="n"' + (i === 4 && v ? ' style="color:#b3261e;font-weight:700"' : "") + ">" + (v ? fcfa(v) : "") + "</td>"; }).join(""); };

  function vListe(compte) {
    var inf = infoCompte(compte), L = liste(compte), q = norm(UIS.q);
    var F = L.filter(function (t) { return !q || norm(t.nom).indexOf(q) >= 0; });
    var tot = F.reduce(function (s, t) { return s + t.solde; }, 0), plus90 = F.reduce(function (s, t) { return s + t.age.tr[4]; }, 0);
    return '<div class="tr-k">' + kpi(F.length, "Tiers" + (q ? " (filtrés)" : "")) + kpi(fcfa(tot), inf.nature === "C" ? "Total des dettes" : "Total des créances") + kpi(fcfa(plus90), "Dont de plus de 90 jours") + kpi(F.filter(function (t) { return t.solde < 0; }).length, "Tiers en avance (solde inverse)") + "</div>" +
      tbl([["Tiers"], ["Pièces", "n"], ["Non lettrées", "n"], ["Dernier mouvement"], ["Solde", "n"]].concat(TR.map(function (t) { return [t, "n"]; }), [[""]]), F.map(function (t) {
        return "<tr><td><b>" + esc(t.nom) + "</b></td><td class=\"n\">" + t.nb + "</td><td class=\"n\">" + t.nl + "</td><td>" + fd(t.derniere) + '</td><td class="n"><b>' + fcfa(t.solde) + "</b>" + (t.age.avance ? '<br><small style="color:#1f8a4c">avance ' + fcfa(t.age.avance) + "</small>" : "") + "</td>" + cellsAge(t.age) + "<td>" + btn("ouvrir", t.id, "Relevé", "p") + "</td></tr>";
      }), "Aucun tiers sur ce compte.");
  }
  function vReleve(compte, tid) {
    var r; try { r = releve(compte, tid, UIS); } catch (e) { return '<div class="tr-n">' + esc(e.message) + "</div>" + btn("liste", "", "← Liste des tiers"); }
    var nt = nature(r), s = r.solde, a = r.age;
    var rows = r.lignes.map(function (x) { return "<tr><td>" + fd(x.date) + "</td><td>" + esc(x.piece) + "</td><td>" + esc(x.libelle) + "</td><td>" + (x.lettre ? '<span class="tr-bd ok">' + esc(x.lettre) + "</span>" : "") + '</td><td class="n">' + (x.debit ? fcfa(x.debit) : "") + '</td><td class="n">' + (x.credit ? fcfa(x.credit) : "") + '</td><td class="n"><b>' + fcfa(x.cumul) + "</b></td></tr>"; });
    if (r.du) rows.unshift('<tr><td colspan="6"><i>Report au ' + fd(r.du) + '</i></td><td class="n"><b>' + fcfa(r.report) + "</b></td></tr>");
    return '<div class="tr-bar">' + btn("liste", "", "← Liste des tiers") + (H.can("p") ? btn("imprimer", "", "🖨 Imprimer / PDF", "p") + btn("csv", "", "⬇ CSV") : "") + "</div>" +
      "<h3>" + esc(r.tiers.nom) + ' <small style="color:var(--mu,#5b6572)">— compte ' + esc(r.compte) + " " + esc(r.lib) + "</small></h3>" +
      '<div class="tr-bar"><div><label>Du</label><input type="date" data-trf="du" value="' + esc(UIS.du) + '"></div><div><label>Au</label><input type="date" data-trf="au" value="' + esc(UIS.au) + '"></div><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-trf="nl" ' + (UIS.nl ? "checked" : "") + '> Pièces non lettrées seulement</label></div>' +
      '<div class="tr-k">' + kpi(fcfa(Math.abs(s)), s >= 0 ? nt[0] : nt[1]) + kpi(fcfa(r.debit), "Total débit") + kpi(fcfa(r.credit), "Total crédit") + kpi(fcfa(a.tr[4]), "Dont de plus de 90 jours") + "</div>" +
      tbl([["Date"], ["Pièce"], ["Libellé"], ["Lettre"], ["Débit", "n"], ["Crédit", "n"], [r.nature === "C" ? "Solde dû" : "Solde", "n"]], rows, "Aucun mouvement sur la période.") +
      "<h3>Ancienneté des pièces ouvertes</h3>" + tbl(TR.map(function (t) { return [t, "n"]; }).concat([["Total", "n"]]), ["<tr>" + cellsAge(a) + '<td class="n"><b>' + fcfa(a.tot) + "</b></td></tr>"], "") +
      '<div class="tr-n">Les règlements s\'imputent sur les pièces les plus anciennes' + (a.avance ? " ; excédent de règlements (avance) : <b>" + fcfa(a.avance) + "</b>" : "") + ". Lettre = pièces rapprochées entre elles (lettrage de la comptabilité)." + (r.nl ? " <b>Filtre actif : pièces non lettrées seulement.</b>" : "") + "</div>";
  }
  function vue() {
    var C = comptes(); if (!C.length) return '<div class="tr-n">Aucun compte de tiers n\'est configuré pour cette division.</div>';
    if (!UIS.compte || !infoCompte(UIS.compte)) UIS.compte = (C.filter(function (c) { return liste(c.compte).length; })[0] || C[0]).compte;   /* premier compte qui a des mouvements */
    var sel = '<div class="tr-bar"><div><label>Compte de tiers</label><select data-trf="compte">' + C.map(function (c) { return '<option value="' + esc(c.compte) + '" ' + (c.compte === UIS.compte ? "selected" : "") + ">" + esc(c.compte + " — " + c.lib) + "</option>"; }).join("") + "</select></div>" +
      (UIS.tiers ? "" : '<div><label>Rechercher un tiers</label><input data-trf="q" value="' + esc(UIS.q) + '" placeholder="Nom…"></div>') + "</div>";
    return '<div class="tr-root">' + sel + (UIS.tiers ? vReleve(UIS.compte, UIS.tiers) : vListe(UIS.compte)) + "</div>";
  }
  function view(host) {
    H = host; css(); G.ANGELS_TIERS.host = host;
    if (!H.can("v")) return '<div class="tr-n">Accès aux comptes de tiers non autorisé pour votre profil.</div>';
    return vue();
  }

  /* ---------- Impression et export ---------- */
  function corpsImpression(r) {
    var nt = nature(r), tb = function (cols, rows) { return "<table><thead><tr>" + cols.map(function (c) { return '<th class="' + (c[1] || "") + '">' + esc(c[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>"; };
    var l = r.lignes.map(function (x) { return "<tr><td class=\"nw\">" + fd(x.date) + "</td><td>" + esc(x.piece) + "</td><td>" + esc(x.libelle) + "</td><td>" + esc(x.lettre) + '</td><td class="n">' + (x.debit ? fcfa(x.debit) : "") + '</td><td class="n">' + (x.credit ? fcfa(x.credit) : "") + '</td><td class="n">' + fcfa(x.cumul) + "</td></tr>"; });
    if (r.du) l.unshift('<tr><td colspan="6"><i>Report au ' + fd(r.du) + '</i></td><td class="n">' + fcfa(r.report) + "</td></tr>");
    l.push('<tr class="tot"><td colspan="4">Totaux de la période</td><td class="n">' + fcfa(r.debit) + '</td><td class="n">' + fcfa(r.credit) + '</td><td class="n">' + fcfa(r.solde) + "</td></tr>");
    var a = r.age;
    return '<p class="sub">Tiers : <b>' + esc(r.tiers.nom) + "</b> · compte " + esc(r.compte) + " " + esc(r.lib) + " · période " + (r.du ? "du " + fd(r.du) : "depuis l'origine") + " " + (r.au ? "au " + fd(r.au) : "au " + fd(r.edite)) + (r.nl ? " · pièces non lettrées seulement" : "") + "</p>" +
      tb([["Date"], ["Pièce"], ["Libellé"], ["Lettre"], ["Débit", "n"], ["Crédit", "n"], [r.nature === "C" ? "Solde dû" : "Solde", "n"]], l) +
      '<p style="margin-top:10px"><b>Solde au ' + fd(r.au || r.edite) + " : " + fcfa(Math.abs(r.solde)) + "</b> — " + (r.solde >= 0 ? nt[0] : nt[1]) + ".</p>" +
      "<h3>Ancienneté des pièces ouvertes</h3>" + tb(TR.map(function (t) { return [t, "n"]; }).concat([["Total", "n"]]), ["<tr>" + a.tr.map(function (v) { return '<td class="n">' + (v ? fcfa(v) : "—") + "</td>"; }).join("") + '<td class="n"><b>' + fcfa(a.tot) + "</b></td></tr>"]) +
      '<p class="sub" style="margin-top:8px">Les règlements sont imputés sur les pièces les plus anciennes. Merci de signaler toute différence dans un délai de 15 jours.</p>';
  }
  function imprimer() {
    if (!G.ANGELS_PRINT) { alert("Moteur d'impression indisponible."); return; }
    if (!H.can("p")) { alert("Droits insuffisants pour imprimer."); return; }
    var r = releve(UIS.compte, UIS.tiers, UIS);
    G.ANGELS_PRINT.ouvrir({ division: H.division, emetteur: H.user(), fallback: H.identite ? H.identite() : null, titre: "Relevé de compte " + (r.nature === "C" ? "fournisseur" : "client"), ref: "RC-" + r.compte + "-" + norm(r.tiers.nom).replace(/[^a-z0-9]+/g, "").slice(0, 8).toUpperCase(), date: r.au || r.edite, montant: Math.abs(r.solde), corps: corpsImpression(r) }).catch(function (e) { alert("Impression impossible : " + e.message); });
    if (H.audit) H.audit("Relevé de compte imprimé", r.tiers.nom + " — " + r.compte);
  }
  function csv() {
    if (!H.can("p")) { alert("Droits insuffisants pour exporter."); return; }
    var r = releve(UIS.compte, UIS.tiers, UIS), q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/^([=+@\t\r]|-(?![\d.,]+$))/, "'$1") + '"'; };
    var rows = [["Date", "Pièce", "Libellé", "Lettre", "Débit", "Crédit", "Solde"]];
    if (r.du) rows.push([r.du, "", "Report", "", "", "", r.report]);
    r.lignes.forEach(function (x) { rows.push([x.date, x.piece, x.libelle, x.lettre, x.debit, x.credit, x.cumul]); });
    var b = new Blob(["﻿" + rows.map(function (x) { return x.map(q).join(";"); }).join("\n")], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "releve-" + r.compte + "-" + norm(r.tiers.nom).replace(/[^a-z0-9]+/g, "-") + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------- Actions ---------- */
  function ouvrir(host, compte, tiers) { if (host) H = host; UIS.compte = compte; UIS.tiers = tiers == null ? "" : String(tiers); UIS.du = ""; UIS.au = ""; UIS.nl = false; UIS.q = ""; if (H.aller) H.aller(); else H.render(); }
  var ACT = {
    ouvrir: function (id) { UIS.tiers = id; UIS.du = ""; UIS.au = ""; UIS.nl = false; H.render(); },
    liste: function () { UIS.tiers = ""; H.render(); },
    imprimer: imprimer, csv: csv
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-tr]"); if (!t || !G.ANGELS_TIERS.host) return; var f = ACT[t.dataset.tr]; if (!f) return; e.preventDefault(); H = G.ANGELS_TIERS.host;
    try { f(t.dataset.id, t); } catch (x) { alert(x.message); }
  });
  document.addEventListener("input", function (e) { var t = e.target; if (!t.dataset || t.dataset.trf !== "q" || !H) return; UIS.q = t.value; var pos = t.selectionStart; H.render(); var n = document.querySelector('[data-trf="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } });
  document.addEventListener("change", function (e) {
    var t = e.target; if (!H || !t.dataset || !t.dataset.trf) return; var k = t.dataset.trf;
    if (k === "compte") { UIS.compte = t.value; UIS.tiers = ""; UIS.q = ""; } else if (k === "du" || k === "au") UIS[k] = t.value; else if (k === "nl") UIS.nl = t.checked; else return;
    H.render();
  });

  G.ANGELS_TIERS = { host: null, view: view, ouvrir: ouvrir, releve: function (compte, tid, o, h) { if (h) H = h; return releve(compte, tid, o); }, liste: function (compte, h) { if (h) H = h; return liste(compte); }, age: age, UI: UIS, TRANCHES: TR, use: function (h) { H = h; this.host = h; } };
})(window);
