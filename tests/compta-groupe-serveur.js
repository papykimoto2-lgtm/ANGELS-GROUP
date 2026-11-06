/* Comptabilité du groupe côté serveur : authentification, droits par section, isolation, jeton, journal. Base en mémoire. Usage : node tests/compta-groupe-serveur.js */
const crypto = require("crypto"); let ok = 0, ko = 0; const chk = (id, label, o, info) => { console.log(o ? "PASS" : "FAIL", id, label, o ? "" : info || ""); o ? ok++ : ko++; };
const pwd = (m, it = 150000) => { const s = crypto.randomBytes(16), h = crypto.pbkdf2Sync(m, s, it, 32, "sha256"); return { v: 2, it, s: s.toString("base64"), h: h.toString("base64") }; };
(async () => {
  const C = await import("../supabase/functions/_shared/compta-groupe.js"), mem = require("./compta-groupe-memoire.js");
  const db = mem(), cfg = { cle: "C".repeat(32), syncKey: "S".repeat(32) }, NOW = Date.now(), T = (req, n = NOW, sk) => C.traiterCompta(db, cfg, req, sk, n);
  const add = (app, u) => db._users[app].push(u);
  const M = { admin: "Admin@Secret2026", dg: "Direction@Test2026", dir: "Directeur@Test2026", cpt: "Compta@Test2026", cais: "Caissier@Test2026" };
  add("transport", { id: "a", nom: "KESSIE", role: "admin", actif: true, pwd: pwd(M.admin) });
  add("agro", { id: "a2", nom: "Kessié", role: "comptable", actif: true, pwd: pwd(M.admin) });      /* même nom dans une autre application, rôle moindre */
  add("distribution", { id: "g", nom: "Aminata DG", role: "direction", actif: true, pwd: pwd(M.dg) });
  add("transport", { id: "d", nom: "Yao Directeur", role: "directeur", actif: true, pwd: pwd(M.dir) });
  add("transport", { id: "c", nom: "Awa Compta", role: "comptable", actif: true, pwd: pwd(M.cpt) });
  add("transport", { id: "x", nom: "Caissier", role: "caissier", actif: true, pwd: pwd(M.cais) });
  add("transport", { id: "i", nom: "Inactif", role: "comptable", actif: false, pwd: pwd(M.cpt) });
  add("transport", { id: "t", nom: "Temporaire", role: "comptable", actif: true, pwd: pwd(M.cpt), chg: true });
  const SK = cfg.syncKey;
  /* --- publication par les applications */
  let r = await T({ action: "publier", items: [] }, NOW, "mauvaise"); chk("CG-1", "publier : clé de synchronisation requise", r.status === 401);
  r = await T({ action: "publier", items: [
    { cle: "angels_compta_transport", data: { nb_ecritures: 5 } }, { cle: "angels_rh_transport", data: { effectif: 3, brut_mois: 900000 } }, { cle: "angels_tiers_transport", data: { creances: { total: 1000 } } },
    { cle: "angels_etats_transport", data: { ca: 5000 } }, { cle: "angels_prev_transport", data: { treso: 42 } }, { cle: "angels_inter_transport", data: { ecart: 0 } },
    { cle: "angels_regul_transport", data: { n: 1 } }, { cle: "angels_inter", data: { ops: [{ id: "o1", statut: "emise" }] } },
    { cle: "evil_table", data: { x: 1 } }, { cle: "angels_rh_inconnue", data: { x: 1 } }, { cle: "angels_rh_agro", data: "pas un objet" }] }, NOW, SK);
  chk("CG-2", "publier : 8 clés valides écrites, clés inconnues ou invalides ignorées", r.status === 200 && r.body.ecrites === 8 && !db._synth.has("evil_table") && !db._synth.has("angels_rh_inconnue"), JSON.stringify(r.body));
  await T({ action: "publier", items: [{ cle: "angels_inter", data: { ops: [{ id: "o1", statut: "confirmee" }, { id: "o2", statut: "emise" }] } }] }, NOW, SK);
  await T({ action: "publier", items: [{ cle: "angels_inter", data: { ops: [{ id: "o1", statut: "emise" }] } }] }, NOW, SK);
  const reg = db._synth.get("angels_inter"); chk("CG-3", "registre inter-divisions : fusion par identifiant, un poste en retard n'écrase pas une confirmation", reg.ops.length === 2 && reg.ops.find((o) => o.id === "o1").statut === "confirmee");
  /* --- connexion */
  const lg = (nom, mdp, n = NOW) => T({ action: "login", nom, mdp }, n);
  r = await lg("Yao Directeur", M.dir); chk("CG-4", "login directeur : jeton + sections (synthèse, états, trésorerie)", r.status === 200 && !!r.body.jeton && r.body.sections.join() === "synthese,etats,treso", JSON.stringify(r.body.sections));
  const J_DIR = r.body.jeton;
  r = await lg("kessie", M.admin); chk("CG-5", "login : nom insensible à la casse/accents ; le profil le plus élevé est retenu (administrateur)", r.status === 200 && r.body.utilisateur.role === "admin" && r.body.sections.length === 7);
  const J_ADM = r.body.jeton;
  r = await lg("Awa Compta", M.cpt); chk("CG-6", "login comptable : synthèse, créances, entre divisions, plan comptable", r.status === 200 && r.body.sections.join() === "synthese,creances,inter,plan", JSON.stringify(r.body.sections));
  const J_CPT = r.body.jeton;
  r = await lg("Aminata DG", M.dg); chk("CG-7", "login direction : les 7 sections", r.status === 200 && r.body.sections.length === 7);
  chk("CG-8", "mauvais mot de passe, rôle non autorisé (caissier), compte inactif, inconnu : même refus 401", [await lg("Awa Compta", "faux"), await lg("Caissier", M.cais), await lg("Inactif", M.cpt), await lg("Personne", "x")].every((x) => x.status === 401 && x.body.erreur === "Utilisateur ou mot de passe incorrect."));
  r = await lg("Temporaire", M.cpt); chk("CG-9", "mot de passe temporaire : refusé tant qu'il n'est pas changé", r.status === 403);
  let b; for (let i = 0; i < 5; i++) b = await lg("Yao Directeur", "faux"); r = await lg("Yao Directeur", M.dir);
  chk("CG-10", "5 échecs : compte bloqué 15 min (même avec le bon mot de passe)", r.status === 429, r.status);
  r = await lg("Yao Directeur", M.dir, NOW + 16 * 6e4); chk("CG-11", "blocage levé après 15 min", r.status === 200);
  /* --- lecture : isolation par section */
  const lire = (jeton, section, n = NOW) => T({ action: "lire", jeton, section }, n);
  r = await lire(J_DIR, "etats"); chk("CG-12", "directeur : états financiers + registre (éliminations), pas de paie ni de créances", r.status === 200 && !!r.body.donnees.angels_etats_transport && !!r.body.donnees.angels_inter && !r.body.donnees.angels_rh_transport && !r.body.donnees.angels_tiers_transport);
  r = await lire(J_DIR, "perso"); chk("CG-13", "directeur : paie refusée (403), aucune donnée dans la réponse", r.status === 403 && !JSON.stringify(r.body).includes("900000"));
  r = await lire(J_CPT, "etats"); chk("CG-14", "comptable : états financiers refusés", r.status === 403);
  r = await lire(J_CPT, "creances"); chk("CG-15", "comptable : créances et dettes accordées", r.status === 200 && !!r.body.donnees.angels_tiers_transport);
  r = await lire(J_ADM, "perso"); chk("CG-16", "administrateur : paie visible", r.status === 200 && r.body.donnees.angels_rh_transport.brut_mois === 900000);
  r = await lire(J_ADM, "treso"); chk("CG-17", "trésorerie : prévisions seulement", r.status === 200 && Object.keys(r.body.donnees).join() === "angels_prev_transport");
  r = await lire("jeton.falsifie"); chk("CG-18", "jeton falsifié refusé", r.status === 401);
  const faux = J_ADM.split(".")[0] + "." + J_ADM.split(".")[1].split("").reverse().join(""); r = await lire(faux, "perso"); chk("CG-19", "signature altérée refusée", r.status === 401);
  r = await lire(J_ADM, "perso", NOW + 121 * 6e4); chk("CG-20", "jeton expiré après 2 h", r.status === 401);
  const autre = await C.emettreJeton({ cle: "Z".repeat(32) }, "transport", { id: "a", pwd: { h: "x" } }, NOW); r = await lire(autre, "perso"); chk("CG-21", "jeton signé avec une autre clé (clé de synchronisation) : refusé", r.status === 401);
  /* --- le compte est revérifié à chaque appel */
  db._users.transport.find((u) => u.id === "c").role = "caissier"; r = await lire(J_CPT, "creances"); chk("CG-22", "profil changé : accès refusé immédiatement", r.status === 401);
  db._users.transport.find((u) => u.id === "c").role = "comptable"; db._users.transport.find((u) => u.id === "c").actif = false; r = await lire(J_CPT, "creances"); chk("CG-23", "compte désactivé : accès refusé", r.status === 401);
  db._users.transport.find((u) => u.id === "c").actif = true; db._users.transport.find((u) => u.id === "c").pwd = pwd("Nouveau@Mdp2026"); r = await lire(J_CPT, "creances"); chk("CG-24", "mot de passe changé : ancien jeton révoqué", r.status === 401);
  /* --- droits modifiables (administrateur seulement) */
  r = await T({ action: "droits_ecrire", jeton: J_DIR, droits: {} }); chk("CG-25", "droits_ecrire : refusé au non-administrateur", r.status === 403);
  r = await T({ action: "droits_ecrire", jeton: J_ADM, droits: { perso: ["direction", "directeur"], treso: ["direction"] } });
  chk("CG-26", "administrateur : droits enregistrés (l'administrateur est toujours conservé)", r.status === 200 && r.body.droits.perso.join() === "admin,direction,directeur" && r.body.droits.treso.join() === "admin,direction");
  r = await lire(J_DIR, "perso"); chk("CG-27", "directeur : paie désormais accordée", r.status === 200);
  r = await lire(J_DIR, "treso"); chk("CG-28", "directeur : trésorerie désormais refusée", r.status === 403);
  r = await T({ action: "droits_ecrire", jeton: J_ADM, retablir: true }); chk("CG-29", "rétablissement des droits d'origine", r.status === 200 && r.body.droits.perso.join() === "admin,direction");
  r = await T({ action: "droits", jeton: J_ADM }); chk("CG-30", "droits : la matrice n'est montrée qu'à l'administrateur", !!r.body.droits && !(await T({ action: "droits", jeton: J_DIR })).body.droits);
  /* --- journal */
  r = await T({ action: "journal", jeton: J_DIR }); chk("CG-31", "journal : réservé à l'administrateur", r.status === 403);
  r = await T({ action: "journal", jeton: J_ADM }); const evs = r.body.journal.map((x) => x.ev);
  chk("CG-32", "journal : connexions, échecs, blocage, consultations, refus et droits sont inscrits", ["ok", "ko", "bloque", "consult", "refus", "droits"].every((e) => evs.includes(e)), evs.join());
  chk("CG-33", "journal : aucun mot de passe ni donnée comptable", !JSON.stringify(r.body).match(/Admin@Secret|900000|brut_mois/));
  r = await T({ action: "lire", jeton: J_ADM, section: "perso" }, NOW, undefined); chk("CG-34", "service non configuré sans COMPTA_KEY", (await C.traiterCompta(db, { cle: "" }, { action: "login" }, SK, NOW)).status === 500);
  console.log("\n" + ok + " PASS / " + ko + " FAIL"); process.exit(ko ? 1 : 0);
})();
