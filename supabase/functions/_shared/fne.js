/* Facture Normalisée Électronique (DGI Côte d'Ivoire) : logique serveur pure, testée hors Supabase (voir tests/fne-serveur.js).

   Le navigateur ne connaît JAMAIS la clé API de la DGI : il envoie la facture à cette fonction (protégée par la clé de synchronisation des postes), qui l'adresse à la DGI avec la clé gardée en secret.
   Garantie « une facture = un seul autocollant » : chaque demande porte une clé de document ; le résultat est enregistré en base AVANT d'être rendu. Un renvoi (réseau coupé, double clic, autre poste)
   rend le résultat déjà obtenu au lieu de certifier une deuxième fois. Si la réponse de la DGI est perdue (délai dépassé), le document passe « incertain » : il n'est renvoyé que sur confirmation explicite
   de l'utilisateur, après vérification sur la plateforme FNE.
   Secrets (Supabase → Edge Functions → Secrets) : FNE_TEST_KEY / FNE_PROD_KEY (ou par division : FNE_DISTRIBUTION_PROD_KEY…), FNE_PROD_URL (fournie par la DGI après validation des spécimens), FNE_TEST_URL (défaut : plateforme de test). */
import { egal } from "./pont.js";

export { CORS } from "./pont.js";

const rep = (status, body) => ({ status, body });
const err = (status, message, extra = {}) => rep(status, { ok: false, erreur: message, ...extra });
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
export const APPS = ["distribution", "transport", "agro"], ENVS = ["test", "prod"];
export const URL_TEST = "http://54.247.95.108/ws";
const PAIEMENTS = ["cash", "card", "check", "mobile-money", "transfer", "deferred"], TEMPLATES = ["B2B", "B2C", "B2F", "B2G"], TAXES = ["TVA", "TVAB", "TVAC", "TVAD"];
const DEVISES = ["XOF", "USD", "EUR", "JPY", "CAD", "GBP", "AUD", "CNH", "CHF", "HKD", "NZD"];
export const DELAI_ENCOURS_MS = 120000, DELAI_DGI_MS = 30000, LIGNES_MAX = 200;

/** Adresse et clé de la DGI pour une division et un environnement ; null si non configurés. `secret(nom)` lit un secret. */
export function acces(app, env, secret) {
  const A = String(app).toUpperCase(), E = String(env).toUpperCase();
  const cle = secret(`FNE_${A}_${E}_KEY`) || secret(`FNE_${E}_KEY`);
  let url = env === "test" ? (secret(`FNE_${A}_TEST_URL`) || secret("FNE_TEST_URL") || URL_TEST) : (secret(`FNE_${A}_PROD_URL`) || secret("FNE_PROD_URL"));
  if (!cle || !url) return null;
  url = String(url).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) return null;
  if (env === "prod" && (!/^https:\/\//.test(url) || url.includes("54.247.95.108"))) return null;   // jamais de production sur la plateforme de test ni en clair
  return { url, cle };
}

/** Contrôle défensif d'une demande de certification (le serveur ne fait pas confiance au navigateur) */
export function validerSigner(p) {
  const E = [];
  if (!p || typeof p !== "object") return ["Facture absente."];
  if (!["sale", "purchase"].includes(p.invoiceType)) E.push("Type de facture invalide.");
  if (!PAIEMENTS.includes(p.paymentMethod)) E.push("Moyen de paiement invalide.");
  if (!TEMPLATES.includes(p.template)) E.push("Gabarit invalide.");
  for (const k of ["clientCompanyName", "pointOfSale", "establishment"]) if (!txt(p[k])) E.push(`Champ obligatoire : ${k}.`);
  if (!/^\d{8,15}$/.test(String(p.clientPhone || ""))) E.push("Téléphone du client invalide.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(p.clientEmail || ""))) E.push("E-mail du client invalide.");
  if (p.template === "B2B" && !/^[0-9A-Za-z]{6,15}$/.test(String(p.clientNcc || ""))) E.push("NCC du client obligatoire (B2B).");
  if (p.foreignCurrency && (!DEVISES.includes(p.foreignCurrency) || !(+p.foreignCurrencyRate > 0))) E.push("Devise ou taux de change invalide.");
  if (!Array.isArray(p.items) || !p.items.length) E.push("Aucune ligne.");
  else if (p.items.length > LIGNES_MAX) E.push(`Trop de lignes (maximum ${LIGNES_MAX}).`);
  else p.items.forEach((it, i) => {
    const n = `Ligne ${i + 1} : `;
    if (!txt(it.description)) E.push(n + "désignation manquante.");
    if (!(+it.quantity > 0) || !(+it.quantity < 1e9)) E.push(n + "quantité invalide.");
    if (!(+it.amount >= 0) || !(+it.amount < 1e13)) E.push(n + "prix invalide.");
    if (!(+(it.discount || 0) >= 0 && +(it.discount || 0) <= 100)) E.push(n + "remise invalide.");
    if (!Array.isArray(it.taxes) || !it.taxes.length || it.taxes.some((t) => !TAXES.includes(t))) E.push(n + "code de TVA invalide.");
  });
  if (!(+(p.discount || 0) >= 0 && +(p.discount || 0) <= 100)) E.push("Remise globale invalide.");
  return E;
}
export function validerAvoir(r) {
  const E = [];
  if (!txt(r.id) || !/^[0-9A-Za-z-]{8,64}$/.test(String(r.id))) E.push("Identifiant de la facture certifiée invalide.");
  if (!Array.isArray(r.items) || !r.items.length || r.items.length > LIGNES_MAX) E.push("Lignes de l'avoir invalides.");
  else r.items.forEach((it, i) => { if (!/^[0-9A-Za-z-]{8,64}$/.test(String(it.id || "")) || !(+it.quantity > 0)) E.push(`Ligne ${i + 1} de l'avoir invalide.`); });
  return E;
}

/** Réponse de la DGI réduite à ce dont les applications ont besoin (jamais d'en-tête ni de clé) */
export function reduire(j) {
  const inv = (j && j.invoice) || {};
  return { ncc: txt(j.ncc, 30), reference: txt(j.reference, 60), token: txt(j.token, 300), warning: !!j.warning, balance_sticker: j.balance_sticker == null ? null : +j.balance_sticker,
    invoice: inv.id ? { id: txt(inv.id, 64), amount: inv.amount, vatAmount: inv.vatAmount, items: (inv.items || []).slice(0, LIGNES_MAX).map((i) => ({ id: txt(i.id, 64), quantity: i.quantity, reference: txt(i.reference, 60), description: txt(i.description, 250), amount: i.amount })) } : undefined };
}

async function appelerDgi(fetchFn, a, chemin, corps) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), DELAI_DGI_MS);
  try {
    const r = await fetchFn(a.url + chemin, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + a.cle }, body: JSON.stringify(corps), signal: ctl.signal });
    let j = {}; try { j = await r.json(); } catch { /* corps vide ou illisible */ }
    return { http: r.status, j };
  } catch (e) { return { reseau: true, message: e && e.name === "AbortError" ? "délai dépassé" : "réseau indisponible" }; }
  finally { clearTimeout(to); }
}

