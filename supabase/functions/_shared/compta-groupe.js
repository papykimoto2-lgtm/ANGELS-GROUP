/* Comptabilité du groupe, accès protégé côté serveur : logique pure, testée hors Supabase (voir tests/compta-groupe-serveur.js).

   Problème résolu : la page « Comptabilité du groupe » lisait les synthèses (paie, créances, états financiers, trésorerie) dans le navigateur de l'appareil, où tout
   appareil peut les lire quel que soit le profil connecté. Ici :
   - les applications PUBLIENT leurs synthèses au serveur (clé de synchronisation : écriture seulement) ;
   - la personne s'identifie avec SON mot de passe (vérifié ici, PBKDF2 identique aux applications) et reçoit un jeton signé de courte durée ;
   - le serveur ne renvoie que les sections autorisées à son profil ACTUEL (revérifié à chaque appel : compte désactivé ou profil changé = accès refusé) ;
   - le jeton est signé avec un secret propre (COMPTA_KEY) que les appareils ne connaissent pas : détenir la clé de synchronisation ne permet pas d'en fabriquer.
   Actions : publier · login · lire · droits · droits_ecrire · journal. */

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-sync-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const rep = (status, body) => ({ status, body }), err = (status, message, extra) => rep(status, Object.assign({ ok: false, erreur: message }, extra || {}));
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const te = new TextEncoder();
export const APPS = ["distribution", "transport", "agro"], ROLES_OK = ["admin", "direction", "directeur", "comptable"];
export const ROLES_L = { admin: "Administrateur", direction: "Direction générale", directeur: "Directeur", comptable: "Comptable" };
export const ESSAIS_MAX = 5, BLOCAGE_MIN = 15, JETON_MIN = 120, TAILLE_MAX = 400000;

/* Sections : familles de synthèses qu'elles donnent à voir (le registre « angels_inter » est lu par États financiers et Entre divisions). */
export const SECTIONS = [
  { k: "synthese", fam: ["compta"], def: ["admin", "direction", "directeur", "comptable"] },
  { k: "perso", fam: ["rh"], def: ["admin", "direction"] },
  { k: "creances", fam: ["tiers"], def: ["admin", "direction", "comptable"] },
  { k: "etats", fam: ["etats", "regul", "@inter"], def: ["admin", "direction", "directeur"] },
  { k: "treso", fam: ["prev"], def: ["admin", "direction", "directeur"] },
  { k: "inter", fam: ["inter", "@inter"], def: ["admin", "direction", "comptable"] },
  { k: "plan", fam: ["compta"], def: ["admin", "direction", "comptable"] }];
export const cleOk = (c) => /^angels_(compta|etats|prev|rh|tiers|regul|inter)(_(distribution|transport|agro))?$/.test(String(c));
export const clesDe = (s) => { const o = []; s.fam.forEach((f) => { if (f === "@inter") o.push("angels_inter"); else APPS.forEach((a) => o.push("angels_" + f + "_" + a)); }); return o; };

