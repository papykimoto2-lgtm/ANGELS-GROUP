/* Système livreurs, lot 3 (justesse et durcissement) : preuves réelles, quota d'actions, positions, numéros masqués côté serveur, refus après prise en charge,
   heure réelle de livraison, mission republiée quand le compte du livreur arrive.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/livreurs-lot3.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
(async()=>{
 const P=await import("file://"+path.resolve(__dirname,"../supabase/functions/_shared/passerelle.js"));
 /* ===== serveur ===== */
 const mk=(mis,extra)=>{const evs=[];return{evs,db:Object.assign({compteParUtilisateur:async()=>({livreur_ref:"lv1",actif:true}),mission:async()=>mis,code:async()=>null,preuve:async()=>({}),colis:async()=>[],ecrirePreuve:async()=>{},majMission:async()=>{},majCode:async()=>{},majPosition:async()=>{},ajouterEvenement:async e=>{evs.push(e)}},extra||{})}};
 const base=()=>({statut:"en_cours",livreur_ref:"lv1",commande_ref:"C",payload:{montant_attendu:5000,collecte_at:"2026-10-26T08:00:00Z"}});
 const conf=(o)=>({livraison_ref:"l1",type:"confirmer",donnees:Object.assign({montant:5000,recu_par:"Mme X",mode:"Espèces"},o)});
 const JPG="data:image/jpeg;base64,/9j/"+"A".repeat(1200),PNGOK="data:image/png;base64,iVBORw0KGgo"+"A".repeat(400);
 let t1=mk(base()),r1=await P.traiterAction(t1.db,{},conf({photo:"data:image/jpeg;base64,AAAA"}),"u");
 let t2=mk(base()),r2=await P.traiterAction(t2.db,{},conf({signature:"data:image/png;base64,iVBORw0KGgoAAAA"}),"u");
 let t3=mk(base()),r3=await P.traiterAction(t3.db,{},conf({photo:JPG,signature:PNGOK}),"u");
 chk("LL-1","photo ou signature factice (« data:image/jpeg;base64,AAAA », image trop courte) refusées ; vraies images acceptées",r1.status===400&&r2.status===400&&r3.status===200,JSON.stringify([r1.status,r2.status,r3.status]));
 /* refuser après prise en charge */
 const mm=base();mm.statut="acceptee";let t4=mk(mm),r4=await P.traiterAction(t4.db,{},{livraison_ref:"l1",type:"refuser",donnees:{motif:"Trop loin"}},"u");
 const m5=base();m5.statut="acceptee";m5.payload={};let t5=mk(m5),r5=await P.traiterAction(t5.db,{},{livraison_ref:"l1",type:"refuser",donnees:{motif:"Trop loin"}},"u");
 chk("LL-2","refuser une mission dont les colis sont déjà en main est impossible (appeler le bureau) ; avant la prise en charge c'est permis",r4.status===409&&/déjà pris en charge/.test(r4.body.erreur)&&r5.status===200,JSON.stringify([r4,r5.status]));
 /* quota */
 let n=0,t6=mk(base(),{nbEvenementsRecents:async()=>n});n=40;const r6=await P.traiterAction(t6.db,{},{livraison_ref:"l1",type:"incident",donnees:{nature:"Autre",description:"spam"}},"u");
 const r6b=await P.traiterAction(t6.db,{},{livraison_ref:"l1",type:"position",donnees:{lat:5.3,lng:-4}},"u");n=3;const r6c=await P.traiterAction(t6.db,{},{livraison_ref:"l1",type:"incident",donnees:{nature:"Autre",description:"vrai incident"}},"u");
 chk("LL-3","40 actions en une minute : la 41e est refusée (429) ; les positions ne comptent pas ; un usage normal passe",r6.status===429&&r6b.status===200&&r6c.status===200,JSON.stringify([r6.status,r6b.status,r6c.status]));
 /* positions : comparées à la dernière position TRANSMISE */
 const mp=base();mp.position_le=new Date(Date.now()-19000).toISOString();let rec=0;const t7=mk(mp,{nbEvenementsRecents:async()=>rec});
 await P.traiterAction(t7.db,{},{livraison_ref:"l1",type:"position",donnees:{lat:5.3,lng:-4}},"u");rec=1;await P.traiterAction(t7.db,{},{livraison_ref:"l1",type:"position",donnees:{lat:5.31,lng:-4}},"u");
 chk("LL-4","position : une position reçue toutes les 19 s remonte bien au bureau (comparaison à la dernière position transmise, pas à la dernière reçue) ; pas plus d'une par 20 s",t7.evs.length===1&&t7.evs[0].type==="position",JSON.stringify(t7.evs.map(e=>e.type)));
 /* numéros masqués par le serveur */
 const pub=[];const dbp={livreursConnus:async()=>["lv1"],refsAvecEvenementsEnAttente:async()=>[],ecrireMission:async m=>{pub.push(m)},ecrireCode:async()=>{},ecrireColis:async()=>{},retirerMissions:async()=>{}};
 await P.traiterSync(dbp,{adminKey:"k"},{action:"publier",missions:[{livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-2026-0001",statut:"en_cours",payload:{numero:"CMD-2026-0001",client_nom:"Koffi 07 01 02 03 04",adr:{repere:"appeler le 0505 77 77 77 en arrivant",zone:"Cocody"},lignes:[{desig:"Robe (client +225 07 08 09 10 11)",qte:1}],montant_attendu:5000}}]},"k");
 const pl=(pub[0]||{}).payload||{},tout=JSON.stringify(pl);
 chk("LL-5","les numéros de téléphone écrits dans le nom, l'adresse ou les articles sont masqués par le serveur ; le numéro de commande et les montants restent intacts",!/07 01 02 03 04|0505 77 77 77|07 08 09 10 11/.test(tout)&&pl.numero==="CMD-2026-0001"&&pl.montant_attendu===5000&&/••/.test(pl.client_nom),tout.slice(0,300));
 /* ===== bureau ===== */
 const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":path.extname(f)===".html"?"text/html; charset=utf-8":path.extname(f)===".js"?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base_="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:1300,height:1000}});
 const H={"access-control-allow-origin":"*","access-control-allow-headers":"*"};const pubs=[];let inconnus=["lvX"];
 await ctx.route("**/functions/v1/mission-sync",async rt=>{const rq=rt.request();if(rq.method()==="OPTIONS")return rt.fulfill({status:204,headers:H});const b=JSON.parse(rq.postData()||"{}");
  const J=o=>rt.fulfill({status:200,headers:H,contentType:"application/json",body:JSON.stringify(o)});if(b.action==="evenements")return J({ok:true,evenements:[]});if(b.action==="publier"){pubs.push(1);return J({ok:true,ecrites:0,ignorees:0,retirees:0,livreurs_inconnus:inconnus})}return J({ok:true,ecrits:0,ignores:0,commandes:[]})});
 const p=await ctx.newPage();p.on("dialog",d=>d.accept());await p.goto(base_+"/distribution.html");await p.waitForTimeout(600);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"k"};S.config.passerelle_actif=true;S.config.signature_seuil=99999999});
 /* heure réelle */
 let r=await p.evaluate(()=>{const lv=S.livreurs.find(l=>!l.archive);lv.user_id=lv.user_id||"u_test";const c0=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(c0));c.id="l3c";c.numero="CMD-L3";c.statut="prete";c.colis=null;c.date=new Date(Date.now()-5*864e5).toISOString();c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];S.commandes.push(c);
  CEN_DIRECT=true;let l;try{l=affecter(c,lv.id,"");accepter(l);priseEnCharge(l,1);demarrer(l)}finally{CEN_DIRECT=false}
  const reel=new Date(Date.now()-30*36e5).toISOString();const e=passAppliquer({id:931,type:"confirmer",cree_le:reel,livraison_ref:l.id,livreur_ref:lv.id,donnees:{montant:soldeCmd(c),mode:"Espèces",recu_par:"X",code_etat:"absent"}});
  const f=S.fonds.find(x=>x.livraison_id===l.id);return{e,fin:l.fin_at===reel,fts:f&&f.ts===reel}});
 chk("LL-6","une livraison confirmée hors ligne puis relevée tard est datée à l'heure réelle (livraison et encaissement), pas à l'heure de la relève",r.e===""&&r.fin&&r.fts,JSON.stringify(r));
 /* republication */
 await p.evaluate(()=>passSync(true));await p.waitForTimeout(500);const n1=pubs.length;
 await p.evaluate(()=>{_passLast=0;return passSync(true)});await p.waitForTimeout(500);
 chk("LL-7","mission destinée à un livreur sans compte serveur : elle est republiée au passage suivant (plus jamais « oubliée » une fois le compte créé)",pubs.length>n1,JSON.stringify([n1,pubs.length]));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await br.close();srv.close();process.exit(ko?1:0);
})();
