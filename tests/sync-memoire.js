/* Base en mémoire pour la synchronisation (même contrat que supabase/functions/_shared/serveur-sync.js) : partagée par tests/sync-serveur.js et tests/sync-postes.js. */
module.exports=()=>{const D={rows:new Map(),seq:0};const cle=(a,c,i)=>a+"\u0000"+c+"\u0000"+i;
 return{D,
  compter:async app=>[...D.rows.values()].filter(r=>r.app===app&&!r.supprime).length,
  depuis:async(app,depuis,n)=>[...D.rows.values()].filter(r=>r.app===app&&r.seq>depuis).sort((a,b)=>a.seq-b.seq).slice(0,n).map(r=>JSON.parse(JSON.stringify(r))),
  lire:async(app,cles)=>cles.map(c=>D.rows.get(cle(app,c.coll,c.id))).filter(Boolean).map(r=>JSON.parse(JSON.stringify(r))),
  ecrire:async lignes=>{for(const l of lignes){D.rows.set(cle(l.app,l.coll,l.id),Object.assign(JSON.parse(JSON.stringify(l)),{seq:++D.seq}))}}}};
