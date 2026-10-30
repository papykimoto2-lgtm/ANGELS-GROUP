/* Base en mémoire pour l'accès chauffeur (même contrat que supabase/functions/_shared/serveur-chauffeur.js). */
const sync=require("./sync-memoire.js");
module.exports=()=>{const m=sync(),E=new Map();
 const sousObjet=(o,c)=>Object.keys(c).every(k=>JSON.stringify(o&&o[k])===JSON.stringify(c[k]));
 m.liste=async(app,coll,o={})=>{let L=[...m.D.rows.values()].filter(r=>r.app===app&&r.coll===coll&&!r.supprime).sort((a,b)=>b.seq-a.seq);
  L=L.map(r=>JSON.parse(JSON.stringify(r.data)));
  if(o.contient)L=L.filter(x=>sousObjet(x,o.contient));
  if(o.depuis)L=L.filter(x=>String(x[o.depuis.champ])>=o.depuis.iso);
  if(o.dans)L=L.filter(x=>o.dans.valeurs.includes(String(x[o.dans.champ])));
  return L.slice(0,Math.min(+o.limite||1000,10000))};
 m.essais=async uid=>E.get(uid)||null;m.noterEssai=async(uid,e)=>{E.set(uid,e)};m.effacerEssais=async uid=>{E.delete(uid)};m.E=E;
 return m};
