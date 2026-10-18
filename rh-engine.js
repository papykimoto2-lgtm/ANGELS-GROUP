/* Module Ressources humaines et paie ANGEL'S GROUP — moteur partagé par Transport, Distributions et Agro.
   Modèle : le module « Ressources humaines et paie » de Menko (employés, contrats, congés, paie ITS / CNPS / FDFP / CMU, déclarations, livre de paie).
   Chaque application possède SES données (S.rh) et SA comptabilité : le moteur ne connaît que l'interface « hôte » fournie par l'application
   (état, droits, écritures comptables, trésorerie, impression). Les barèmes sont paramétrables et à valider avec votre expert-comptable. */
(function (G) {
  "use strict";
  /* ---------- Paramètres de paie (valeurs de Menko, modifiables par application) ---------- */
  var PAIE_DEF = {
    joursMois: 30, smig: 75000, ricfParPart: 11000,
    bareme: [[0, 75000, 0], [75000, 240000, 0.16], [240000, 800000, 0.21], [800000, 2400000, 0.24], [2400000, 8000000, 0.28], [8000000, 1e15, 0.32]],
    cnpsSal: 0.063, cnpsPat: 0.077, plafondRetraite: 3375000, tauxAT: 0.05, tauxPF: 0.0575, plafondATPF: 75000,
    itsPat: 0.012, fdfpTA: 0.004, fdfpFC: 0.006, fdfpRegul: 0.006, cmuSal: 500, cmuPat: 500, transportExo: 30000, congeParMois: 2.2
  };
  var TYPES_CTR = [["CDI", "CDI — durée indéterminée"], ["CDD", "CDD — durée déterminée"], ["journalier", "Journalier / temporaire"], ["stage", "Stage"], ["prestataire", "Consultant / prestataire"]];
  var TYPES_CONGE = [["annuel", "Congé annuel payé"], ["maladie", "Maladie"], ["maternite", "Maternité / paternité"], ["permission", "Permission exceptionnelle"], ["sans_solde", "Sans solde"]];
  var MODES = [["banque", "Banque / virement"], ["mobile", "Mobile Money"], ["caisse", "Espèces (caisse)"]];
  var ACTS_DEF = [["admin", "Administration et services généraux"]];

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var R = Math.round;
  var H = null;                                   /* hôte courant */
  var U = function () { return H.util; };
  var fcfa = function (n) { return H && H.util && H.util.fcfa ? H.util.fcfa(n) : R(n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F"; };
  var fd = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : (d || "—"); };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var moisCle = function (d) { return String(d).slice(0, 7); };
  var dernierJour = function (m) { var p = m.split("-"); var d = new Date(Date.UTC(+p[0], +p[1], 0)); return m + "-" + ("0" + d.getUTCDate()).slice(-2); };
  var premierJour = function (m) { return m + "-01"; };
  var diffJ = function (a, b) { return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5); };
  var addJ = function (d, n) { var x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  var libMois = function (m) { var p = m.split("-"); return ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][+p[1] - 1] + " " + p[0]; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (+f(x) || 0); }, 0); };
  var by = function (a, id) { return a.filter(function (x) { return x.id === id; })[0]; };
  var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* ---------- État ---------- */
  function rh() {
    var S = H.state();
    S.rh = S.rh || {};
    var r = S.rh; r.v = 1;
    ["employes", "variables", "avances", "conges", "paies", "reversements", "historique"].forEach(function (k) { if (!Array.isArray(r[k])) r[k] = []; });
    r.params = r.params || {}; r.seq = r.seq || {};
    return r;
  }
  function P() { var r = rh(), p = {}, k; for (k in PAIE_DEF) p[k] = PAIE_DEF[k]; for (k in (H.defauts || {})) p[k] = H.defauts[k]; for (k in r.params) if (r.params[k] !== "" && r.params[k] != null) p[k] = r.params[k]; return p; }
  function seq(k) { var r = rh(); r.seq[k] = (r.seq[k] || 0) + 1; return r.seq[k]; }
  function need(a) { if (!H.can(a)) throw new Error("Droits insuffisants (Ressources humaines : " + ({ v: "consulter", c: "créer", e: "modifier", a: "valider", x: "annuler", p: "exporter" }[a] || a) + ")."); }
  function log(a, d) { var r = rh(); r.historique.unshift({ t: new Date().toISOString(), u: H.user(), a: a, d: d || "" }); if (r.historique.length > 800) r.historique.length = 800; if (H.audit) H.audit(a, d); try { publier(); } catch (e) { } }

  /* ---------- Calcul de la paie (ITS, CNPS, CMU, FDFP) ---------- */
  function itsBrut(bi, p) { var s = 0; p.bareme.forEach(function (t) { if (bi > t[0]) s += (Math.min(bi, t[1]) - t[0]) * t[2]; }); return R(s); }
  function ricf(parts, p) { return R(Math.max(0, (parts || 1) - 1) * p.ricfParPart); }
  function tauxAnc(e, mois) {
    if (e.anc_auto === false) return +e.anc_taux || 0;
    if (!e.embauche) return 0;
    var ans = diffJ(dernierJour(mois), e.embauche) / 365.25; if (ans < 2) return 0;
    return Math.min(25, 2 + Math.floor(ans - 2));
  }
  function salMois(e, mois) { /* salaire de base et sursalaire applicables au mois (selon la date d'effet) */
    var h = e.historique || [], fin = dernierJour(mois), best = null;
    h.forEach(function (x) { if (x && x.from && x.from <= fin && (!best || x.from >= best.from)) best = x; });
    if (!best) h.forEach(function (x) { if (x && x.from && (!best || x.from < best.from)) best = x; });
    return best && best.sal_base > 0 ? { sal_base: best.sal_base, sursalaire: best.sursalaire || 0 } : { sal_base: e.sal_base, sursalaire: e.sursalaire };
  }
  function joursPayes(e, mois, v, p, rr) {
    var ms = premierJour(mois), me = dernierJour(mois), s = e.embauche && e.embauche > ms ? e.embauche : ms, f = e.sortie && e.sortie.date && e.sortie.date < me ? e.sortie.date : me;
    if (e.contrat === "CDD" && e.fin_contrat && e.fin_contrat < f) f = e.fin_contrat;
    var cal = diffJ(f, s) + 1; if (cal <= 0) return 0;
    var nbCal = diffJ(me, ms) + 1, j = s === ms && f === me ? p.joursMois : (nbCal < p.joursMois ? R(cal * p.joursMois / nbCal) : Math.min(p.joursMois, cal));
    var ss = 0; rr.conges.forEach(function (c) { if (c.emp_id === e.id && c.statut === "approuve" && c.type === "sans_solde") { var a = c.debut > s ? c.debut : s, b = c.fin < f ? c.fin : f; if (b >= a) ss += diffJ(b, a) + 1; } });
    return Math.max(0, j - ss - (+v.abs || 0));
  }
  function calcul(e, v, p, jours) {
    var pro = jours / p.joursMois, cat = R((+e.sal_base || 0) * pro), sur = R((+e.sursalaire || 0) * pro), anc = R(cat * (v._anc || 0) / 100);
    var prim = R((+e.primes || 0) * pro) + R(+v.primes || 0), log_ = R((+e.logement || 0) * pro), hs = R(+v.hs || 0);
    var trB = R((+e.transport || 0) * pro), trExo = e.declare === false ? trB : Math.min(trB, p.transportExo), trImp = Math.max(0, trB - trExo);
    var bi = cat + sur + anc + prim + log_ + hs + trImp, brut = bi + trExo, exo = e.declare === false;
    var cnpsS = exo ? 0 : R(Math.min(bi, p.plafondRetraite) * p.cnpsSal), ib = itsBrut(bi, p), rc = ricf(+e.parts || 1, p), itsN = Math.max(0, ib - rc), nb = Math.max(1, +e.cmu_pers || 1);
    var cmuS = exo || jours <= 0 ? 0 : p.cmuSal * nb, ret = R(+v.retenues || 0), av = R(+v.avance || 0), totS = cnpsS + itsN + cmuS + ret + av;
    var bATPF = Math.min(bi, p.plafondATPF), cRP = exo ? 0 : R(Math.min(bi, p.plafondRetraite) * p.cnpsPat), cAT = exo ? 0 : R(bATPF * p.tauxAT), cPF = exo ? 0 : R(bATPF * p.tauxPF);
    var itsP = R(bi * p.itsPat), fTA = R(bi * p.fdfpTA), fFC = R(bi * p.fdfpFC), fRG = R(bi * p.fdfpRegul), cmuP = exo || jours <= 0 ? 0 : p.cmuPat * nb, totP = cRP + cAT + cPF + itsP + fTA + fFC + fRG + cmuP;
    return { jours: jours, categoriel: cat, sursalaire: sur, tauxAnc: v._anc || 0, anciennete: anc, primes: prim, logement: log_, hs: hs, transport: trExo, transportImp: trImp,
      brutImposable: bi, brut: brut, cnpsSal: cnpsS, itsBrut: ib, ricf: rc, its: itsN, cmuSal: cmuS, retenues: ret, avance: av, totalRetenues: totS,
      cnpsRetPat: cRP, cnpsAT: cAT, cnpsPF: cPF, itsPat: itsP, fdfpTA: fTA, fdfpFC: fFC, fdfpRegul: fRG, cmuPat: cmuP, totalPatronal: totP,
      net: Math.max(0, brut - totS), cout: brut + totP, exoCnps: exo };
  }
  var cnpsTotal = function (c) { return c.cnpsSal + c.cnpsRetPat + c.cnpsAT + c.cnpsPF + c.cmuSal + c.cmuPat; };
  var fdfpTotal = function (c) { return c.fdfpTA + c.fdfpFC + c.fdfpRegul; };
  var empActif = function (e) { return !(e.sortie && e.sortie.date); };
  var empNom = function (e) { return ((e.nom || "") + " " + (e.prenoms || "")).trim(); };
  var empPresent = function (e, mois) { var me = dernierJour(mois); return (!e.embauche || e.embauche <= me) && (!(e.sortie && e.sortie.date) || e.sortie.date >= premierJour(mois)) && !(e.contrat === "CDD" && e.fin_contrat && e.fin_contrat < premierJour(mois)); };
  function variable(mois, empId) { var r = rh(); return r.variables.filter(function (x) { return x.mois === mois && x.emp_id === empId; })[0] || { mois: mois, emp_id: empId, abs: 0, hs: 0, primes: 0, retenues: 0, avance: null }; }
  function avanceDue(empId, mois) { var fin = mois ? dernierJour(mois) : "9999"; return sum(rh().avances.filter(function (a) { return a.emp_id === empId && a.date <= fin; }), function (a) { return a.reste; }); }
  function avanceAuto(empId, mois) { var fin = mois ? dernierJour(mois) : "9999"; return R(sum(rh().avances.filter(function (a) { return a.emp_id === empId && a.reste > 0 && a.date <= fin; }), function (a) { return Math.min(a.reste, a.retenue || a.reste); })); }

  /* ---------- Paie mensuelle ---------- */
  function paieDe(mois) { return rh().paies.filter(function (x) { return x.mois === mois; })[0]; }
  function construireBulletins(mois) {
    var r = rh(), p = P();
    var emps = r.employes.filter(function (e) { return empPresent(e, mois); });
    if (!emps.length) throw new Error("Aucun employé actif sur " + libMois(mois) + ".");
    return emps.map(function (e0) {
      var e = Object.assign({}, e0, salMois(e0, mois));
      var v = variable(mois, e.id), vv = { abs: v.abs, hs: v.hs, primes: v.primes, retenues: v.retenues, _anc: tauxAnc(e, mois) };
      vv.avance = v.avance != null && v.avance !== "" ? Math.min(+v.avance, avanceDue(e.id, mois)) : avanceAuto(e.id, mois);
      var j = joursPayes(e, mois, vv, p, r), c = calcul(e, vv, p, j);
      if (c.totalRetenues > c.brut) throw new Error(empNom(e) + " : avances et retenues (" + fcfa(c.avance + c.retenues) + ") supérieures au brut du mois : réduisez-les dans les variables.");
      return { emp_id: e.id, mat: e.mat, nom: empNom(e), poste: e.poste || "", act: e.act || "", mode: e.mode_paie || "banque", calc: c, paye: false };
    });
  }
  function calculerMois(mois) {
    need("c"); var r = rh(), p = P(), pa = paieDe(mois);
    if (pa && pa.statut !== "brouillon") throw new Error("La paie de " + libMois(mois) + " est déjà validée : annulez la validation pour la recalculer.");
    var bul = construireBulletins(mois);
    if (!pa) { pa = { id: uid("pa"), mois: mois, statut: "brouillon", bulletins: [] }; r.paies.push(pa); }
    pa.bulletins = bul; pa.calc_le = new Date().toISOString(); log("Paie calculée", libMois(mois) + " — " + bul.length + " bulletin(s)"); return pa;
  }
  function lignesPaie(pa, C, parAct) {
    var L = [], B = pa.bulletins, T = function (f) { return sum(B, function (b) { return f(b.calc); }); };
    var groupes = {}; B.forEach(function (b) { var k = parAct ? (b.act || "") : ""; (groupes[k] = groupes[k] || []).push(b); });
    Object.keys(groupes).forEach(function (k) {
      var g = groupes[k], a = k ? { act: k } : {};
      var brut = sum(g, function (b) { return b.calc.brut; }), pat = sum(g, function (b) { return b.calc.totalPatronal; });
      if (brut) L.push(Object.assign({ compte: C.paie_charge, debit: brut }, a)); if (pat) L.push(Object.assign({ compte: C.paie_charge_pat, debit: pat }, a));
    });
    var net = T(function (c) { return c.net; }), cnps = sum(B, function (b) { return cnpsTotal(b.calc); }) - 0, its = T(function (c) { return c.its + c.itsPat; }), fdfp = sum(B, function (b) { return fdfpTotal(b.calc); }), av = T(function (c) { return c.avance; }), ret = T(function (c) { return c.retenues; });
    if (net) L.push({ compte: C.paie_du, credit: net }); if (cnps) L.push({ compte: C.paie_cnps, credit: cnps }); if (its) L.push({ compte: C.paie_its, credit: its });
    if (fdfp) L.push({ compte: C.paie_fdfp, credit: fdfp }); if (av) L.push({ compte: C.paie_avances, credit: av }); if (ret) L.push({ compte: C.paie_retenues, credit: ret });
    return L;
  }
  function validerMois(mois) {
    need("a"); var r = rh(), pa = paieDe(mois);
    if (!pa || !pa.bulletins.length) throw new Error("Calculez d'abord la paie de " + libMois(mois) + ".");
    if (pa.statut !== "brouillon") throw new Error("Paie déjà validée.");
    if (mois > moisCle(today())) throw new Error("Impossible de valider la paie d'un mois futur.");
    var prev = r.paies.filter(function (x) { return x.mois < mois && x.statut === "brouillon"; })[0]; if (prev) throw new Error("Validez d'abord la paie de " + libMois(prev.mois) + ".");
    var sig = function (L) { return JSON.stringify(L.map(function (b) { return [b.emp_id, b.calc]; })); };
    if (sig(construireBulletins(mois)) !== sig(pa.bulletins)) throw new Error("Les données ont changé depuis le calcul de la paie de " + libMois(mois) + " (employé, variables, congés, avances ou paramètres) : recalculez avant de valider.");
    var C = H.compta.comptes(), L = lignesPaie(pa, C, !!H.compta.analytique), dt = dernierJour(mois); if (dt > today()) dt = today();
    var id = H.compta.poster({ journal: "PAIE", date: dt, libelle: "Paie " + libMois(mois) + " — " + pa.bulletins.length + " salarié(s)", piece: "PAIE-" + mois, source: { type: "rh_paie", id: pa.id }, lines: L });
    pa.statut = "valide"; pa.entry_id = id; pa.valide_par = H.user(); pa.valide_le = new Date().toISOString(); pa.date = dt;
    pa.bulletins.forEach(function (b, i) { b.no = "BUL-" + mois.replace("-", "") + "-" + (b.mat || ("" + (i + 1))); });
    pa.bulletins.forEach(function (b) { var rest = b.calc.avance; r.avances.filter(function (a) { return a.emp_id === b.emp_id && a.reste > 0 && a.date <= dernierJour(mois); }).forEach(function (a) { var m = Math.min(rest, a.reste); a.reste -= m; rest -= m; (a.retenues = a.retenues || []).push({ mois: mois, montant: m }); }); });
    log("Paie validée", libMois(mois) + " — net " + fcfa(sum(pa.bulletins, function (b) { return b.calc.net; })));
    return pa;
  }
  function annulerValidation(mois, motif) {
    need("x"); var r = rh(), pa = paieDe(mois);
    if (!pa || pa.statut === "brouillon") throw new Error("Aucune paie validée pour ce mois.");
    if (String(motif || "").trim().length < 5) throw new Error("Motif obligatoire (5 caractères minimum).");
    if (pa.bulletins.some(function (b) { return b.paye; })) throw new Error("Des salaires sont déjà payés : annulez d'abord les paiements (onglet Paie).");
    if (r.reversements.some(function (x) { return x.mois === mois && !x.annule; })) throw new Error("Des cotisations de ce mois sont déjà reversées : annulez d'abord les reversements (onglet Charges sociales).");
    if (r.paies.some(function (x) { return x.mois > mois && x.statut !== "brouillon"; })) throw new Error("Une paie plus récente est validée : annulez-la d'abord.");
    H.compta.extourner(pa.entry_id, "Annulation paie " + libMois(mois) + " — " + String(motif).trim());
    pa.bulletins.forEach(function (b) { var rest = b.calc.avance; r.avances.filter(function (a) { return a.emp_id === b.emp_id; }).reverse().forEach(function (a) { (a.retenues || []).filter(function (x) { return x.mois === mois; }).forEach(function (x) { a.reste += x.montant; }); a.retenues = (a.retenues || []).filter(function (x) { return x.mois !== mois; }); }); });
    pa.ecritures_annulees = (pa.ecritures_annulees || 0) + 1; pa.statut = "brouillon"; pa.annulee = { par: H.user(), le: new Date().toISOString(), motif: String(motif).trim() }; delete pa.entry_id; log("Validation de paie annulée", libMois(mois) + " — " + motif);
  }
  function payerSalaires(mois, mode, ids, date) {
    need("c"); var pa = paieDe(mois); if (!pa || pa.statut === "brouillon") throw new Error("Validez d'abord la paie de " + libMois(mois) + ".");
    var d = date || today(); if (d > today()) throw new Error("Date dans le futur."); if (pa.date && d < pa.date) throw new Error("Date antérieure à la validation de la paie (" + fd(pa.date) + ").");
    var L = pa.bulletins.filter(function (b) { return !b.paye && b.calc.net > 0 && (!ids || ids.indexOf(b.emp_id) >= 0); });
    if (!L.length) throw new Error("Aucun salaire à payer.");
    if (!MODES.some(function (m) { return m[0] === mode; })) throw new Error("Mode de règlement invalide.");
    var tot = sum(L, function (b) { return b.calc.net; }), C = H.compta.comptes(), pid = uid("pay"), t = H.compta.treso(mode, tot, "sortie", "Salaires " + libMois(mois), { type: "rh_salaires", id: pid });
    var id = H.compta.poster({ journal: t.journal, date: d, libelle: "Paiement des salaires " + libMois(mois) + " (" + L.length + ")", piece: "SAL-" + mois, source: { type: "rh_salaires", id: pid }, lines: [{ compte: C.paie_du, debit: tot }, { compte: t.compte, credit: tot }] });
    L.forEach(function (b) { b.paye = true; b.paye_le = d; b.paye_mode = mode; b.pay_id = pid; });
    (pa.paiements = pa.paiements || []).push({ id: pid, date: d, mode: mode, montant: tot, nb: L.length, entry_id: id, par: H.user() }); log("Salaires payés", libMois(mois) + " " + fcfa(tot) + " (" + mode + ")");
    return tot;
  }
  function annulerPaiement(mois, pid, motif) {
    need("x"); var pa = paieDe(mois), p = pa && (pa.paiements || []).filter(function (x) { return x.id === pid && !x.annule; })[0];
    if (!p) throw new Error("Paiement introuvable ou déjà annulé."); if (String(motif || "").trim().length < 5) throw new Error("Motif obligatoire (5 caractères minimum).");
    H.compta.extourner(p.entry_id, "Annulation paiement des salaires " + libMois(mois) + " — " + String(motif).trim());
    pa.bulletins.forEach(function (b) { if (b.pay_id === pid) { b.paye = false; delete b.paye_le; delete b.paye_mode; delete b.pay_id; } });
    p.annule = { par: H.user(), le: new Date().toISOString(), motif: String(motif).trim() }; log("Paiement de salaires annulé", libMois(mois) + " " + fcfa(p.montant) + " — " + motif);
  }
  function annulerReversement(rid, motif) {
    need("x"); var r = rh(), v = by(r.reversements, rid); if (!v || v.annule) throw new Error("Reversement introuvable ou déjà annulé."); if (String(motif || "").trim().length < 5) throw new Error("Motif obligatoire (5 caractères minimum).");
    H.compta.extourner(v.entry_id, "Annulation reversement " + ORGS[v.org][0] + " " + libMois(v.mois) + " — " + String(motif).trim());
    v.annule = { par: H.user(), le: new Date().toISOString(), motif: String(motif).trim() }; log("Reversement annulé", ORGS[v.org][0] + " " + libMois(v.mois) + " " + fcfa(v.montant) + " — " + motif);
  }
  function dus(mois) { /* cotisations dues pour un mois validé */
    var pa = paieDe(mois); if (!pa || pa.statut === "brouillon") return { cnps: 0, its: 0, fdfp: 0 };
    return { cnps: sum(pa.bulletins, function (b) { return cnpsTotal(b.calc); }), its: sum(pa.bulletins, function (b) { return b.calc.its + b.calc.itsPat; }), fdfp: sum(pa.bulletins, function (b) { return fdfpTotal(b.calc); }) };
  }
  var ORGS = { cnps: ["CNPS et CMU", "paie_cnps"], its: ["ITS (impôt sur traitements et salaires)", "paie_its"], fdfp: ["FDFP (apprentissage et formation continue)", "paie_fdfp"] };
  function reverse(mois, org, mode, date) {
    need("c"); if (!ORGS[org]) throw new Error("Organisme inconnu."); var r = rh(), d = date || today(); if (d > today()) throw new Error("Date dans le futur.");
    if (!MODES.some(function (x) { return x[0] === mode; })) throw new Error("Mode de règlement invalide.");
    var pr = paieDe(mois); if (pr && pr.date && d < pr.date) throw new Error("Date antérieure à la paie de " + libMois(mois) + " (" + fd(pr.date) + ").");
    var du = dus(mois)[org], paye = sum(r.reversements.filter(function (x) { return x.mois === mois && x.org === org && !x.annule; }), function (x) { return x.montant; }), reste = du - paye;
    if (!(reste > 0)) throw new Error("Rien à reverser pour " + ORGS[org][0] + " sur " + libMois(mois) + ".");
    var C = H.compta.comptes(), rid = uid("rv"), t = H.compta.treso(mode, reste, "sortie", ORGS[org][0] + " " + mois, { type: "rh_reversement", id: rid });
    var id = H.compta.poster({ journal: t.journal, date: d, libelle: "Reversement " + ORGS[org][0] + " — " + libMois(mois), piece: org.toUpperCase() + "-" + mois, source: { type: "rh_reversement", id: rid }, lines: [{ compte: C[ORGS[org][1]], debit: reste }, { compte: t.compte, credit: reste }] });
    r.reversements.push({ id: rid, mois: mois, org: org, montant: reste, date: d, mode: mode, entry_id: id, par: H.user() }); log("Cotisations reversées", ORGS[org][0] + " " + libMois(mois) + " " + fcfa(reste)); return reste;
  }
  function octroyerAvance(f) {
    need("c"); var r = rh(), e = by(r.employes, f.emp_id); if (!e || !empActif(e)) throw new Error("Employé introuvable ou sorti.");
    var m = R(+f.montant), d = f.date || today(); if (!(m > 0)) throw new Error("Montant invalide."); if (d > today()) throw new Error("Date dans le futur.");
    var ret = R(+f.retenue || 0); if (ret < 0 || ret > m) throw new Error("Retenue mensuelle : entre 0 et le montant de l'avance."); if (!f.motif || !String(f.motif).trim()) throw new Error("Motif obligatoire.");
    if (!MODES.some(function (x) { return x[0] === f.mode; })) throw new Error("Mode de règlement invalide.");
    var C = H.compta.comptes(), aid = uid("av"), t = H.compta.treso(f.mode, m, "sortie", "Avance " + empNom(e), { type: "rh_avance", id: aid });
    var id = H.compta.poster({ journal: t.journal, date: d, libelle: "Avance sur salaire — " + empNom(e), piece: "AV-" + (e.mat || ""), source: { type: "rh_avance", id: aid }, lines: [{ compte: C.paie_avances, debit: m }, { compte: t.compte, credit: m }] });
    r.avances.push({ id: aid, emp_id: e.id, date: d, montant: m, reste: m, retenue: ret || m, motif: String(f.motif).trim(), mode: f.mode, entry_id: id, par: H.user() }); log("Avance accordée", empNom(e) + " " + fcfa(m));
  }

  /* ---------- Employés, contrats, congés ---------- */
  function matricule(r) { var n = seq("mat"); return (H.matPrefixe || "EMP") + "-" + String(n).padStart(4, "0"); }
  function saveEmploye(f) {
    need(f.id ? "e" : "c"); var r = rh(), p = P();
    var nom = String(f.nom || "").trim().replace(/\s+/g, " "); if (!nom) throw new Error("Nom obligatoire.");
    if (!f.embauche) throw new Error("Date d'embauche obligatoire."); if (f.embauche > addJ(today(), 366)) throw new Error("Date d'embauche invalide.");
    if (!TYPES_CTR.some(function (x) { return x[0] === f.contrat; })) throw new Error("Type de contrat invalide.");
    var sb = R(+f.sal_base); if (!(sb > 0)) throw new Error("Salaire de base obligatoire."); if (sb < p.smig && f.contrat !== "stage" && f.contrat !== "prestataire" && !f.derog_smig) throw new Error("Salaire de base inférieur au SMIG (" + fcfa(p.smig) + ") : cochez la dérogation pour l'enregistrer.");
    if (f.contrat === "CDD" && !f.fin_contrat) throw new Error("Date de fin obligatoire pour un CDD."); if (f.fin_contrat && f.fin_contrat < f.embauche) throw new Error("Fin de contrat antérieure à l'embauche.");
    if (f.naissance && f.naissance > today()) throw new Error("Date de naissance invalide.");
    if (f.tel && String(f.tel).replace(/\D/g, "").length < 8) throw new Error("Téléphone invalide.");
    ["sursalaire", "transport", "logement", "primes"].forEach(function (k) { if (f[k] !== "" && f[k] != null && !(+f[k] >= 0)) throw new Error("Montant invalide : " + k + " (positif ou nul)."); });
    if (f.anc_taux !== "" && f.anc_taux != null && !(+f.anc_taux >= 0 && +f.anc_taux <= 25)) throw new Error("Taux d'ancienneté : entre 0 et 25 %.");
    var declare = f.declare !== "non" && f.declare !== false; if (declare && !String(f.cnps_no || "").trim() && f.id === undefined && false) throw new Error("N° CNPS requis.");
    var o = { nom: nom, prenoms: String(f.prenoms || "").trim(), sexe: f.sexe || "", naissance: f.naissance || "", cni: String(f.cni || "").trim(), tel: String(f.tel || "").trim(), adresse: String(f.adresse || "").trim(),
      poste: String(f.poste || "").trim(), categorie: String(f.categorie || "").trim(), dept: String(f.dept || "").trim(), act: String(f.act || ""), embauche: f.embauche, contrat: f.contrat, fin_contrat: f.fin_contrat || "",
      sal_base: sb, sursalaire: R(+f.sursalaire || 0), transport: R(+f.transport || 0), logement: R(+f.logement || 0), primes: R(+f.primes || 0), parts: Math.max(1, +f.parts || 1), cmu_pers: Math.max(1, Math.floor(+f.cmu_pers || 1)),
      cnps_no: String(f.cnps_no || "").trim(), declare: declare, mode_paie: MODES.some(function (m) { return m[0] === f.mode_paie; }) ? f.mode_paie : "banque", compte_paie: String(f.compte_paie || "").trim(),
      anc_auto: f.anc_auto !== "non" && f.anc_auto !== false, anc_taux: +f.anc_taux || 0, ref_ext: String(f.ref_ext || "") };
    if (f.id) {
      var e = by(r.employes, f.id); if (!e) throw new Error("Employé introuvable.");
      if (e.sal_base !== o.sal_base || e.sursalaire !== o.sursalaire) { if (r.paies.some(function (x) { return x.statut !== "brouillon" && x.mois >= moisCle(f.effet || today()); })) { /* historique conservé */ } (e.historique = e.historique || []).push({ from: f.effet || today(), sal_base: o.sal_base, sursalaire: o.sursalaire, motif: f.motif_sal || "Modification", par: H.user(), at: new Date().toISOString() }); }
      Object.assign(e, o); log("Employé modifié", empNom(e)); return e;
    }
    if (r.employes.some(function (x) { return x.nom.toLowerCase() === nom.toLowerCase() && (x.prenoms || "").toLowerCase() === o.prenoms.toLowerCase() && x.naissance === o.naissance && empActif(x); })) throw new Error("Cet employé existe déjà.");
    var e2 = Object.assign({ id: uid("emp"), mat: matricule(r), historique: [{ from: o.embauche, sal_base: o.sal_base, sursalaire: o.sursalaire, motif: "Embauche", par: H.user(), at: new Date().toISOString() }], par: H.user(), t: new Date().toISOString() }, o);
    r.employes.push(e2); log("Employé créé", empNom(e2) + " (" + e2.mat + ")"); return e2;
  }
  function sortieEmploye(id, date, motif) {
    need("e"); var r = rh(), e = by(r.employes, id); if (!e || !empActif(e)) throw new Error("Employé introuvable ou déjà sorti.");
    if (!date || date < e.embauche) throw new Error("Date de sortie antérieure à l'embauche."); if (date > addJ(today(), 90)) throw new Error("Date de sortie trop éloignée.");
    if (String(motif || "").trim().length < 3) throw new Error("Motif de sortie obligatoire.");
    if (r.paies.some(function (x) { return x.statut !== "brouillon" && x.mois > moisCle(date); })) throw new Error("Une paie postérieure à la sortie est déjà validée.");
    e.sortie = { date: date, motif: String(motif).trim(), par: H.user() }; log("Sortie d'employé", empNom(e) + " le " + date + " — " + motif);
  }
  function reintegrer(id) { need("a"); var e = by(rh().employes, id); if (!e || empActif(e)) throw new Error("Employé actif."); delete e.sortie; log("Employé réintégré", empNom(e)); }
  function soldeConges(e, au) {
    var d = au || today(), mois = Math.max(0, diffJ(d, e.embauche) / 30.4375), acquis = R(mois * P().congeParMois * 10) / 10;
    var pris = sum(rh().conges.filter(function (c) { return c.emp_id === e.id && c.type === "annuel" && c.statut === "approuve"; }), function (c) { return c.jours; });
    var att = sum(rh().conges.filter(function (c) { return c.emp_id === e.id && c.type === "annuel" && c.statut === "demande"; }), function (c) { return c.jours; });
    return { acquis: acquis, pris: pris, attente: att, reste: R((acquis - pris) * 10) / 10, dispo: R((acquis - pris - att) * 10) / 10 };
  }
  function demandeConge(f) {
    need("c"); var r = rh(), e = by(r.employes, f.emp_id); if (!e || !empActif(e)) throw new Error("Employé introuvable ou sorti.");
    if (!TYPES_CONGE.some(function (t) { return t[0] === f.type; })) throw new Error("Type de congé invalide."); if (!f.debut || !f.fin || f.fin < f.debut) throw new Error("Période invalide.");
    var j = diffJ(f.fin, f.debut) + 1; if (j > 366) throw new Error("Période trop longue.");
    if (r.conges.some(function (c) { return c.emp_id === e.id && c.statut !== "refuse" && c.statut !== "annule" && !(f.fin < c.debut || f.debut > c.fin); })) throw new Error("Une autre demande couvre déjà cette période.");
    if (f.type === "annuel" && j > soldeConges(e, f.fin).dispo + 0.001) throw new Error("Solde de congés insuffisant (" + soldeConges(e, f.fin).dispo + " jour(s) disponibles, demandes en attente déduites).");
    var c = { id: uid("cg"), emp_id: e.id, type: f.type, debut: f.debut, fin: f.fin, jours: j, statut: "demande", motif: String(f.motif || "").trim(), par: H.user(), at: new Date().toISOString() }; r.conges.push(c); log("Demande de congé", empNom(e) + " " + j + " j"); return c;
  }
  function decideConge(id, ok, motif) {
    need("a"); var c = by(rh().conges, id); if (!c || c.statut !== "demande") throw new Error("Demande introuvable ou déjà traitée.");
    if (!ok && String(motif || "").trim().length < 3) throw new Error("Motif du refus obligatoire.");
    if (ok && c.type === "annuel") { var ee = by(rh().employes, c.emp_id), sc = ee && soldeConges(ee, c.fin); if (sc && c.jours > sc.reste + 0.001) throw new Error("Solde de congés insuffisant à l'approbation (" + sc.reste + " jour(s))."); } c.statut = ok ? "approuve" : "refuse"; c.decide_par = H.user(); c.decide_le = new Date().toISOString(); if (!ok) c.refus = String(motif).trim();
    log(ok ? "Congé approuvé" : "Congé refusé", empNom(by(rh().employes, c.emp_id) || {}) + " " + c.debut);
  }
  function setVariable(mois, f) {
    need("e"); var r = rh(), pa = paieDe(mois); if (pa && pa.statut !== "brouillon") throw new Error("Paie validée : variables verrouillées.");
    var e = by(r.employes, f.emp_id); if (!e) throw new Error("Employé introuvable."); var n = function (x) { return Math.max(0, R(+x || 0)); };
    if ((+f.abs || 0) < 0 || (+f.abs || 0) > 30) throw new Error("Jours d'absence : entre 0 et 30.");
    var v = r.variables.filter(function (x) { return x.mois === mois && x.emp_id === f.emp_id; })[0]; if (!v) { v = { id: uid("va"), mois: mois, emp_id: f.emp_id }; r.variables.push(v); }
    v.abs = +f.abs || 0; v.hs = n(f.hs); v.primes = n(f.primes); v.retenues = n(f.retenues); v.avance = f.avance === "" || f.avance == null ? null : n(f.avance); v.note = String(f.note || "").trim(); log("Variables de paie", empNom(e) + " " + mois);
  }

  /* ---------- Synthèse (publiée pour le consolidé du groupe) ---------- */
  function resume() {
    var r = rh(), m = moisCle(today()), pa = r.paies.filter(function (x) { return x.statut !== "brouillon"; }).sort(function (a, b) { return b.mois.localeCompare(a.mois); })[0];
    var du = 0, paye = 0; r.paies.forEach(function (x) { if (x.statut === "brouillon") return; var d = dus(x.mois); du += d.cnps + d.its + d.fdfp; }); paye = sum(r.reversements.filter(function (x) { return !x.annule; }), function (x) { return x.montant; });
    var annee = m.slice(0, 4), an = r.paies.filter(function (x) { return x.statut !== "brouillon" && x.mois.slice(0, 4) === annee; });
    return { t: new Date().toISOString(), division: H.division, effectif: r.employes.filter(empActif).length, dernier_mois: pa ? pa.mois : "", brut_mois: pa ? sum(pa.bulletins, function (b) { return b.calc.brut; }) : 0, net_mois: pa ? sum(pa.bulletins, function (b) { return b.calc.net; }) : 0,
      cout_mois: pa ? sum(pa.bulletins, function (b) { return b.calc.cout; }) : 0, brut_annee: sum(an, function (x) { return sum(x.bulletins, function (b) { return b.calc.brut; }); }), cout_annee: sum(an, function (x) { return sum(x.bulletins, function (b) { return b.calc.cout; }); }),
      charges_dues: Math.max(0, du - paye), conges_en_cours: r.conges.filter(function (c) { return c.statut === "approuve" && c.debut <= today() && c.fin >= today(); }).length };
  }
  function publier() { try { localStorage.setItem("angels_rh_" + H.division, JSON.stringify(resume())); } catch (e) { } }

  /* ---------- Alertes ---------- */
  function alertes() {
    var r = rh(), p = P(), t = today(), A = [], m = moisCle(t);
    r.employes.filter(empActif).forEach(function (e) {
      var n = empNom(e);
      if (e.declare !== false && !e.cnps_no) A.push({ k: "wa", m: n + " : n° CNPS non renseigné." });
      if (e.declare === false) A.push({ k: "wa", m: n + " : non déclaré à la CNPS (aucune cotisation sociale : à régulariser)." });
      if (e.sal_base < p.smig && e.contrat !== "stage" && e.contrat !== "prestataire") A.push({ k: "er", m: n + " : salaire de base inférieur au SMIG." });
      if (e.contrat === "CDD" && e.fin_contrat) { var j = diffJ(e.fin_contrat, t); if (j < 0) A.push({ k: "er", m: n + " : CDD échu depuis le " + fd(e.fin_contrat) + " (renouveler ou clôturer)." }); else if (j <= 30) A.push({ k: "wa", m: n + " : CDD échu dans " + j + " jour(s) (" + fd(e.fin_contrat) + ")." }); }
      if (!e.tel) A.push({ k: "wa", m: n + " : téléphone manquant." });
    });
    var pm = paieDe(m); var prev = (function () { var d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 2, 1)); return d.toISOString().slice(0, 7); })();
    if (r.employes.some(empActif) && (!paieDe(prev) || paieDe(prev).statut === "brouillon") && r.employes.some(function (e) { return empPresent(e, prev); })) A.push({ k: "wa", m: "Paie de " + libMois(prev) + " non validée." });
    r.paies.filter(function (x) { return x.statut !== "brouillon"; }).forEach(function (x) {
      var imp = x.bulletins.filter(function (b) { return !b.paye && b.calc.net > 0; }).length; if (imp) A.push({ k: "wa", m: "Paie " + libMois(x.mois) + " : " + imp + " salaire(s) à payer." });
      ["cnps", "its", "fdfp"].forEach(function (o) { var d = dus(x.mois)[o], pay = sum(r.reversements.filter(function (y) { return y.mois === x.mois && y.org === o && !y.annule; }), function (y) { return y.montant; }); if (d - pay > 0 && t > addJ(dernierJour(x.mois), 15)) A.push({ k: "er", m: ORGS[o][0] + " " + libMois(x.mois) + " : " + fcfa(d - pay) + " à reverser (échéance dépassée)." }); });
    });
    r.conges.filter(function (c) { return c.statut === "demande"; }).forEach(function (c) { A.push({ k: "wa", m: "Demande de congé à traiter : " + empNom(by(r.employes, c.emp_id) || {}) + " du " + fd(c.debut) + " au " + fd(c.fin) + "." }); });
    return A;
  }

  /* ---------- Interface ---------- */
  var CSS = ".rh-t{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.rh-t button{font:inherit;padding:7px 12px;border-radius:99px;border:1px solid var(--bd,#d5dbe3);background:var(--card,#fff);color:var(--tx,#1c2430);cursor:pointer}.rh-t button.on{background:var(--b2,#1f3a5f);color:#fff;border-color:var(--b2,#1f3a5f)}" +
    ".rh-ov{position:fixed;inset:0;background:rgba(15,20,28,.6);z-index:9990;display:flex;align-items:center;justify-content:center;padding:12px}.rh-bx{background:var(--card,#fff);color:var(--tx,#1c2430);border-radius:14px;width:100%;max-width:640px;max-height:92vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.4)}" +
    ".rh-bx h3{margin:0 0 10px}.rh-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.rh-g label{display:block;font-size:13px;color:var(--mu,#5b6572)}.rh-g input,.rh-g select,.rh-g textarea{width:100%;font:inherit;padding:8px;border:1px solid var(--bd,#d5dbe3);border-radius:8px;background:var(--bg,#fff);color:var(--tx,#1c2430);margin-top:3px}" +
    ".rh-g .full{grid-column:1/-1}.rh-g .sec{grid-column:1/-1;font-weight:700;margin-top:6px;border-bottom:1px solid var(--bd,#d5dbe3)}.rh-f{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}.rh-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}" +
    ".rh-k div{border:1px solid var(--bd,#d5dbe3);border-radius:10px;padding:9px 11px;background:var(--card,#fff)}.rh-k b{display:block;font-size:17px}.rh-k span{font-size:12px;color:var(--mu,#5b6572)}.rh-al{border-left:4px solid #b26a00;background:rgba(178,106,0,.1);padding:7px 10px;margin:5px 0;border-radius:6px;font-size:14px}.rh-al.er{border-color:#b3261e;background:rgba(179,38,30,.1)}" +
    ".rh-w select,.rh-w input:not([type=checkbox]){width:auto;max-width:100%}.rh-n{background:var(--card,#fff);border:1px solid var(--bd,#d5dbe3);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:13px;color:var(--mu,#5b6572)}.rh-w{overflow:auto}.rh-w table{width:100%;border-collapse:collapse;font-size:13px}.rh-w th,.rh-w td{border-bottom:1px solid var(--bd,#d5dbe3);padding:6px 8px;text-align:left;vertical-align:top;white-space:nowrap}.rh-w th{font-size:12px;color:var(--mu,#5b6572)}" +
    ".rh-b{font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid var(--bd,#d5dbe3);background:var(--card,#fff);color:var(--tx,#1c2430);cursor:pointer}.rh-b.p{background:var(--b2,#1f3a5f);color:#fff;border-color:var(--b2,#1f3a5f)}.rh-b.er{color:#b3261e;border-color:#b3261e}.rh-b.ok{background:#1f8a4c;color:#fff;border-color:#1f8a4c}.rh-bd{display:inline-block;border-radius:99px;padding:1px 8px;font-size:12px;border:1px solid var(--bd,#d5dbe3)}.rh-bd.ok{border-color:#1f8a4c;color:#1f8a4c}.rh-bd.wa{border-color:#b26a00;color:#b26a00}.rh-bd.er{border-color:#b3261e;color:#b3261e}";
  function css() { if (document.getElementById("rh-css")) return; var s = document.createElement("style"); s.id = "rh-css"; s.textContent = CSS; document.head.appendChild(s); }
  var TABS = [["tableau", "Tableau de bord"], ["employes", "Employés"], ["conges", "Congés"], ["paie", "Paie du mois"], ["charges", "Cotisations"], ["livre", "Livre de paie"], ["params", "Paramètres de paie"]];
  var UIS = { tab: "tableau", mois: moisCle(today()), q: "", inactifs: false };
  var kpi = function (v, l) { return "<div><b>" + v + "</b><span>" + esc(l) + "</span></div>"; };
  var bd = function (t, c) { return '<span class="rh-bd ' + (c || "") + '">' + esc(t) + "</span>"; };
  var btn = function (a, id, l, c, x) { return '<button type="button" class="rh-b ' + (c || "") + '" data-rh="' + a + '" data-id="' + esc(id == null ? "" : id) + '" ' + (x || "") + ">" + l + "</button>"; };
  var tbl = function (cols, rows, empty) { return '<div class="rh-w"><table><thead><tr>' + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + (rows.length ? rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") : '<tr><td colspan="' + cols.length + '" style="color:var(--mu,#5b6572)">' + esc(empty || "Aucune donnée.") + "</td></tr>") + "</tbody></table></div>"; };
  var moisOpts = function (sel) { var o = [], d = new Date(); d.setUTCDate(1); for (var i = 0; i < 24; i++) { var k = d.toISOString().slice(0, 7); o.push('<option value="' + k + '" ' + (k === sel ? "selected" : "") + ">" + esc(libMois(k)) + "</option>"); d.setUTCMonth(d.getUTCMonth() - 1); } return o.join(""); };

  function vTableau() {
    var r = rh(), s = resume(), A = alertes(), act = r.employes.filter(empActif);
    return '<div class="rh-k">' + kpi(act.length, "Effectif actif") + kpi(fcfa(s.brut_mois), "Masse salariale brute (" + (s.dernier_mois ? libMois(s.dernier_mois) : "—") + ")") + kpi(fcfa(s.net_mois), "Net à payer (dernière paie)") + kpi(fcfa(s.cout_mois), "Coût total employeur") + kpi(fcfa(s.charges_dues), "Cotisations à reverser") + kpi(s.conges_en_cours, "Salariés en congé aujourd'hui") + "</div>" +
      "<h3>Alertes (" + A.length + ")</h3>" + (A.length ? A.slice(0, 60).map(function (a) { return '<div class="rh-al ' + (a.k === "er" ? "er" : "") + '">' + esc(a.m) + "</div>"; }).join("") : '<div class="rh-n">Aucune alerte.</div>') +
      '<div class="rh-n">Comptabilité : la validation de la paie génère l\'écriture (charges 661 / 664 ; dettes 422, 4313 CNPS, 447 ITS et FDFP, 4211 avances), le paiement des salaires et le reversement des cotisations sont comptabilisés dans la comptabilité de cette application.</div>';
  }
  function vEmployes() {
    var r = rh(), q = (UIS.q || "").toLowerCase(), L = r.employes.filter(function (e) { return (UIS.inactifs || empActif(e)) && (!q || (empNom(e) + " " + e.mat + " " + e.poste).toLowerCase().indexOf(q) >= 0); });
    return '<div class="rh-w" style="margin-bottom:8px"><input data-rh-q="1" placeholder="Rechercher…" value="' + esc(UIS.q) + '" style="padding:7px;border:1px solid var(--bd,#d5dbe3);border-radius:8px;background:var(--bg,#fff);color:var(--tx,#1c2430)"> <label style="font-size:13px"><input type="checkbox" data-rh-inact="1" ' + (UIS.inactifs ? "checked" : "") + "> Afficher les sortis</label> " + (H.can("c") ? btn("emp.add", "", "+ Employé", "p") : "") + (H.can("p") ? btn("csv", "employes", "CSV") : "") + "</div>" +
      tbl(["Matricule", "Nom", "Poste", "Contrat", "Embauche", "Salaire de base", "CNPS", "Avance due", "Statut", ""], L.map(function (e) {
        return [esc(e.mat), "<b>" + esc(empNom(e)) + "</b>", esc(e.poste || "—"), esc(e.contrat) + (e.fin_contrat ? "<br><small>fin " + fd(e.fin_contrat) + "</small>" : ""), fd(e.embauche), fcfa(e.sal_base + (e.sursalaire || 0)), e.declare === false ? bd("non déclaré", "wa") : (e.cnps_no ? esc(e.cnps_no) : bd("n° manquant", "wa")), avanceDue(e.id) ? fcfa(avanceDue(e.id)) : "—", empActif(e) ? bd("actif", "ok") : bd("sorti " + fd(e.sortie.date)),
          btn("emp.fiche", e.id, "Fiche") + (H.can("e") && empActif(e) ? btn("emp.edit", e.id, "Modifier") : "")];
      }), "Aucun employé : créez la première fiche.");
  }
  function vFiche(e) {
    var sc = soldeConges(e), h = (e.historique || []).slice().reverse();
    return '<div class="rh-w" style="margin:8px 0">' + btn("back", "", "← Employés") + btn("doc.contrat", e.id, "Contrat de travail") + btn("doc.attestation", e.id, "Attestation de travail") + (empActif(e) ? "" : btn("doc.certificat", e.id, "Certificat de travail")) + (H.can("c") && empActif(e) ? btn("av.add", e.id, "Avance sur salaire") : "") + (H.can("e") && empActif(e) ? btn("emp.sortie", e.id, "Enregistrer la sortie", "er") : "") + (H.can("a") && !empActif(e) ? btn("emp.reint", e.id, "Réintégrer") : "") + "</div>" +
      "<h3>" + esc(empNom(e)) + " — " + esc(e.mat) + "</h3><div class=\"rh-k\">" + kpi(fcfa(e.sal_base + (e.sursalaire || 0)), "Salaire (base + sursalaire)") + kpi(sc.reste + " j", "Congés disponibles (" + sc.acquis + " acquis, " + sc.pris + " pris)") + kpi(avanceDue(e.id) ? fcfa(avanceDue(e.id)) : "0 F", "Avances à récupérer") + kpi(e.parts, "Parts fiscales") + "</div>" +
      "<p>" + esc(e.poste || "") + " · " + esc(e.contrat) + " depuis le " + fd(e.embauche) + (e.fin_contrat ? " jusqu'au " + fd(e.fin_contrat) : "") + " · " + esc(e.tel || "pas de téléphone") + (e.cni ? " · CNI " + esc(e.cni) : "") + "</p>" +
      "<h3>Historique de rémunération</h3>" + tbl(["Effet", "Base", "Sursalaire", "Motif", "Par"], h.map(function (x) { return [fd(x.from), fcfa(x.sal_base), fcfa(x.sursalaire), esc(x.motif), esc(x.par)]; })) +
      "<h3>Bulletins</h3>" + tbl(["Mois", "N°", "Brut", "Retenues", "Net", "Payé", ""], rh().paies.filter(function (p) { return p.statut !== "brouillon"; }).sort(function (a, b) { return b.mois.localeCompare(a.mois); }).map(function (p) { var b = p.bulletins.filter(function (x) { return x.emp_id === e.id; })[0]; return b ? [esc(libMois(p.mois)), esc(b.no), fcfa(b.calc.brut), fcfa(b.calc.totalRetenues), "<b>" + fcfa(b.calc.net) + "</b>", b.paye ? bd("payé " + fd(b.paye_le), "ok") : bd("à payer", "wa"), btn("bul", p.mois + "|" + e.id, "Bulletin")] : null; }).filter(Boolean), "Aucun bulletin.");
  }
  function vConges() {
    var r = rh(), ST = { demande: ["à traiter", "wa"], approuve: ["approuvé", "ok"], refuse: ["refusé", "er"], annule: ["annulé", ""] };
    return (H.can("c") ? '<div style="margin-bottom:8px">' + btn("cg.add", "", "+ Demande de congé", "p") + "</div>" : "") +
      tbl(["Employé", "Type", "Du", "Au", "Jours", "Statut", "Motif", ""], r.conges.slice().reverse().map(function (c) { var e = by(r.employes, c.emp_id) || {}, s = ST[c.statut] || [c.statut, ""]; return [esc(empNom(e)), esc((TYPES_CONGE.filter(function (t) { return t[0] === c.type; })[0] || [0, c.type])[1]), fd(c.debut), fd(c.fin), c.jours, bd(s[0], s[1]), esc(c.refus || c.motif || ""), c.statut === "demande" && H.can("a") ? btn("cg.ok", c.id, "Approuver", "ok") + btn("cg.no", c.id, "Refuser", "er") : ""]; }), "Aucune demande de congé.") +
      "<h3>Soldes de congés annuels</h3>" + tbl(["Employé", "Acquis", "Pris", "Disponible"], r.employes.filter(empActif).map(function (e) { var s = soldeConges(e); return [esc(empNom(e)), s.acquis + " j", s.pris + " j", "<b>" + s.reste + " j</b>"]; }));
  }
  function vPaie() {
    var r = rh(), m = UIS.mois, pa = paieDe(m), B = pa ? pa.bulletins : [], val = pa && pa.statut !== "brouillon";
    var tot = function (f) { return sum(B, function (b) { return f(b.calc); }); };
    var bar = '<div class="rh-w" style="margin:8px 0"><select data-rh-mois="1" style="padding:7px;border-radius:8px;border:1px solid var(--bd,#d5dbe3);background:var(--bg,#fff);color:var(--tx,#1c2430)">' + moisOpts(m) + "</select> " +
      (!val && H.can("c") ? btn("p.calc", m, B.length ? "Recalculer" : "Calculer la paie", "p") : "") + (!val && B.length && H.can("a") ? btn("p.val", m, "Valider la paie", "ok") : "") + (val && H.can("c") && B.some(function (b) { return !b.paye && b.calc.net > 0; }) ? btn("p.pay", m, "Payer les salaires", "ok") : "") + (val && H.can("x") ? btn("p.annul", m, "Annuler la validation", "er") : "") + (B.length ? btn("p.livre", m, "Livre de paie (imprimer)") + (H.can("p") ? btn("csv", "paie|" + m, "CSV") : "") : "") + "</div>";
    var k = B.length ? '<div class="rh-k">' + kpi(B.length, "Bulletins") + kpi(fcfa(tot(function (c) { return c.brut; })), "Brut total") + kpi(fcfa(tot(function (c) { return c.totalRetenues; })), "Retenues salariales") + kpi(fcfa(tot(function (c) { return c.net; })), "Net à payer") + kpi(fcfa(tot(function (c) { return c.totalPatronal; })), "Charges patronales") + kpi(fcfa(tot(function (c) { return c.cout; })), "Coût employeur") + "</div>" : "";
    var emps = r.employes.filter(function (e) { return empPresent(e, m); });
    var rows = val || B.length ? B.map(function (b) { var c = b.calc; return [esc(b.mat), "<b>" + esc(b.nom) + "</b>", c.jours + " j", fcfa(c.brut), fcfa(c.cnpsSal + c.cmuSal), fcfa(c.its), fcfa(c.avance + c.retenues), "<b>" + fcfa(c.net) + "</b>", val ? (b.paye ? bd("payé", "ok") : bd("à payer", "wa")) : "", btn("bul", m + "|" + b.emp_id, "Bulletin") + (!val && H.can("e") ? btn("p.var", m + "|" + b.emp_id, "Variables") : "")]; }) : emps.map(function (e) { return [esc(e.mat), "<b>" + esc(empNom(e)) + "</b>", "—", "—", "—", "—", "—", "—", "", !val && H.can("e") ? btn("p.var", m + "|" + e.id, "Variables") : ""]; });
    return bar + (pa && pa.statut === "brouillon" && pa.annulee ? '<div class="rh-al">Validation annulée le ' + fd(pa.annulee.le) + " : " + esc(pa.annulee.motif) + "</div>" : "") + (val ? '<div class="rh-n">Paie ' + esc(libMois(m)) + " validée par " + esc(pa.valide_par) + " le " + fd(pa.valide_le) + " — écriture comptable générée.</div>" : '<div class="rh-n">Brouillon : saisissez les variables du mois (absences, heures supplémentaires, primes, retenues, avance à récupérer) puis calculez et validez.</div>') + k + payList(pa, m) + tbl(["Matricule", "Employé", "Jours payés", "Brut", "CNPS + CMU", "ITS", "Avances et retenues", "Net", "Statut", ""], rows, "Aucun employé actif sur ce mois.");
  }
  function payList(pa, m) {
    var L = pa && pa.statut !== "brouillon" ? (pa.paiements || []) : []; if (!L.length) return "";
    return '<div class="rh-n"><b>Paiements des salaires</b><br>' + L.map(function (p) { return esc(fd(p.date)) + " — " + fcfa(p.montant) + " (" + p.nb + " salarié(s), " + esc(p.mode) + ")" + (p.annule ? " — annulé : " + esc(p.annule.motif) : (H.can("x") ? " " + btn("p.annulpay", m + "|" + p.id, "Annuler", "er") : "")); }).join("<br>") + "</div>";
  }
  function vCharges() {
    var r = rh(), L = r.paies.filter(function (p) { return p.statut !== "brouillon"; }).sort(function (a, b) { return b.mois.localeCompare(a.mois); }), rows = [];
    L.forEach(function (p) { Object.keys(ORGS).forEach(function (o) { var d = dus(p.mois)[o], pay = sum(r.reversements.filter(function (x) { return x.mois === p.mois && x.org === o && !x.annule; }), function (x) { return x.montant; }); rows.push([esc(libMois(p.mois)), esc(ORGS[o][0]), fcfa(d), fcfa(pay), d - pay > 0 ? "<b>" + fcfa(d - pay) + "</b>" : bd("soldé", "ok"), (d - pay > 0 && H.can("c") ? btn("rv", p.mois + "|" + o, "Reverser") : "") + (H.can("p") && o !== "fdfp" ? btn("csv", "decl|" + p.mois + "|" + o, "CSV") : "")]); }); });
    var rv = r.reversements.filter(function (x) { return !x.annule; }).slice().reverse().map(function (x) { return [esc(fd(x.date)), esc(libMois(x.mois)), esc(ORGS[x.org][0]), fcfa(x.montant), esc(x.mode), H.can("x") ? btn("rv.annul", x.id, "Annuler", "er") : ""]; });
    return '<div class="rh-n">Cotisations calculées à la validation de la paie : CNPS (retraite, prestations familiales, accident du travail) et CMU, ITS salarial et patronal, FDFP. Le reversement est comptabilisé (débit du compte de dette, crédit de la trésorerie).</div>' + tbl(["Mois", "Organisme", "Dû", "Reversé", "Reste", ""], rows, "Aucune paie validée.") + (rv.length ? "<h3>Reversements effectués</h3>" + tbl(["Date", "Mois", "Organisme", "Montant", "Mode", ""], rv, "") : "");
  }
  function vLivre() {
    var r = rh(), an = UIS.mois.slice(0, 4), L = r.paies.filter(function (p) { return p.statut !== "brouillon" && p.mois.slice(0, 4) === an; }).sort(function (a, b) { return a.mois.localeCompare(b.mois); });
    var rows = L.map(function (p) { var t = function (f) { return sum(p.bulletins, function (b) { return f(b.calc); }); }; return [esc(libMois(p.mois)), p.bulletins.length, fcfa(t(function (c) { return c.brut; })), fcfa(t(function (c) { return c.cnpsSal + c.cmuSal; })), fcfa(t(function (c) { return c.its; })), fcfa(t(function (c) { return c.net; })), fcfa(t(function (c) { return c.totalPatronal; })), "<b>" + fcfa(t(function (c) { return c.cout; })) + "</b>", btn("p.livre", p.mois, "Imprimer")]; });
    return '<div class="rh-w" style="margin-bottom:8px"><select data-rh-mois="1" style="padding:7px;border-radius:8px;border:1px solid var(--bd,#d5dbe3);background:var(--bg,#fff);color:var(--tx,#1c2430)">' + moisOpts(UIS.mois) + "</select> " + btn("p.annuel", an, "Récapitulatif annuel " + an + " (imprimer)") + "</div>" + tbl(["Mois", "Salariés", "Brut", "Retenues sociales", "ITS", "Net", "Charges patronales", "Coût total", ""], rows, "Aucune paie validée sur " + an + ".");
  }
  function vParams() {
    var p = P(), r = rh();
    return '<div class="rh-n">Barèmes et taux repris du module de paie de Menko : à valider avec votre expert-comptable avant la première paie réelle. Les modifications s\'appliquent aux paies non encore validées.</div><div class="rh-g">' + [["smig", "SMIG mensuel (F)"], ["tauxAT", "Taux accident du travail (ex. 0,02 à 0,05)"], ["cnpsSal", "CNPS retraite — part salariale"], ["cnpsPat", "CNPS retraite — part patronale"], ["tauxPF", "CNPS prestations familiales"], ["plafondRetraite", "Plafond mensuel retraite (F)"], ["plafondATPF", "Plafond AT et PF (F)"], ["itsPat", "ITS patronal"], ["fdfpTA", "FDFP — taxe d'apprentissage"], ["fdfpFC", "FDFP — formation continue"], ["fdfpRegul", "FDFP — régularisation"], ["cmuSal", "CMU salariale (F / personne)"], ["cmuPat", "CMU patronale (F / personne)"], ["transportExo", "Prime de transport exonérée (plafond, F)"], ["congeParMois", "Jours de congé acquis par mois"]].map(function (x) { return "<label>" + esc(x[1]) + '<input data-rh-par="' + x[0] + '" value="' + esc(p[x[0]]) + '" ' + (H.can("a") ? "" : "disabled") + "></label>"; }).join("") + "</div>" + (H.can("a") ? '<div class="rh-f">' + btn("par.save", "", "Enregistrer les paramètres", "p") + btn("par.reset", "", "Valeurs par défaut") + "</div>" : "") + "<h3>Barème ITS mensuel</h3>" + tbl(["De", "À", "Taux"], p.bareme.map(function (t) { return [fcfa(t[0]), t[1] > 1e12 ? "—" : fcfa(t[1]), (t[2] * 100).toFixed(0) + " %"]; })) + "<h3>Journal des opérations RH</h3>" + tbl(["Date", "Utilisateur", "Opération", "Détail"], r.historique.slice(0, 40).map(function (x) { return [fd(x.t), esc(x.u), esc(x.a), esc(x.d)]; }), "Aucune opération.");
  }
  function view(host) {
    H = host; css(); G.ANGELS_RH.host = host; if (H.migrer && H.can("v")) { try { H.migrer(rh()); } catch (e) { } } if (!H.can("v")) return '<div class="rh-n">Accès aux ressources humaines non autorisé pour votre profil.</div>';
    var body = UIS.fiche && by(rh().employes, UIS.fiche) ? vFiche(by(rh().employes, UIS.fiche)) : ({ tableau: vTableau, employes: vEmployes, conges: vConges, paie: vPaie, charges: vCharges, livre: vLivre, params: vParams }[UIS.tab] || vTableau)();
    return '<div class="rh-root"><div class="rh-t">' + TABS.map(function (t) { return '<button type="button" class="' + (UIS.tab === t[0] && !UIS.fiche ? "on" : "") + '" data-rh="tab" data-id="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" + body + "</div>";
  }

  /* ---------- Formulaires ---------- */
  function form(title, fields, init, onSave, ok) {
    var ov = document.createElement("div"); ov.className = "rh-ov";
    var f = fields.map(function (x) {
      var o = typeof x.o === "function" ? x.o() : x.o, sec = x.sec ? '<div class="sec">' + esc(x.sec) + "</div>" : "", v = init && init[x.k] != null ? init[x.k] : "", c = x.full || x.t === "area" ? ' class="full"' : "";
      var inp = x.t === "select" ? '<select name="' + x.k + '">' + o.map(function (y) { return '<option value="' + esc(y[0]) + '" ' + (String(y[0]) === String(v) ? "selected" : "") + ">" + esc(y[1]) + "</option>"; }).join("") + "</select>" : x.t === "area" ? '<textarea name="' + x.k + '" rows="2">' + esc(v) + "</textarea>" : '<input name="' + x.k + '" type="' + (x.t || "text") + '" ' + (x.t === "number" ? 'step="any"' : "") + ' value="' + esc(v) + '" autocomplete="off">';
      return sec + "<label" + c + ">" + esc(x.l) + (x.req ? " *" : "") + inp + (x.h ? '<small style="display:block;color:var(--mu,#5b6572)">' + esc(x.h) + "</small>" : "") + "</label>";
    }).join("");
    ov.innerHTML = '<div class="rh-bx" role="dialog"><h3>' + esc(title) + '</h3><form novalidate><div class="rh-g">' + f + '</div><div class="rh-f"><button type="button" class="rh-b" data-x="1">Annuler</button><button class="rh-b p">' + esc(ok || "Valider") + "</button></div></form></div>";
    document.body.appendChild(ov); var fm = ov.querySelector("form");
    ov.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () { ov.remove(); }; }); ov.onmousedown = function (e) { if (e.target === ov) ov.remove(); };
    fm.onsubmit = function (e) {
      e.preventDefault(); var o = {}, bad = null;
      fields.forEach(function (x) { var v = fm.elements[x.k].value.trim(); if (x.req && v === "" && !bad) bad = x.l + " requis."; o[x.k] = x.t === "number" ? (v === "" ? (x.blank ? "" : 0) : +v) : v; });
      if (bad) return alert(bad);
      var r = H.run(function () { return onSave(o); }); if (r !== false) { ov.remove(); after(); }
    };
    var f0 = fm.querySelector("input,select"); if (f0) f0.focus(); return ov;
  }
  function ask(title, label, cb, okl) { form(title, [{ k: "v", l: label, t: "area", req: 1, full: 1 }], {}, function (o) { return cb(o.v); }, okl || "Confirmer"); }
  function after() { publier(); H.render(); }
  var empOpts = function (act) { return rh().employes.filter(function (e) { return !act || empActif(e); }).map(function (e) { return [e.id, e.mat + " · " + empNom(e)]; }); };
  var OUINON = [["oui", "Oui"], ["non", "Non"]];
  function formEmploye(e) {
    var acts = H.acts ? H.acts() : null, F = [
      { k: "nom", l: "Nom", req: 1, sec: "Identité" }, { k: "prenoms", l: "Prénoms" }, { k: "sexe", l: "Sexe", t: "select", o: [["", "—"], ["M", "Masculin"], ["F", "Féminin"]] }, { k: "naissance", l: "Date de naissance", t: "date" }, { k: "cni", l: "N° CNI / pièce" }, { k: "tel", l: "Téléphone" }, { k: "adresse", l: "Adresse", full: 1 },
      { k: "poste", l: "Poste / fonction", sec: "Emploi" }, { k: "categorie", l: "Catégorie (grille)" }, { k: "dept", l: "Service / département" }, { k: "contrat", l: "Type de contrat", t: "select", o: TYPES_CTR }, { k: "embauche", l: "Date d'embauche", t: "date", req: 1 }, { k: "fin_contrat", l: "Fin de contrat (CDD)", t: "date" }].concat(acts ? [{ k: "act", l: "Activité (comptabilité analytique)", t: "select", o: acts }] : []).concat([
      { k: "sal_base", l: "Salaire de base mensuel (F)", t: "number", req: 1, sec: "Rémunération mensuelle" }, { k: "sursalaire", l: "Sursalaire (F)", t: "number" }, { k: "primes", l: "Primes fixes imposables (F)", t: "number" }, { k: "logement", l: "Indemnité de logement (F)", t: "number" }, { k: "transport", l: "Prime de transport (F)", t: "number", h: "Exonérée jusqu'au plafond paramétré." },
      { k: "anc_auto", l: "Prime d'ancienneté automatique", t: "select", o: OUINON, h: "2 % après 2 ans, +1 % par an, 25 % maximum." }, { k: "anc_taux", l: "Taux d'ancienneté manuel (%)", t: "number" },
      { k: "parts", l: "Parts fiscales (ITS)", t: "number", sec: "Fiscal et social" }, { k: "cmu_pers", l: "Personnes couvertes CMU", t: "number" }, { k: "declare", l: "Déclaré à la CNPS", t: "select", o: OUINON, h: "Non : aucune cotisation sociale ni CMU (à régulariser)." }, { k: "cnps_no", l: "N° CNPS" },
      { k: "mode_paie", l: "Mode de paiement du salaire", t: "select", o: MODES, sec: "Paiement" }, { k: "compte_paie", l: "Compte bancaire / n° Mobile Money" }]);
    if (e) F.push({ k: "effet", l: "Date d'effet du changement de salaire", t: "date", sec: "Modification" }, { k: "motif_sal", l: "Motif du changement de salaire" });
    var init = e ? Object.assign({}, e, { anc_auto: e.anc_auto === false ? "non" : "oui", declare: e.declare === false ? "non" : "oui", effet: today() }) : { contrat: "CDI", embauche: today(), anc_auto: "oui", declare: "oui", parts: 1, cmu_pers: 1, mode_paie: "banque", act: acts ? (H.actDefaut || acts[0][0]) : "" };
    form(e ? "Modifier " + empNom(e) : "Nouvel employé", F, init, function (o) { saveEmploye(Object.assign({}, o, { id: e && e.id, derog_smig: o.sal_base < P().smig && confirm("Le salaire de base est inférieur au SMIG (" + fcfa(P().smig) + "). Confirmer la dérogation ?") })); }, e ? "Enregistrer" : "Créer la fiche");
  }

  /* ---------- Impression (moteur partagé ANGELS_PRINT) ---------- */
  function imprimer(o) {
    if (!G.ANGELS_PRINT) { alert("Moteur d'impression indisponible."); return; }
    G.ANGELS_PRINT.ouvrir(Object.assign({ division: H.division, emetteur: H.user(), fallback: H.identite ? H.identite() : null }, o)).catch(function (e) { alert("Impression impossible : " + e.message); });
  }
  var ligne = function (l, v, g) { return "<tr><td>" + l + "</td><td style=\"text-align:right\">" + (g ? "<b>" + v + "</b>" : v) + "</td></tr>"; };
  function bulletinHtml(p, b) {
    var c = b.calc, e = by(rh().employes, b.emp_id) || {}, G_ = function (l, v) { return v ? [l, fcfa(v)] : null; };
    var gains = [["Salaire catégoriel", c.categoriel], ["Sursalaire", c.sursalaire], ["Prime d'ancienneté (" + c.tauxAnc + " %)", c.anciennete], ["Primes", c.primes], ["Indemnité de logement", c.logement], ["Heures supplémentaires", c.hs], ["Prime de transport (exonérée)", c.transport], ["Transport imposable (excédent)", c.transportImp]].filter(function (x) { return x[1]; });
    var ret = [["CNPS retraite (salarié)", c.cnpsSal], ["ITS (après RICF " + fcfa(c.ricf) + ")", c.its], ["CMU (salarié)", c.cmuSal], ["Récupération d'avances", c.avance], ["Retenues diverses", c.retenues]].filter(function (x) { return x[1]; });
    var pat = [["CNPS retraite (employeur)", c.cnpsRetPat], ["Accident du travail", c.cnpsAT], ["Prestations familiales", c.cnpsPF], ["ITS patronal", c.itsPat], ["FDFP", fdfpTotal(c)], ["CMU (employeur)", c.cmuPat]].filter(function (x) { return x[1]; });
    return '<table><tr><th>Salarié</th><td><b>' + esc(empNom(e)) + "</b> — matricule " + esc(b.mat || "") + "</td><th>Période</th><td>" + esc(libMois(p.mois)) + "</td></tr><tr><th>Poste</th><td>" + esc(e.poste || "—") + "</td><th>Contrat</th><td>" + esc(e.contrat || "") + " depuis le " + fd(e.embauche) + "</td></tr><tr><th>N° CNPS</th><td>" + (e.declare === false ? "non déclaré" : esc(e.cnps_no || "—")) + "</td><th>Jours payés</th><td>" + c.jours + " / " + P().joursMois + "</td></tr></table>" +
      "<h2>Gains</h2><table>" + gains.map(function (x) { return ligne(esc(x[0]), fcfa(x[1])); }).join("") + ligne("Brut total", fcfa(c.brut), 1) + "</table><h2>Retenues salariales</h2><table>" + (ret.length ? ret.map(function (x) { return ligne(esc(x[0]), fcfa(x[1])); }).join("") : "<tr><td>Aucune retenue</td><td></td></tr>") + ligne("Total des retenues", fcfa(c.totalRetenues), 1) + "</table>" +
      '<table><tr><td style="font-size:13pt"><b>NET À PAYER</b></td><td style="text-align:right;font-size:13pt"><b>' + fcfa(c.net) + "</b></td></tr></table><h2>Charges patronales (information)</h2><table>" + pat.map(function (x) { return ligne(esc(x[0]), fcfa(x[1])); }).join("") + ligne("Total des charges patronales", fcfa(c.totalPatronal), 1) + ligne("Coût total employeur", fcfa(c.cout), 1) + "</table>" +
      (b.paye ? '<p class="sm mu">Payé le ' + fd(b.paye_le) + " (" + esc(b.paye_mode) + ").</p>" : "") + '<p class="sm mu">Bulletin à conserver sans limitation de durée.</p>';
  }
  function livreHtml(L, titre) {
    var rows = L.map(function (b) { var c = b.calc; return "<tr><td>" + esc(b.mat) + "</td><td>" + esc(b.nom) + "</td><td>" + c.jours + "</td><td>" + fcfa(c.brut) + "</td><td>" + fcfa(c.cnpsSal + c.cmuSal) + "</td><td>" + fcfa(c.its) + "</td><td>" + fcfa(c.avance + c.retenues) + "</td><td><b>" + fcfa(c.net) + "</b></td><td>" + fcfa(c.totalPatronal) + "</td><td>" + fcfa(c.cout) + "</td></tr>"; }).join("");
    var t = function (f) { return fcfa(sum(L, function (b) { return f(b.calc); })); };
    return "<table><thead><tr><th>Mat.</th><th>Salarié</th><th>Jours</th><th>Brut</th><th>CNPS+CMU</th><th>ITS</th><th>Avances/ret.</th><th>Net</th><th>Charges pat.</th><th>Coût</th></tr></thead><tbody>" + rows + "<tr><th colspan=\"3\">TOTAUX</th><th>" + t(function (c) { return c.brut; }) + "</th><th>" + t(function (c) { return c.cnpsSal + c.cmuSal; }) + "</th><th>" + t(function (c) { return c.its; }) + "</th><th>" + t(function (c) { return c.avance + c.retenues; }) + "</th><th>" + t(function (c) { return c.net; }) + "</th><th>" + t(function (c) { return c.totalPatronal; }) + "</th><th>" + t(function (c) { return c.cout; }) + "</th></tr></tbody></table>";
  }
  function ancienneteTxt(e, au) { var j = diffJ(au || today(), e.embauche), a = Math.floor(j / 365.25), m = Math.floor((j - a * 365.25) / 30.4375); return (a ? a + " an(s) " : "") + m + " mois"; }
  var SIG2 = [["Le salarié", "Lu et approuvé"], ["L'employeur", "Nom, qualité, signature et cachet"]];
  function docContrat(e) {
    var id = G.ANGELS_PRINT ? G.ANGELS_PRINT.ident(H.division, H.identite ? H.identite() : null) : { nom: "", siege: "" }, d = e.contrat, dur = d === "CDI" ? "à durée indéterminée" : d === "CDD" ? "à durée déterminée, du " + fd(e.embauche) + " au " + fd(e.fin_contrat) : d === "journalier" ? "à titre journalier / temporaire" : d === "stage" ? "de stage" : "de prestation de services", rem = e.sal_base + (e.sursalaire || 0);
    imprimer({ titre: d === "prestataire" ? "Contrat de prestation" : d === "stage" ? "Convention de stage" : "Contrat de travail", ref: "CT-" + e.mat, date: e.embauche, montant: rem, signatures: SIG2, corps: '<h2>Entre les soussignés</h2><p><b>' + esc(id.nom) + "</b>, " + esc(id.siege || "") + ', ci-après « l\'Employeur » ;</p><p><b>' + esc(empNom(e)) + "</b>" + (e.naissance ? ", né(e) le " + fd(e.naissance) : "") + (e.cni ? ", pièce d'identité n° " + esc(e.cni) : "") + (e.adresse ? ", demeurant " + esc(e.adresse) : "") + ', ci-après « le Salarié ».</p>' +
        "<h2>Article 1 — Engagement</h2><p>L'Employeur engage le Salarié en qualité de <b>" + esc(e.poste || "—") + "</b>" + (e.categorie ? " (catégorie " + esc(e.categorie) + ")" : "") + ", par contrat " + dur + ", à compter du <b>" + fd(e.embauche) + "</b>.</p><h2>Article 2 — Rémunération</h2><p>Le Salarié perçoit une rémunération mensuelle brute de <b>" + fcfa(rem) + "</b> (salaire de base " + fcfa(e.sal_base) + (e.sursalaire ? ", sursalaire " + fcfa(e.sursalaire) : "") + ")" + (e.transport ? ", outre une prime de transport de " + fcfa(e.transport) : "") + (e.logement ? " et une indemnité de logement de " + fcfa(e.logement) : "") + ". Les retenues et cotisations légales sont prélevées sur ce salaire.</p>" +
        "<h2>Article 3 — Durée et lieu du travail</h2><p>La durée du travail est celle fixée par la législation en vigueur. Le Salarié exerce ses fonctions " + esc(e.dept ? "au sein du service " + e.dept : "au siège de l'entreprise ou sur tout site désigné par l'Employeur") + ".</p><h2>Article 4 — Obligations</h2><p>Le Salarié s'engage à exécuter ses fonctions avec diligence, à respecter le règlement intérieur et à observer la confidentialité sur les informations de l'entreprise.</p><h2>Article 5 — Congés et protection sociale</h2><p>Le Salarié a droit aux congés payés et à la protection sociale prévus par le Code du travail ivoirien et la convention collective applicable" + (e.declare === false ? "" : " ; il est déclaré à la CNPS" + (e.cnps_no ? " sous le n° " + esc(e.cnps_no) : "")) + ".</p><h2>Article 6 — Rupture</h2><p>Le contrat peut être rompu dans les conditions prévues par le Code du travail (préavis, indemnités). Tout litige relève du tribunal compétent d'Abidjan.</p><p>Fait à Abidjan, le " + fd(today()) + ", en deux exemplaires originaux.</p>" });
  }
  function docAttestation(e) { imprimer({ titre: "Attestation de travail", ref: "ATT-" + e.mat + "-" + today().replace(/-/g, ""), date: today(), signatures: [["L'Employeur", "Nom, qualité, signature et cachet"]], corps: "<p>Nous soussignés, certifions que <b>" + esc(empNom(e)) + "</b>" + (e.cni ? ", titulaire de la pièce d'identité n° " + esc(e.cni) : "") + ", est employé(e) dans notre entreprise en qualité de <b>" + esc(e.poste || "—") + "</b> depuis le <b>" + fd(e.embauche) + "</b> (" + ancienneteTxt(e) + " d'ancienneté), sous contrat <b>" + esc(e.contrat) + "</b>.</p><p>La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>" }); }
  function docCertificat(e) { if (empActif(e)) return alert("Le certificat de travail se délivre à la sortie de l'employé."); imprimer({ titre: "Certificat de travail", ref: "CER-" + e.mat, date: e.sortie.date, signatures: [["L'Employeur", "Nom, qualité, signature et cachet"]], corps: "<p>Nous soussignés, certifions que <b>" + esc(empNom(e)) + "</b> a travaillé dans notre entreprise du <b>" + fd(e.embauche) + "</b> au <b>" + fd(e.sortie.date) + "</b> (" + ancienneteTxt(e, e.sortie.date) + "), en qualité de <b>" + esc(e.poste || "—") + "</b>.</p><p>Il (elle) nous quitte libre de tout engagement.</p>" }); }

  /* ---------- CSV ---------- */
  function csvOut(name, head, rows) {
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/^([=+@\t\r]|-(?![\d.,]+$))/, "'$1") + '"'; };
    var b = new Blob(["﻿" + [head].concat(rows).map(function (r) { return r.map(q).join(";"); }).join("\n")], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function csv(k) {
    need("p"); var r = rh(), p = k.split("|");
    if (p[0] === "employes") return csvOut("employes", ["Matricule", "Nom", "Prénoms", "Poste", "Contrat", "Embauche", "Fin contrat", "Salaire base", "Sursalaire", "N° CNPS", "Déclaré CNPS", "Sortie"], r.employes.map(function (e) { return [e.mat, e.nom, e.prenoms, e.poste, e.contrat, e.embauche, e.fin_contrat, e.sal_base, e.sursalaire, e.cnps_no, e.declare === false ? "non" : "oui", e.sortie ? e.sortie.date : ""]; }));
    if (p[0] === "paie") { var pa = paieDe(p[1]); return csvOut("paie-" + p[1], ["Matricule", "Salarié", "Jours", "Brut imposable", "Brut", "CNPS salarié", "ITS", "CMU salarié", "Avances", "Retenues", "Net", "CNPS patronal", "ITS patronal", "FDFP", "CMU patronal", "Coût"], (pa ? pa.bulletins : []).map(function (b) { var c = b.calc; return [b.mat, b.nom, c.jours, c.brutImposable, c.brut, c.cnpsSal, c.its, c.cmuSal, c.avance, c.retenues, c.net, c.cnpsRetPat + c.cnpsAT + c.cnpsPF, c.itsPat, fdfpTotal(c), c.cmuPat, c.cout]; })); }
    if (p[0] === "decl") { var pb = paieDe(p[1]); if (!pb) return; if (p[2] === "cnps") return csvOut("bordereau-cnps-" + p[1], ["Matricule", "N° CNPS", "Salarié", "Base cotisable", "Retraite salariale", "Retraite patronale", "Prestations familiales", "Accident du travail", "CMU"], pb.bulletins.filter(function (b) { return !b.calc.exoCnps; }).map(function (b) { var c = b.calc, e = by(r.employes, b.emp_id) || {}; return [b.mat, e.cnps_no || "", b.nom, Math.min(c.brutImposable, P().plafondRetraite), c.cnpsSal, c.cnpsRetPat, c.cnpsPF, c.cnpsAT, c.cmuSal + c.cmuPat]; })); return csvOut("etat-its-" + p[1], ["Matricule", "Salarié", "Brut imposable", "ITS brut", "RICF", "ITS salarial", "ITS patronal"], pb.bulletins.map(function (b) { var c = b.calc; return [b.mat, b.nom, c.brutImposable, c.itsBrut, c.ricf, c.its, c.itsPat]; })); }
  }

  /* ---------- Actions ---------- */
  var ACT = {
    tab: function (id) { UIS.tab = id; UIS.fiche = null; H.render(); },
    back: function () { UIS.fiche = null; H.render(); },
    "emp.add": function () { formEmploye(null); }, "emp.edit": function (id) { formEmploye(by(rh().employes, id)); }, "emp.fiche": function (id) { UIS.fiche = id; H.render(); },
    "emp.sortie": function (id) { var e = by(rh().employes, id); form("Sortie de " + empNom(e), [{ k: "date", l: "Date de sortie", t: "date", req: 1 }, { k: "motif", l: "Motif (démission, fin de CDD, licenciement…)", req: 1, full: 1 }], { date: today() }, function (o) { sortieEmploye(id, o.date, o.motif); }, "Enregistrer la sortie"); },
    "emp.reint": function (id) { H.run(function () { reintegrer(id); }); after(); },
    "av.add": function (id) { form("Avance sur salaire — " + empNom(by(rh().employes, id)), [{ k: "montant", l: "Montant (F)", t: "number", req: 1 }, { k: "retenue", l: "Retenue mensuelle (F)", t: "number", h: "Vide : récupération totale sur la prochaine paie." }, { k: "date", l: "Date", t: "date", req: 1 }, { k: "mode", l: "Mode de versement", t: "select", o: MODES }, { k: "motif", l: "Motif", req: 1, full: 1 }], { date: today(), mode: "caisse" }, function (o) { octroyerAvance(Object.assign({}, o, { emp_id: id })); }, "Accorder"); },
    "cg.add": function () { form("Demande de congé", [{ k: "emp_id", l: "Employé", t: "select", o: function () { return empOpts(true); } }, { k: "type", l: "Type", t: "select", o: TYPES_CONGE }, { k: "debut", l: "Du", t: "date", req: 1 }, { k: "fin", l: "Au (inclus)", t: "date", req: 1 }, { k: "motif", l: "Motif", full: 1 }], { debut: today(), fin: today(), type: "annuel" }, function (o) { demandeConge(o); }, "Enregistrer"); },
    "cg.ok": function (id) { H.run(function () { decideConge(id, true); }); after(); }, "cg.no": function (id) { ask("Refuser la demande", "Motif du refus", function (m) { decideConge(id, false, m); }, "Refuser"); },
    "p.calc": function (m) { H.run(function () { calculerMois(m); }); after(); },
    "p.val": function (m) { if (!confirm("Valider la paie de " + libMois(m) + " ? L'écriture comptable sera générée et les variables verrouillées.")) return; H.run(function () { validerMois(m); }); after(); },
    "p.annulpay": function (x) { var s = x.split("|"); ask("Annuler le paiement des salaires de " + libMois(s[0]), "Motif de l'annulation", function (mo) { annulerPaiement(s[0], s[1], mo); }, "Annuler le paiement"); },
    "rv.annul": function (id) { ask("Annuler le reversement", "Motif de l'annulation", function (mo) { annulerReversement(id, mo); }, "Annuler le reversement"); },
    "p.annul": function (m) { ask("Annuler la validation de " + libMois(m), "Motif de l'annulation", function (mo) { annulerValidation(m, mo); }, "Annuler la validation"); },
    "p.pay": function (m) { var pa = paieDe(m), du = sum(pa.bulletins.filter(function (b) { return !b.paye; }), function (b) { return b.calc.net; }); form("Payer les salaires de " + libMois(m) + " — " + fcfa(du), [{ k: "mode", l: "Mode de règlement", t: "select", o: MODES }, { k: "date", l: "Date de paiement", t: "date", req: 1 }], { mode: "banque", date: today() }, function (o) { payerSalaires(m, o.mode, null, o.date); }, "Payer"); },
    "p.var": function (x) { var s = x.split("|"), e = by(rh().employes, s[1]), v = variable(s[0], s[1]); form("Variables de " + libMois(s[0]) + " — " + empNom(e), [{ k: "abs", l: "Jours d'absence non payés", t: "number" }, { k: "hs", l: "Heures supplémentaires (F)", t: "number" }, { k: "primes", l: "Primes ponctuelles imposables (F)", t: "number" }, { k: "retenues", l: "Retenues diverses (F)", t: "number" }, { k: "avance", l: "Avance à récupérer (F)", t: "number", blank: 1, h: "Vide : retenue automatique selon l'échéancier de l'avance (" + fcfa(avanceDue(e.id)) + " restant dû)." }, { k: "note", l: "Note", full: 1 }], { abs: v.abs, hs: v.hs, primes: v.primes, retenues: v.retenues, avance: v.avance == null ? "" : v.avance, note: v.note }, function (o) { setVariable(s[0], Object.assign({}, o, { emp_id: e.id })); if (paieDe(s[0])) calculerMois(s[0]); }, "Enregistrer et recalculer"); },
    bul: function (x) { var s = x.split("|"), pa = paieDe(s[0]), b = pa && pa.bulletins.filter(function (y) { return y.emp_id === s[1]; })[0]; if (!b) return; imprimer({ titre: "Bulletin de paie", ref: b.no || ("BUL-" + s[0].replace("-", "") + "-" + b.mat + (pa.statut === "brouillon" ? "-BR" : "")), date: pa.date || dernierJour(s[0]), montant: b.calc.net, corps: bulletinHtml(pa, b), signatures: [["Le salarié", "Reçu le bulletin et la somme nette ci-dessus"], ["L'employeur", "Signature et cachet"]], paysage: false }); },
    "p.livre": function (m) { var pa = paieDe(m); if (!pa) return; imprimer({ titre: "Livre de paie — " + libMois(m), ref: "LP-" + m, date: dernierJour(m), montant: sum(pa.bulletins, function (b) { return b.calc.net; }), corps: livreHtml(pa.bulletins), paysage: true }); },
    "p.annuel": function (an) { var L = rh().paies.filter(function (p) { return p.statut !== "brouillon" && p.mois.slice(0, 4) === an; }), agg = {}; L.forEach(function (p) { p.bulletins.forEach(function (b) { var a = agg[b.emp_id] || (agg[b.emp_id] = { mat: b.mat, nom: b.nom, calc: { jours: 0, brut: 0, cnpsSal: 0, cmuSal: 0, its: 0, avance: 0, retenues: 0, net: 0, totalPatronal: 0, cout: 0 } }); Object.keys(a.calc).forEach(function (k) { a.calc[k] += b.calc[k] || 0; }); }); }); imprimer({ titre: "Livre de paie — récapitulatif " + an, ref: "LPA-" + an, date: an + "-12-31", corps: livreHtml(Object.keys(agg).map(function (k) { return agg[k]; })), paysage: true }); },
    rv: function (x) { var s = x.split("|"), d = dus(s[0])[s[1]] - sum(rh().reversements.filter(function (y) { return y.mois === s[0] && y.org === s[1] && !y.annule; }), function (y) { return y.montant; }); form("Reverser " + ORGS[s[1]][0] + " — " + libMois(s[0]) + " : " + fcfa(d), [{ k: "mode", l: "Mode de règlement", t: "select", o: MODES }, { k: "date", l: "Date", t: "date", req: 1 }], { mode: "banque", date: today() }, function (o) { reverse(s[0], s[1], o.mode, o.date); }, "Reverser"); },
    csv: function (k) { try { csv(k); } catch (e) { alert(e.message); } },
    "doc.contrat": function (id) { docContrat(by(rh().employes, id)); }, "doc.attestation": function (id) { docAttestation(by(rh().employes, id)); }, "doc.certificat": function (id) { docCertificat(by(rh().employes, id)); },
    "par.save": function () { var r = rh(), o = {}; document.querySelectorAll("[data-rh-par]").forEach(function (i) { var v = String(i.value).replace(",", ".").trim(); o[i.dataset.rhPar] = v === "" ? "" : +v; }); H.run(function () { need("a"); Object.keys(o).forEach(function (k) { if (o[k] !== "" && (!isFinite(o[k]) || o[k] < 0 || (PAIE_DEF[k] > 0 && PAIE_DEF[k] < 1 && o[k] > 1))) throw new Error("Paramètre invalide : " + k + (PAIE_DEF[k] < 1 ? " (taux entre 0 et 1, ex. 0,063 pour 6,3 %)" : "")); }); r.params = Object.assign({}, r.params, o); log("Paramètres de paie modifiés"); }); after(); },
    "par.reset": function () { if (!confirm("Revenir aux valeurs par défaut ?")) return; H.run(function () { need("a"); rh().params = {}; log("Paramètres de paie réinitialisés"); }); after(); }
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-rh]"); if (!t || !H || !G.ANGELS_RH.host) return; var f = ACT[t.dataset.rh]; if (!f) return; e.preventDefault(); H = G.ANGELS_RH.host;
    try { f(t.dataset.id, t); } catch (x) { alert(x.message); }
  });
  document.addEventListener("input", function (e) { var t = e.target; if (t.dataset && t.dataset.rhQ) { UIS.q = t.value; var pos = t.selectionStart; H.render(); var n = document.querySelector("[data-rh-q]"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } } });
  document.addEventListener("change", function (e) { var t = e.target; if (!H) return; if (t.dataset && t.dataset.rhMois) { UIS.mois = t.value; H.render(); } if (t.dataset && t.dataset.rhInact) { UIS.inactifs = t.checked; H.render(); } });

  G.ANGELS_RH = { host: null, view: view, P: P, calcul: calcul, itsBrut: itsBrut, ricf: ricf, tauxAnc: tauxAnc, joursPayes: joursPayes, resume: function (h) { H = h || H; return resume(); }, publier: function (h) { H = h || H; publier(); }, alertes: function (h) { H = h || H; return alertes(); }, PAIE_DEF: PAIE_DEF, UI: UIS,
    ops: { saveEmploye: saveEmploye, sortie: sortieEmploye, reintegrer: reintegrer, calculerMois: calculerMois, validerMois: validerMois, annulerValidation: annulerValidation, annulerPaiement: annulerPaiement, annulerReversement: annulerReversement, payerSalaires: payerSalaires, reverser: reverse, avance: octroyerAvance, conge: demandeConge, decideConge: decideConge, variable: setVariable, soldeConges: soldeConges, paieDe: paieDe, dus: dus, state: rh },
    use: function (h) { H = h; this.host = h; } };
})(window);
