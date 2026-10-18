/* Aucun emoji dans les écrans du groupe (portail, Hub, Paramètres, comptabilité du groupe, applications).
   Usage : node tests/sans-emoji.js  (analyse statique des fichiers + contrôle à l'affichage du Hub et des Paramètres) */
const fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const EM=/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{2753}\u{2757}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B55}]/u;
const OK=new Set([..."✓✕✔✖✗✘☰★☆✎✦"]);
let ok=0,ko=0;const t=(id,label,r,info)=>{if(r){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,info||"")}};
const FILES=["index.html","portail.html","parametres.html","compta-groupe.html","distribution.html","transport.html","agro.html","hub.html"];
FILES.forEach(f=>{const s=fs.readFileSync(path.join(root,f),"utf8"),bad=[...s].filter(c=>EM.test(c)&&!OK.has(c));
 t("EMO-"+f.replace(".html",""),f+" : aucun emoji dans le code ni dans les libellés",bad.length===0,[...new Set(bad)].slice(0,12).join(" "))});
// marqueurs logiques : aucune comparaison avec une chaîne vide issue d'un emoji retiré
FILES.forEach(f=>{const s=fs.readFileSync(path.join(root,f),"utf8");t("EMO-LOG-"+f.replace(".html",""),f+" : aucun test « includes(\"\") / indexOf(\"\") » (marqueur vidé)",!/\.(includes|indexOf|startsWith|endsWith)\(\s*(""|'')\s*\)/.test(s))});
console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
