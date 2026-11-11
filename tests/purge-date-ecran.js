/* Purge par date, écran Distributions : accès réservé, sauvegarde obligatoire, aperçu, confirmation PURGER, suppression, intégrité des écrans.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/purge-date-ecran.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errs=[];
 let ok=0,ko=0;const chk=(id,l,o,i)=>{console.log(o===true?"PASS":"FAIL",id,l,o===true?"":"-> "+(i||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(600);
 await p.evaluate(()=>{window.__T=[];toast=(m,t)=>{__T.push((t||"")+":"+m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);
  /* données de démonstration réalistes : 4 commandes (avec leurs livraisons) et 1 session de caisse (avec ses mouvements) reculées de 8 jours */
  const shift=(o,j)=>{if(typeof o==="string")return /^\d{4}-\d\d-\d\dT/.test(o)?new Date(Date.parse(o)-j*864e5).toISOString():o;if(Array.isArray(o))return o.map(x=>shift(x,j));if(o&&typeof o==="object"){for(const k in o)o[k]=shift(o[k],j)}return o};
  const vieux=S.commandes.slice(0,4).map(c=>c.id),s0=S.caisse_sessions.find(s=>s.statut==="cloturee");
  S.commandes.filter(c=>vieux.includes(c.id)).forEach(c=>shift(c,8));S.livraisons.filter(l=>vieux.includes(l.commande_id)).forEach(l=>shift(l,8));
  shift(s0,8);S.caisse_mvts.filter(m=>m.session_id===s0.id).forEach(m=>shift(m,8));
  window.__att={c:vieux.length,l:S.livraisons.filter(l=>vieux.includes(l.commande_id)).length,s:1,m:S.caisse_mvts.filter(m=>m.session_id===s0.id).length,
   c0:S.commandes.length,l0:S.livraisons.length,vieux,cl:S.clients.length,u:S.users.length};
  window.__err=()=>{const e=[];NAV.filter(n=>n.v).map(n=>n.v).forEach(v=>{try{view=v;render()}catch(x){e.push(v+": "+x.message)}});return e};
  ui.prodSauve=0;ui.purgeJ=null;view="purge";render()});
 await p.waitForTimeout(150);
 const A=await p.evaluate(()=>window.__att),t=await p.evaluate(()=>document.body.innerText.replace(/\s+/g," "));
 const re=(n,k)=>new RegExp(n+"\\s*"+k).test(t);
 chk("PE-1","écran : titre, jour par défaut = hier, aperçu chiffré, bouton Supprimer désactivé sans sauvegarde",/Purger avant une date/.test(t)&&/antérieure au 2026-11-10/.test(t)&&re("Commandes",A.c+" "+(A.c0-A.c))&&re("Livraisons",A.l+" "+(A.l0-A.l))&&re("Caisse : sessions","1")&&await p.evaluate(()=>document.querySelector('[data-act="purgeGo"]').disabled),t.slice(380,900));
 chk("PE-2","données conservées qui pointent vers du supprimé signalées",/Données conservées qui référencent des éléments supprimés/.test(t),"");
 await p.evaluate(()=>{ACT.purgeGo()});const m0=await p.evaluate(()=>({n:S.commandes.length,t:__T.slice(-1)[0]}));
 chk("PE-3","sans sauvegarde : refus, rien supprimé",m0.n===A.c0&&/Téléchargez d'abord la sauvegarde/.test(m0.t||""),JSON.stringify(m0));
 const [dl]=await Promise.all([p.waitForEvent("download"),p.click('[data-act="prodSave"]')]);
 chk("PE-4","la sauvegarde se télécharge et débloque le bouton",!!dl.suggestedFilename()&&await p.evaluate(()=>!document.querySelector('[data-act="purgeGo"]').disabled),dl.suggestedFilename());
 await p.click('[data-act="purgeGo"]');await p.waitForTimeout(150);
 const mod=await p.evaluate(()=>({txt:(document.querySelector("#modal")||document.body).innerText,has:!!document.querySelector('#modal input[name="conf"]')}));
 chk("PE-5","confirmation : récapitulatif chiffré et phrase PURGER demandée",mod.has&&/PURGER/.test(mod.txt)&&new RegExp((A.c+A.l+A.s+A.m)+" enregistrement").test(mod.txt),mod.txt.slice(0,300));
 await p.fill('#modal input[name="conf"]',"purge ?");await p.click('#modal button.danger');await p.waitForTimeout(150);
 const nonConf=await p.evaluate(()=>({n:S.commandes.length,t:__T.slice(-1)[0]}));
 chk("PE-6","mauvaise phrase : refus, rien supprimé",nonConf.n===A.c0&&/PURGER pour confirmer/.test(nonConf.t||""),JSON.stringify(nonConf));
 await p.fill('#modal input[name="conf"]',"PURGER");await p.click('#modal button.danger');await p.waitForTimeout(250);
 const ap=await p.evaluate(()=>({c:S.commandes.length,l:S.livraisons.length,s:S.caisse_sessions.length,m:S.caisse_mvts.length,reste:S.commandes.some(c=>window.__att.vieux.includes(c.id)),cl:S.clients.length,u:S.users.length,aud:(S.audit||[]).some(a=>/Purge avant le 2026-11-10/.test(JSON.stringify(a)))}));
 chk("PE-7","suppression : exactement les éléments anciens partent ; clients et comptes intacts ; action inscrite à l'audit",ap.c===A.c0-A.c&&ap.l===A.l0-A.l&&ap.s===1&&!ap.reste&&ap.cl===A.cl&&ap.u===A.u&&ap.aud,JSON.stringify(ap)+JSON.stringify(A));
 const ec=await p.evaluate(()=>window.__err());
 chk("PE-8","tous les écrans restent affichables après la purge (références orphelines comprises)",ec.length===0,ec.join(" | "));
 await p.evaluate(()=>{ui.prodSauve=Date.now();ui.purgeJ="2026-11-11";view="purge";render();window.__e=null;try{purgeExecuter()}catch(e){window.__e=e.message}});
 chk("PE-9","date postérieure à hier refusée (hier et aujourd'hui toujours gardés)",/ne peut pas dépasser hier/.test(await p.evaluate(()=>window.__e||"")),"");
 const acc=await p.evaluate(()=>{ME=S.users.find(u=>u.role!=="admin"&&u.actif);ui.purgeJ=null;return VIEWS.purge()});
 chk("PE-10","accès réservé à l'administrateur",/Réservé à l'administrateur/.test(acc),acc.slice(0,200));
 chk("PE-11","aucune erreur de script",errs.length===0,errs.join("|"));
 console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();process.exit(ko?1:0)})();