/** cfg = { syncKey, secret(nom) } ; db = { lire(cle), inserer(cle,ligne)→bool, reprendre(cle, majAttendue, champs)→bool, maj(cle, champs) } */
export async function traiterFne(db, cfg, req, cle, fetchFn, now = Date.now()) {
  if (!cfg.syncKey || !egal(cle, cfg.syncKey)) return err(401, "Clé de synchronisation invalide");
  const action = txt(req.action, 20), app = txt(req.app, 20), env = txt(req.env, 10);
  if (!APPS.includes(app)) return err(400, "Application inconnue");
  if (!ENVS.includes(env)) return err(400, "Environnement inconnu (test ou prod)");
  const a = acces(app, env, cfg.secret);
  if (action === "etat") return rep(200, { ok: true, configure: !!a, env, hote: a ? new URL(a.url).host : null });
  if (!["signer", "avoir"].includes(action)) return err(400, "Action inconnue");
  if (!a) return err(503, env === "prod" ? "Production non configurée : la DGI doit d'abord valider vos spécimens et fournir l'adresse de production (secrets FNE_PROD_URL et FNE_PROD_KEY)." : "Clé de la plateforme de test non configurée (secret FNE_TEST_KEY).");
  const doc = txt(req.cle_doc, 120);
  if (!/^[\w:.\-|]{3,120}$/.test(doc)) return err(400, "Clé de document invalide");
  const E = action === "signer" ? validerSigner(req.payload) : validerAvoir(req);
  if (E.length) return err(422, E[0], { details: E });

  const k = `${app}:${env}:${action}:${doc}`, ligne = { cle: k, app, env, action, statut: "en_cours", payload: action === "signer" ? req.payload : { id: req.id, items: req.items }, reponse: null, erreur: null, maj: now };
  if (!(await db.inserer(k, ligne))) {
    const ex = await db.lire(k);
    if (ex && ex.statut === "certifiee") return rep(200, { ok: true, rejoue: true, reponse: ex.reponse });
    if (ex && ex.statut === "en_cours" && now - ex.maj < DELAI_ENCOURS_MS) return err(409, "Certification déjà en cours pour ce document : patientez quelques secondes.", { en_cours: true });
    if (ex && (ex.statut === "en_cours" || ex.statut === "incertain") && !req.forcer) return err(409, "Résultat incertain : la réponse de la DGI a été perdue. Vérifiez sur la plateforme FNE que ce document n'y figure pas, puis confirmez le renvoi.", { incertain: true });
    if (!(await db.reprendre(k, ex.maj, { statut: "en_cours", erreur: null, maj: now }))) return err(409, "Un autre poste traite ce document : réessayez dans un instant.", { en_cours: true });
  }
  const chemin = action === "signer" ? "/external/invoices/sign" : `/external/invoices/${encodeURIComponent(req.id)}/refund`, corps = action === "signer" ? req.payload : { items: req.items.map((i) => ({ id: i.id, quantity: +i.quantity })) };
  const r = await appelerDgi(fetchFn, a, chemin, corps);
  if (r.reseau) { await db.maj(k, { statut: "incertain", erreur: r.message, maj: now }); return err(504, `La DGI n'a pas répondu (${r.message}) : l'état de la certification est incertain. Vérifiez sur la plateforme FNE avant de renvoyer.`, { incertain: true }); }
  if (r.http === 200 || r.http === 201) {
    const rr = reduire(r.j);
    if (!rr.reference || !rr.token) { await db.maj(k, { statut: "incertain", erreur: "réponse incomplète", maj: now }); return err(502, "Réponse de la DGI incomplète : vérifiez sur la plateforme FNE avant de renvoyer.", { incertain: true }); }
    await db.maj(k, { statut: "certifiee", reponse: rr, erreur: null, maj: now });
    return rep(200, { ok: true, rejoue: false, reponse: rr });
  }
  const msg = txt(r.j && (r.j.message || r.j.error), 300) || `Erreur ${r.http}`;
  await db.maj(k, { statut: "echec", erreur: msg, maj: now });
  return err(r.http === 401 ? 502 : r.http >= 500 ? 502 : 422, r.http === 401 ? "Clé API de la DGI refusée (401) : vérifiez le secret du serveur." : "Refusé par la DGI : " + msg, { dgi: r.http });
}
