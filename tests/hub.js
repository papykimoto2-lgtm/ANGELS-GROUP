/* Contrôle du hub consolidé : les chiffres du hub doivent égaler ceux calculés par chaque application.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/hub.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 // 1. hub avant toute utilisation : « non ouvert »
 let h=await page("index.html");const vide=await h.$eval("#tcons",e=>e.innerText);t("HUB-1","applications jamais ouvertes : « non ouvert », aucun chiffre inventé",/non ouvert/.test(vide)&&!/[1-9]\d* F/.test(vide.replace(/0 F/g,""))?true:vide.slice(0,200));await h.close();
 // 2. valeurs de référence calculées par chaque application
 const pl=await page("distribution.html"),pt=await page("transport.html"),pa=await page("agro.html");
 const ref={};
 ref.D=await pl.evaluate(()=>{const M=new Date().toISOString().slice(0,7),lv=S.commandes.filter(c=>c.statut==="livree");return{tres:(S.caisses||[]).reduce((s,c)=>s+cxSolde(c),0),ca:lv.filter(c=>String(c.date).startsWith(M)).reduce((s,c)=>s+c.total,0),cre:lv.reduce((s,c)=>s+soldeCmd(c),0)}});
 ref.T=await pt.evaluate(()=>{const M=today().slice(0,7);return{tres:sum(S.entries.flatMap(e=>e.lines.filter(l=>[cdef("treso_caisse"),cdef("treso_banque"),cdef("treso_mobile"),...S.caisses.map(c=>c.compte)].includes(l.compte))),l=>(l.debit||0)-(l.credit||0)),ca:sum(S.entries.filter(e=>e.date.startsWith(M)).flatMap(e=>e.lines.filter(l=>l.compte===cdef("produit"))),l=>(l.credit||0)-(l.debit||0)),enc:sum(S.payments.filter(p=>p.statut==="confirme"&&p.type!=="depot"&&p.date_valeur.startsWith(M)),p=>p.montant),cre:sum(S.tiers.filter(x=>x.type==="chauffeur"),x=>soldeTiers(x.id)),res:(()=>{let p=0,c=0;S.entries.filter(e=>e.date.startsWith(M)).forEach(e=>e.lines.forEach(l=>{if(l.compte[0]==="7")p+=(l.credit||0)-(l.debit||0);if(l.compte[0]==="6")c+=(l.debit||0)-(l.credit||0)}));return p-c})()}});
 ref.A=await pa.evaluate(()=>{const M=today().slice(0,7);return{tres:sum([...new Set([cdef("caisse"),cdef("banque"),...(S.caisses||[]).map(c=>c.compte)])],c=>soldeCompte(c)),ca:sum(S.ventes.filter(v=>v.statut==="valide"&&v.date.startsWith(M)),v=>v.total),enc:sum(S.encaiss.filter(e=>e.statut==="valide"&&e.date.startsWith(M)),e=>e.montant),cre:sum(S.clients,c=>soldeClient(c.id)),res:(()=>{let p=0,c=0;S.entries.filter(e=>e.date.startsWith(M)).forEach(e=>e.lignes.forEach(l=>{if(l.compte[0]==="7")p+=(l.credit||0)-(l.debit||0);if(l.compte[0]==="6")c+=(l.debit||0)-(l.credit||0)}));return p-c})()}});
 console.log("références :",JSON.stringify(ref));
 h=await page("index.html");
 const hub=await h.evaluate(()=>({D:distribution(lire("angels_erp_v1")),T:transport(lire("angels_transport_v3")),A:agro(lire("angels_agro_v1"))}));
 for(const[f,ks] of [["D",["tres","ca","cre"]],["T",["tres","ca","enc","cre","res"]],["A",["tres","ca","enc","cre","res"]]]){const bad=ks.filter(k=>Math.round(hub[f][k])!==Math.round(ref[f][k])).map(k=>k+" hub="+hub[f][k]+" app="+ref[f][k]);t("HUB-2-"+f,"chiffres égaux à ceux de l'application ("+ks.join(", ")+")",bad.length?bad.join("; "):true)}
 const tot=await h.evaluate(()=>[...document.querySelectorAll("#big b")].map(e=>e.textContent));const att=[ref.D.tres+ref.T.tres+ref.A.tres,ref.D.ca+ref.T.ca+ref.A.ca,hub.D.enc+ref.T.enc+ref.A.enc,ref.D.cre+ref.T.cre+ref.A.cre].map(n=>Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g," ")+" F");
 t("HUB-3","totaux du groupe = somme des filiales",JSON.stringify(tot)===JSON.stringify(att)?true:JSON.stringify(tot)+" ≠ "+JSON.stringify(att));
 t("HUB-4","résultat de Distributions non inventé (« dans son module »)",(await h.$eval("#tcons",e=>e.innerText)).includes("dans son module")?true:"absent");
 // 3. mise à jour après une opération dans Transport
 await pt.evaluate(()=>{ME=S.users.find(u=>u.role==="caissier");const o=S.obligations.find(x=>soldeOb(x)>0);atomic(()=>enregistrerPaiement({driver_id:o.driver_id,montant:1000,mode:"especes",date_valeur:today(),obs:[o.id],idem:"hub-test-1"}))});
 await h.reload();await h.waitForTimeout(300);const apres=await h.evaluate(()=>transport(lire("angels_transport_v3")).enc);
 t("HUB-5","le hub reflète un nouvel encaissement saisi dans Transport (+1 000 F)",Math.round(apres-hub.T.enc)===1000?true:(apres-hub.T.enc));
 const html=await h.content();t("HUB-6","aucune valeur « NaN » / « undefined » affichée",!/NaN|undefined/.test(await h.$eval("#cons",e=>e.innerText))?true:"valeur invalide");
 // tableau de bord par module
 const tb=await h.evaluate(()=>{const r={};for(const m of["dist","trans","agro"]){document.querySelector(`.tab[data-m=${m}]`).click();r[m]=document.getElementById("tdb").innerText}return r});
 t("HUB-7","un onglet de tableau de bord par module, avec indicateurs et 6 mois de CA",["dist","trans","agro"].every(m=>/Trésorerie/.test(tb[m])&&/Indicateurs/.test(tb[m]))?true:JSON.stringify(tb).slice(0,200));
 t("HUB-8","tableau de bord sans « NaN » / « undefined »",!/NaN|undefined/.test(JSON.stringify(tb))?true:"valeur invalide");
 const clo=await h.evaluate(()=>{const G={entries:[{date:AUJ,journal:"OD",lignes:[{compte:"706",credit:100,debit:0}]},{date:AUJ,journal:"CLO",lignes:[{compte:"706",debit:100,credit:0}]},{date:AUJ,journal:"OD",source:{type:"cloture"},lines:[{compte:"606",debit:50,credit:0}]}]};return resCompta(G)});
 t("HUB-9","résultat du mois hors écritures de clôture",clo===100?true:clo);
 await h.screenshot({path:process.env.SHOT||"/tmp/hub-consolide.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