/* ---- cryptographie : PBKDF2 (mots de passe), HMAC (jeton) ---- */
const b64 = (u8) => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const b64u = (u8) => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => unb64(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
export const egal = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function deriver(mdp, sel, it) {
  const k = await crypto.subtle.importKey("raw", te.encode(String(mdp)), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sel, iterations: it }, k, 256));
}
async function verifierMdp(mdp, rec) {
  if (!rec || !rec.s || !rec.h) return false; const it = +rec.it || 150000; if (!(it >= 10000 && it <= 600000)) return false;
  try { return egal(b64(await deriver(mdp, unb64(rec.s), it)), rec.h); } catch (e) { return false; }
}
async function signer(cfg, msg) {
  const k = await crypto.subtle.importKey("raw", te.encode("compta-groupe-v1:" + cfg.cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg))));
}
export async function emettreJeton(cfg, app, u, now) {
  const p = b64u(te.encode(JSON.stringify({ a: app, u: u.id, e: now + JETON_MIN * 6e4, v: txt(u.pwd && u.pwd.h, 12) })));
  return p + "." + await signer(cfg, p);
}
async function lireJeton(cfg, jeton, now) {
  const [p, s] = String(jeton || "").split("."); if (!p || !s) return null;
  if (!egal(s, await signer(cfg, p))) return null;
  try { const d = JSON.parse(new TextDecoder().decode(unb64u(p))); return d && d.e > now ? d : null; } catch (e) { return null; }
}
const plat = (x) => String(x == null ? "" : x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---- droits : matrice enregistrée sur le serveur, complétée par les droits d'origine ; l'administrateur voit toujours tout ---- */
export function droitsEffectifs(brut) {
  const d = {};
  SECTIONS.forEach((s) => {
    let L = brut && brut.d && Array.isArray(brut.d[s.k]) ? brut.d[s.k].filter((r) => ROLES_OK.includes(r)) : s.def.slice();
    if (!L.includes("admin")) L = ["admin"].concat(L); d[s.k] = L;
  });
  return d;
}
const sectionsDe = (role, brut) => { const d = droitsEffectifs(brut); return SECTIONS.filter((s) => d[s.k].includes(role)).map((s) => s.k); };

/* Registre inter-divisions : fusion par identifiant, la version la plus avancée d'une opération l'emporte (émise < confirmée/contestée < annulée). */
const RANG = { emise: 0, confirmee: 1, contestee: 1, annulee: 2 };
export function fusionRegistre(ancien, nouveau) {
  const m = new Map(); (ancien && Array.isArray(ancien.ops) ? ancien.ops : []).forEach((o) => { if (o && o.id) m.set(o.id, o); });
  (nouveau && Array.isArray(nouveau.ops) ? nouveau.ops : []).forEach((o) => { if (!o || !o.id) return; const e = m.get(o.id); if (!e || (RANG[o.statut] || 0) >= (RANG[e.statut] || 0)) m.set(o.id, o); });
  return { v: 1, ops: [...m.values()] };
}

async function utilisateur(db, app, id) { if (!APPS.includes(app)) return null; const u = (await db.users(app)).find((x) => x && x.id === id); return u || null; }

/* Le compte derrière un jeton, revérifié à chaque appel. */
async function sessionDe(db, cfg, req, now) {
  const j = await lireJeton(cfg, req.jeton, now); if (!j) return { e: err(401, "Session expirée : reconnectez-vous.", { reconnecter: true }) };
  const u = await utilisateur(db, j.a, j.u);
  if (!u || u.actif === false || !ROLES_OK.includes(u.role) || txt(u.pwd && u.pwd.h, 12) !== j.v) return { e: err(401, "Votre accès a changé : reconnectez-vous.", { reconnecter: true }) };
  return { u, app: j.a };
}

export async function traiterCompta(db, cfg, req, cleSync, now = Date.now()) {
  if (!cfg || !cfg.cle || String(cfg.cle).length < 16) return err(500, "Service non configuré");
  const a = txt(req && req.action, 30), jr = (ev, u, app, motif) => db.journaliser({ ev, app: app || "", uid: (u && u.id) || "", nom: (u && u.nom) || "", role: (u && u.role) || "", motif: txt(motif, 160) }).catch(() => {});

  if (a === "etat") return rep(200, { ok: true });   /* la page détecte ainsi que la protection par le serveur est active */

  /* Écriture des synthèses par les applications : clé de synchronisation (jamais de lecture avec elle). */
  if (a === "publier") {
    if (!cfg.syncKey || !egal(cleSync, cfg.syncKey)) return err(401, "Clé de synchronisation invalide");
    const L = (Array.isArray(req.items) ? req.items : []).slice(0, 30); let n = 0;
    for (const it of L) {
      const cle = txt(it && it.cle, 60); if (!cleOk(cle) || !it.data || typeof it.data !== "object" || JSON.stringify(it.data).length > TAILLE_MAX) continue;
      let data = it.data; if (cle === "angels_inter") data = fusionRegistre(await db.synthese(cle), data);
      await db.ecrireSynthese(cle, data, "poste"); n++;
    }
    return rep(200, { ok: true, ecrites: n });
  }

  if (a === "login") {
    const nom = txt(req.nom, 80), mdp = String(req.mdp == null ? "" : req.mdp).slice(0, 200), k = plat(nom) || "?", e = await db.essais(k);
    if (e && e.until > now) { await jr("bloque", { nom }, "", "Tentative pendant un blocage"); return err(429, "Compte bloqué " + Math.ceil((e.until - now) / 6e4) + " minute(s) : trop de tentatives."); }
    let trouve = null;
    if (nom) for (const app of APPS) for (const u of await db.users(app)) {
      if (!u || plat(u.nom) !== k || u.actif === false || !ROLES_OK.includes(u.role)) continue;
      if (await verifierMdp(mdp, u.pwd) && (!trouve || ROLES_OK.indexOf(u.role) < ROLES_OK.indexOf(trouve.u.role))) trouve = { u, app };
    }
    if (!trouve) {
      const n = ((e && e.n) || 0) + 1; await db.noterEssai(k, n >= ESSAIS_MAX ? { n: 0, until: now + BLOCAGE_MIN * 6e4 } : { n, until: 0 });
      await jr("ko", { nom }, "", "Mot de passe ou utilisateur incorrect");
      return err(401, "Utilisateur ou mot de passe incorrect.");
    }
    await db.effacerEssais(k);
    if (trouve.u.chg) return err(403, "Votre mot de passe est temporaire : ouvrez l'application et connectez-vous une fois pour le remplacer.");
    await jr("ok", trouve.u, trouve.app, "Connexion");
    const sections = sectionsDe(trouve.u.role, await db.droits());
    return rep(200, { ok: true, jeton: await emettreJeton(cfg, trouve.app, trouve.u, now), utilisateur: { nom: trouve.u.nom, role: trouve.u.role, roleL: ROLES_L[trouve.u.role], app: trouve.app }, sections, expire_min: JETON_MIN });
  }

  const s = await sessionDe(db, cfg, req, now); if (s.e) return s.e;
  const { u, app } = s, brut = await db.droits(), permises = sectionsDe(u.role, brut);

  if (a === "lire") {
    const sec = txt(req.section, 30);
    if (sec && !permises.includes(sec)) { await jr("refus", u, app, "Section refusée : " + sec); return err(403, "Cette section n'est pas ouverte à votre profil."); }
    const vues = sec ? [sec] : []; const cles = new Set(); vues.forEach((k) => clesDe(SECTIONS.find((x) => x.k === k)).forEach((c) => cles.add(c)));
    const L = cles.size ? await db.syntheses([...cles]) : [], donnees = {}; L.forEach((r) => { donnees[r.cle] = r.data; });
    if (sec) await jr("consult", u, app, "Section : " + sec);
    return rep(200, { ok: true, utilisateur: { nom: u.nom, role: u.role, roleL: ROLES_L[u.role], app }, sections: permises, section: sec || null, donnees });
  }
  if (a === "droits") return rep(200, { ok: true, sections: permises, droits: u.role === "admin" ? droitsEffectifs(brut) : undefined, meta: u.role === "admin" && brut ? { par: brut.par, le: brut.le } : undefined });
  if (a === "droits_ecrire") {
    if (u.role !== "admin") { await jr("refus", u, app, "Modification des droits refusée"); return err(403, "Réservé à l'administrateur."); }
    if (req.retablir) { await db.ecrireDroits(null, u.nom); await jr("droits", u, app, "Droits d'origine rétablis"); return rep(200, { ok: true, droits: droitsEffectifs(null) }); }
    const d = {}; SECTIONS.forEach((x) => { const L = req.droits && Array.isArray(req.droits[x.k]) ? req.droits[x.k].filter((r) => ROLES_OK.includes(r)) : x.def; d[x.k] = L.includes("admin") ? L : ["admin"].concat(L); });
    const o = { d, par: u.nom, le: new Date(now).toISOString() }; await db.ecrireDroits(o, u.nom); await jr("droits", u, app, "Droits modifiés");
    return rep(200, { ok: true, droits: droitsEffectifs(o) });
  }
  if (a === "journal") {
    if (u.role !== "admin") return err(403, "Réservé à l'administrateur.");
    return rep(200, { ok: true, journal: await db.journal(300) });
  }
  return err(400, "Action inconnue");
}
