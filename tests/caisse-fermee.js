/* Source unique d encaissement (livreurs, fournisseurs) et caisse fermée : avertissement, mise en attente et rangement à l ouverture.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/caisse-fermee.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const dlg=[];let reponse=true;p.removeAllListeners("dialog");p.on("dialog",d=>{dlg.push(d.message());reponse?d.accept():d.dismiss()});
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  const l=S.livreurs.find(x=>S.livraisons.some(y=>y.livreur_id===x.id&&y.statut==="livree"))||S.livreurs[0];window.__L=l.id;
  S.livraisons.filter(y=>y.livreur_id===l.id&&isActive(y)).forEach(y=>y.statut="livree");S.clotures=[];S.versements=[];S.caisse_file=[];S.fonds=S.fonds.filter(f=>!(f.type==="reversement"&&f.livreur_id===l.id));
  window.__fermer=()=>{(S.caisse_sessions||[]).filter(s=>s.statut==="ouverte").forEach(s=>{s.statut="cloturee";s.cloturee_le=now();s.fond_cloture_reel=cxSolde(cxCaisse(s.caisse_id));s.fond_cloture_theorique=s.fond_cloture_reel;s.ecart=0})};
  window.__esp=()=>(S.caisse_mvts||[]).length;window.__PR=()=>[...document.querySelectorAll(".ov")].map(e=>e.remove());__fermer()});
 let ok=0,ko=0;const t=async(id,label,fn,a)=>{let r;try{r=await p.evaluate(fn,a)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 const src=fs.readFileSync(path.join(root,"distribution.html"),"utf8");
 const n=(re)=>(src.match(re)||[]).length;
 const chk=(id,label,v,i)=>{if(v===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i)}};
 chk("SV-1","source unique livreurs : un seul endroit crée un reversement (type:\"reversement\") dans le code",n(/type:"reversement",livreur_id/g)===1,n(/type:"reversement",livreur_id/g));
 chk("SV-2","source unique fournisseurs : un seul endroit crée un règlement (S.reglements.push)",n(/S\.reglements\.push\(/g)===1,n(/S\.reglements\.push\(/g));
 await t("SV-3","bons manuels : « Reversement livreur », « Règlement vendeur » et « Paie livreurs » ne sont plus proposés",()=>!CX_IN.includes("Reversement livreur")&&!CX_OUT.includes("Règlement vendeur")&&!CX_OUT.includes("Paie livreurs")?true:JSON.stringify([CX_IN,CX_OUT]));
 await t("SV-4","caisse fermée : alerte visible dans la Trésorerie",()=>{__as("caissier");view="tresorerie";render();return cxFermee()&&/La caisse est fermée/.test(document.querySelector("main").innerText)?true:document.querySelector("main").innerText.slice(0,300)});
 // clôture espèces, caisse fermée, refus puis acceptation
 const r1=await p.evaluate(()=>{__as("caissier");const r=clotRecap(__L);window.__due=r.du;window.__e0=__esp();clotFormUI(__L);const f=document.getElementById("mf");f.m.value=r.du;f.ok.checked=true;f.mode.value="Espèces";return{alerteForm:/La caisse est fermée/.test(document.querySelector(".ov").innerText),due:r.du}});
 reponse=false;await p.evaluate(()=>{document.getElementById("mf").requestSubmit()});await p.waitForTimeout(200);
 const a1=await p.evaluate(()=>({rev:S.fonds.filter(f=>f.type==="reversement"&&f.livreur_id===__L).length,file:S.caisse_file.length,cl:clotList().filter(c=>c.statut==="cloturee").length}));
 chk("SV-5","clôture en espèces, caisse fermée : alerte dans le formulaire, avertissement clair (« LA CAISSE EST FERMÉE », rangée dès l'ouverture), « Annuler » n'enregistre rien",r1.alerteForm&&/LA CAISSE EST FERMÉE/.test(dlg[0]||"")&&/rangés automatiquement en caisse dès son ouverture/.test(dlg[0]||"")&&a1.rev===0&&a1.file===0&&a1.cl===0,JSON.stringify({r1,a1,dlg:dlg[0]}));
 reponse=true;await p.evaluate(()=>{document.getElementById("mf").requestSubmit()});await p.waitForTimeout(300);
 const a2=await p.evaluate(()=>({rev:S.fonds.filter(f=>f.type==="reversement"&&f.livreur_id===__L).length,file:S.caisse_file.map(x=>[x.type,x.montant,x.source]),mv:__esp()-__e0,solde:soldeLiv(__L),due:__due}));
 chk("SV-6","« OK » : la clôture est enregistrée, l'argent est mis en attente (pas en caisse) et le solde du livreur est apuré",a2.rev===1&&a2.file.length===1&&a2.file[0][0]==="entree"&&a2.file[0][1]===a2.due&&a2.mv===0&&a2.solde===0,JSON.stringify(a2));
 await t("SV-7","bannière « en attente de caisse » : Trésorerie et Caisse, avec le montant",()=>{__as("caissier");view="tresorerie";render();const x=document.querySelector("main").innerText;view="caisse";render();const y=document.querySelector("main").innerText;return /en attente de caisse/.test(x)&&/en attente de caisse/.test(y)&&x.includes(fcfa(S.caisse_file[0].montant).replace(/ | /g," "))||/en attente de caisse/.test(x)&&/en attente de caisse/.test(y)?true:x.slice(0,300)});
 // ouverture de la caisse : rangement automatique
 const o=await p.evaluate(()=>{__as("caissier");const c=S.caisses.filter(x=>x.actif).sort((a,b)=>String(a.compte).localeCompare(b.compte))[0];const s0=cxSolde(c),m=S.caisse_file[0].montant;cxOuvrirLocal(c,null,"");const s1=cxSolde(c);const mv=S.caisse_mvts.filter(x=>x.source==="reversement"&&x.caisse_id===c.id).slice(-1)[0];
  const r={file:S.caisse_file.length,delta:s1-s0,m,mv:mv&&[mv.type,mv.montant,mv.statut,/rattrapé/.test(mv.motif)]};const n2=cxRanger();r.n2=n2;r.nb=S.caisse_mvts.filter(x=>/rattrapé/.test(x.motif)).length;return r});
 chk("SV-8","à l'ouverture de la caisse : l'argent en attente est rangé automatiquement (entrée validée, solde augmenté), sans doublon",o.file===0&&o.delta===o.m&&o.mv&&o.mv[0]==="entree"&&o.mv[1]===o.m&&o.mv[2]==="valide"&&o.mv[3]&&o.n2===0&&o.nb===1,JSON.stringify(o));
 // Mobile Money : pas d'avertissement
 await p.evaluate(()=>{__fermer();S.livraisons.filter(y=>y.livreur_id===__L&&isActive(y)).forEach(y=>y.statut="livree");S.fonds.push({id:"fzz",type:"encaissement",livreur_id:__L,livraison_id:"zz2",montant:9000,mode:"Espèces",ts:now()});S.clotures=[]});
 dlg.length=0;const m1=await p.evaluate(async()=>{__as("caissier");ACT.reverserPartiel(__L);const f=document.getElementById("mf");f.m.value=4000;f.mode.value=S.config.modes.find(x=>estMobile(x));f.ref.value="WAVE-FERME-01";const f0=S.caisse_file.length;f.requestSubmit();await new Promise(r=>setTimeout(r,200));return{rev:S.fonds.filter(x=>x.ref==="WAVE-FERME-01").length,file:S.caisse_file.length-f0}});
 chk("SV-9","Mobile Money, caisse fermée : aucun avertissement, rien en attente (ce n'est pas de l'espèce)",m1.rev===1&&m1.file===0&&dlg.length===0,JSON.stringify({m1,dlg}));
 // encaissement partiel espèces, caisse fermée
 reponse=true;dlg.length=0;const m2=await p.evaluate(async()=>{ACT.reverserPartiel(__L);const f=document.getElementById("mf");f.m.value=2000;f.mode.value="Espèces";const f0=S.caisse_file.length;f.requestSubmit();await new Promise(r=>setTimeout(r,200));return{file:S.caisse_file.length-f0}});
 chk("SV-10","encaissement partiel en espèces, caisse fermée : même avertissement et mise en attente",/LA CAISSE EST FERMÉE/.test(dlg[0]||"")&&m2.file===1,JSON.stringify({m2,dlg:dlg[0]}));
 // un seul bouton Encaisser : tournée en cours → partiel ; terminée → clôture
 await t("SV-11","« Encaisser » (ACT reverser) : courses en cours → encaissement partiel ; tournée terminée → formulaire de clôture",()=>{__as("caissier");PR=__PR;__PR();const l=S.livraisons.find(y=>y.livreur_id===__L&&y.statut==="livree");const st=l.statut;l.statut="en_cours";ACT.reverser(__L);const a=/Reversement —/.test(document.querySelector(".ov")?document.querySelector(".ov").innerText:"");__PR();l.statut=st;S.fonds.push({id:"fz3",type:"encaissement",livreur_id:__L,livraison_id:l.id,montant:1000,mode:"Espèces",ts:now()});ACT.reverser(__L);const b=/Clôture de tournée —/.test(document.querySelector(".ov")?document.querySelector(".ov").innerText:"");__PR();return a&&b?true:JSON.stringify([a,b])});
 // pas de caisse configurée : comportement inchangé
 dlg.length=0;const m3=await p.evaluate(async()=>{S.caisses=[];S.caisse_file=[];return{fermee:cxFermee(),ok:cxAvertirFermee(5000,"Espèces")}});
 chk("SV-12","aucune caisse configurée : pas d'avertissement ni de mise en attente",!m3.fermee&&m3.ok&&dlg.length===0,JSON.stringify([m3,dlg]));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
