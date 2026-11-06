/* Base en mémoire de la comptabilité du groupe (même contrat que supabase/functions/_shared/serveur-compta.js). */
module.exports = function () {
  const U = { distribution: [], transport: [], agro: [] }, S = new Map(), E = new Map(), JR = []; let D = null;
  return {
    _users: U, _synth: S, _journal: JR,
    users: async (app) => U[app].map((x) => JSON.parse(JSON.stringify(x))),
    synthese: async (c) => (S.has(c) ? JSON.parse(JSON.stringify(S.get(c))) : null),
    syntheses: async (cles) => cles.filter((c) => S.has(c)).map((c) => ({ cle: c, data: JSON.parse(JSON.stringify(S.get(c))) })),
    ecrireSynthese: async (c, d) => { S.set(c, JSON.parse(JSON.stringify(d))); },
    droits: async () => (D ? JSON.parse(JSON.stringify(D)) : null), ecrireDroits: async (d) => { D = d ? JSON.parse(JSON.stringify(d)) : null; },
    essais: async (u) => E.get(u) || null, noterEssai: async (u, e) => { E.set(u, e); }, effacerEssais: async (u) => { E.delete(u); },
    journaliser: async (e) => { JR.push(Object.assign({ t: new Date().toISOString() }, e)); }, journal: async (n) => JR.slice(-n).reverse(),
  };
};
