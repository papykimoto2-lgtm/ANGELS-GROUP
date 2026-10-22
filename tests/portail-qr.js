/* QR code personnalisé du vendeur partenaire + suivi : affiche PNG, source (qr / lien) dans le lien, comptage des visites (serveur), statistiques du vendeur, source portée par la commande.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-qr.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/portail-demandes.js");
 const D={scans:[],vend:{V1:"h"}};
 const db={empreinteVendeur:async v=>D.vend[v]||null,compterScans:async(h,j)=>D.scans.filter(s=>s.visiteur===h&&s.jour===j).length,
  ajouterScan:async r=>{if(!D.scans.some(s=>s.vendeur===r.vendeur&&s.jour===r.jour&&s.src===r.src&&s.visiteur===r.visiteur))D.scans.push(r)},
  statsScans:async(v,dep)=>({qr:D.scans.filter(s=>s.vendeur===v&&s.src==="qr"&&s.jour>=dep).length,lien:D.scans.filter(s=>s.vendeur===v&&s.src==="lien"&&s.jour>=dep).length})};
 const cfg={sel:"s"},NOW=Date.parse("2026-10-22T10:00:00Z"),sc=(v,s,ip)=>P.recevoir(db,cfg,{scan:{v,s}},ip||"1.1.1.1",NOW);
 let r=await sc("V1","qr");chk("QR-1","visite par QR d'un vendeur : comptée",r.status===200&&r.body.compte===true&&D.scans.length===1,JSON.stringify(r));
 await sc("V1","qr");chk("QR-2","même visiteur, même jour, même source : pas recompté",D.scans.length===1);
 await sc("V1","lien");await sc("V1","qr","2.2.2.2");chk("QR-3","autre source ou autre visiteur : comptés séparément ; l'adresse n'est jamais stockée",D.scans.length===3&&!JSON.stringify(D.scans).includes("1.1.1.1")&&D.scans.every(s=>s.visiteur.length===64));
 const inc=await sc("INCONNU","qr","3.3.3.3");chk("QR-4","vendeur sans clé de relève : rien n'est compté (pas de remplissage de la base)",inc.status===200&&inc.body.compte===false&&D.scans.length===3);
 const bad=[await sc("","qr"),await sc("V1","autre"),await P.recevoir(db,cfg,{scan:{v:"V1"}},"4.4.4.4",NOW)];chk("QR-5","visite illisible (vendeur absent, source inconnue) : refusée",bad.every(x=>x.status===400)&&D.scans.length===3,JSON.stringify(bad.map(x=>x.status)));
 for(let i=0;i<25;i++)D.vend["W"+i]="h";for(let i=0;i<25;i++)await sc("W"+i,"qr","5.5.5.5");const par=D.scans.reduce((m,x)=>{m[x.visiteur]=(m[x.visiteur]||0)+1;return m},{});chk("QR-6","plafond par visiteur et par jour : 20 visites au plus",Math.max(...Object.values(par))===20,JSON.stringify(Object.values(par)));
 const v1=await P.traiterVendeur({empreinteVendeur:async()=>null,statsScans:async()=>({qr:9,lien:9})},{vendeur:"V1",cle:"X",action:"stats"});chk("QR-7","statistiques : réservées au vendeur qui présente sa clé de relève",v1.status===401&&!JSON.stringify(v1.body).includes("9"));
 const sha=async s=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("");
 const dbV=Object.assign({},db,{empreinteVendeur:async()=>await sha("vendeur|AAAAA-BBBBB")});const st=await P.traiterVendeur(dbV,{vendeur:"V1",cle:"aaaaa-bbbbb",action:"stats"});
 chk("QR-8","statistiques : avec la bonne clé, visites des 30 derniers jours par source (V1 : 2 par QR, 1 par lien)",st.status===200&&st.body.scans.qr===2&&st.body.scans.lien===1,JSON.stringify(st.body));
 const mig=fs.readFileSync(path.join(root,"supabase/migrations/014_portail_scans.sql"),"utf8");chk("QR-9","base : table protégée (RLS, aucun droit anon/authenticated), une ligne par visiteur/jour/source, purge à 90 jours",/enable row level security/.test(mig)&&/revoke all on public\.pd_scans from anon, authenticated/.test(mig)&&/unique \(vendeur, jour, src, visiteur\)/.test(mig)&&/current_date - 90/.test(mig)&&!/create policy/i.test(mig));
 /* ---------- Navigateur ---------- */
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:1100,height:1000}}),errs=[];let posts=[];
 await ctx.route("**/functions/v1/portail-demande",async rt=>{posts.push(JSON.parse(rt.request().postData()||"{}"));rt.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,refs:["X"],doublons:0,compte:true})})});
 await ctx.route("**/functions/v1/portail-vendeur",async rt=>{rt.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,scans:{qr:12,lien:8}})})});
 const d=await ctx.newPage();d.on("pageerror",e=>errs.push("D:"+e.message));d.on("dialog",x=>x.accept());await d.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});await d.goto(base+"/distribution.html");await d.waitForTimeout(600);
 const info=await d.evaluate(async()=>{ME=S.users.find(u=>u.role==="vendeur");const v=vend();v.tel=v.tel||"0708080808";S.config.portail_vendeur_cle="AAAAA-BBBBB";
  S.demandes=[{id:"a",vendeur_id:v.id,via:"lien",source:"qr",statut:"nouvelle",cree_le:new Date().toISOString()},{id:"b",vendeur_id:v.id,via:"lien",source:"qr",statut:"confirmee",cree_le:new Date().toISOString()},{id:"c",vendeur_id:v.id,via:"lien",source:"lien",statut:"rejetee",cree_le:new Date().toISOString()},{id:"d",vendeur_id:v.id,via:"lien",source:"lien",statut:"nouvelle",cree_le:"2020-01-01T00:00:00Z"}];
  const lq=lienCourtCommande({boutique:v.nom,tel:"0708080808",ref:v.id,src:"qr"});await cmdLien(false);await new Promise(r=>setTimeout(r,400));
  const cv=document.getElementById("qrc"),link=[...document.querySelectorAll("input[readonly]")].map(i=>i.value).find(x=>/commander/.test(x));
  const px=cv?cv.getContext("2d").getImageData(540,700,1,1).data.slice(0,3).join():"";return{has:!!cv,w:cv&&cv.width,h:cv&&cv.height,link,lq,nom:v.nom,stats:document.getElementById("qrst").innerText,btn:!!document.querySelector("[data-act=qrTelecharger]")&&!!document.querySelector("[data-act=qrPartager]")}});
 chk("QR-10","fiche du vendeur : affiche QR personnalisée (1080×1350) avec boutons Télécharger / Partager ; lien partagé sans marque « qr », lien du QR avec src=qr",info.has&&info.w===1080&&info.h===1350&&info.btn&&!/src=/.test(info.link)&&/src=qr/.test(info.lq),JSON.stringify(info).slice(0,300));
 chk("QR-11","statistiques 30 jours : 12 visites QR, 8 par lien (serveur), 4 commandes reçues dont 1 ancienne exclue → 3, conversion 15 %",/12\s*\n?visites par QR/.test(info.stats)&&/8\s*\n?visites par lien/.test(info.stats)&&/3\s*\n?commandes reçues/.test(info.stats)&&/15 %/.test(info.stats)&&/Par QR : 2/.test(info.stats)&&/acceptées : 1/.test(info.stats),info.stats);
 const dl=await d.evaluate(async()=>{const cv=document.getElementById("qrc"),b=await qrPng(cv);return{type:b.type,size:b.size}});chk("QR-12","l'affiche s'exporte en PNG",dl.type==="image/png"&&dl.size>5000,JSON.stringify(dl));
 /* client : ouvre le lien du QR */
 const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push("P:"+e.message));await pg.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 const u=new URL(info.lq);await pg.goto(base+"/portail.html"+u.search);await pg.waitForTimeout(800);await pg.reload();await pg.waitForTimeout(600);
 const scans=posts.filter(p=>p.scan);chk("QR-13","portail : la visite est signalée une seule fois par session (source « qr », identifiant du vendeur), même après rechargement",scans.length===1&&scans[0].scan.s==="qr"&&scans[0].scan.v===u.searchParams.get("ref"),JSON.stringify(posts));
 await pg.fill(".c_d","Robe");await pg.fill("#c_nom","Awa");await pg.fill("#c_tel","0701020304");await pg.selectOption("#c_zone",{index:1});await pg.fill("#c_q","Riviera");await pg.click("#c_send");await pg.waitForTimeout(300);posts=[];await pg.click("[data-direct]");await pg.waitForTimeout(500);
 const cm=posts.find(p=>p.message),m=/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/.exec(cm&&cm.message||""),dp=m&&JSON.parse(Buffer.from(m[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
 chk("QR-14","la commande porte la source (qr) et arrive dans la demande du vendeur avec cette source",!!dp&&dp.s==="qr",JSON.stringify(dp));
 const imp=await d.evaluate(m=>{S.demandes=[];webImporter(m);return S.demandes[0]&&S.demandes[0].source},cm.message);chk("QR-15","import : la demande garde sa source",imp==="qr",String(imp));
 chk("QR-16","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await br.close();srv.close();process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
