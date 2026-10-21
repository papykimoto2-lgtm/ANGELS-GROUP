/* Statistiques livreur : onglet « Statistiques » du Centre de livraison (par livreur, période, export, détail) et page « Mes statistiques » de l'application livreur (publiées par le bureau).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/stats-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],cm=S.commandes[0];lv.ident_serveur="test.lv";
  S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);S.avis=(S.avis||[]).filter(a=>a.livreur_id!==lv.id);
  const z=S.config.zones[0],h=36e5,now0=Date.now();
  const mk=(id,st,minDepuis,dureeMin,extra)=>{const fin=new Date(now0-minDepuis*60000).toISOString(),dep=new Date(now0-(minDepuis+dureeMin)*60000).toISOString();const l=Object.assign({id,commande_id:cm.id,livreur_id:lv.id,statut:st,affectee_at:dep,depart_at:dep,fin_at:fin,montant_attendu:0,montant_encaisse:0},extra||{});S.livraisons.push(l);return l};
  const a=mk("sa1","livree",60,30,{montant_encaisse:5000}),b2=mk("sa2","livree",120,50,{montant_encaisse:7000}),c=mk("sa3","livree",20*60*24,200,{montant_encaisse:3000}),d=mk("sa4","echouee",90,20,{motif_echec:"Client absent"}),e=mk("sa5","echouee",95,15,{motif_echec:"Client absent"});
  S.avis.push({livraison_id:"sa1",livreur_id:lv.id,note:5},{livraison_id:"sa2",livreur_id:lv.id,note:3});
  const d0=new Date();d0.setHours(0,0,0,0);const t=Date.now();
  const o={};const s7=statLiv(lv,d0.getTime()-6*864e5,t),s30=statLiv(lv,d0.getTime()-29*864e5,t);o.s7=[s7.livrees,s7.echecs,Math.round(s7.taux),Math.round(s7.duree),s7.encaisse,s7.note,s7.motifs[0]];o.s30=[s30.livrees,s30.echecs,s30.encaisse,s30.jours];
  /* publication */
  const M=passStatsMissions(),m=M.find(x=>x.livreur_ref===lv.id);o.pub=M.length>0&&m&&m.statut==="stats"&&m.livraison_ref==="stats:"+lv.id&&!!m.payload.p.j&&!!m.payload.p.s7&&!!m.payload.p.m30&&!!m.payload.p.mois&&m.payload.jours7.length===7;
  o.stable=JSON.stringify(passStatsMissions())===JSON.stringify(M);o.pasSans=!M.some(x=>!S.livreurs.find(l=>l.id===x.livreur_ref).ident_serveur);
  o.pas7=m.payload.p.s7.livrees;o.pasM30=m.payload.p.m30.livrees;
  /* Centre de livraison */
  view="livraisons";ui={cdt:"sta",stp:"30"};const html=VIEWS.livraisons();o.tab=/data-id="cdt\|sta"/.test(html)&&/Par livreur/.test(html)&&/Statistiques/.test(html);o.ligne=html.includes(lv.nom)&&/Client absent|Détail/.test(html);
  let csv=null;const cd=window.csvDown;window.csvDown=(n,hd,rows)=>{csv={n,hd,rows}};ACT.statCsv();window.csvDown=cd;o.csv=csv&&csv.n==="statistiques_livreurs"&&csv.hd.length===11&&csv.rows.some(r=>r[0]===lv.nom&&r[1]===3);
  ACT.statDetail(lv.id);const mo=document.getElementById("modal").innerHTML;o.detail=/Client absent/.test(mo)&&/Zones desservies/.test(mo)&&/Motifs d'échec fréquents/.test(mo);
  ui.stp="7";const h7=VIEWS.livraisons();o.periode=h7.includes(lv.nom);
  return o});
 chk("SL-1","calculs : 7 jours = 2 livrées, 2 échecs, 50 % de réussite, durée moyenne 40 min, 12 000 F encaissés, note 4, motif « Client absent » ×2 ; 30 jours = 3 livrées",JSON.stringify(r.s7)==='[2,2,50,40,12000,4,["Client absent",2]]'&&r.s30[0]===3&&r.s30[1]===2&&r.s30[2]===15000,JSON.stringify([r.s7,r.s30]));
 chk("SL-2","publication au livreur : une pseudo-mission « stats » (aujourd'hui, 7 jours, 30 jours, mois + 7 derniers jours) uniquement pour les livreurs avec compte ; contenu stable (pas de republication inutile)",r.pub&&r.stable&&r.pasSans&&r.pas7===2&&r.pasM30===3,JSON.stringify(r));
 chk("SL-3","Centre de livraison : onglet « Statistiques » avec le tableau par livreur, la période, l'export CSV (11 colonnes) et la fenêtre de détail (motifs d'échec, zones)",r.tab&&r.ligne&&r.csv&&r.detail&&r.periode,JSON.stringify(r));
 /* application livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(()=>{const X=n=>({livrees:n,echecs:1,taux:n/(n+1)*100,duree:42,delais:80,encaisse:25000,gains:3500,jours:3,moy:n/3,note:4.5,nnotes:2,motifs:[["Client absent",1]],zones:[["Yopougon",n]],best:["2026-10-20",2]});
  const pseudo={livraison_ref:"stats:l1",livreur_ref:"l1",commande_ref:"STATS",statut:"stats",maj_le:new Date().toISOString(),payload:{p:{j:X(1),s7:X(6),m30:X(20),mois:X(10)},jours7:[0,1,2,0,3,1,2].map((n,i)=>({l:"j"+i,n}))}};
  const vrai={livraison_ref:"a",commande_ref:"CMD-1",statut:"en_cours",payload:{numero:"CMD-1",client_nom:"C",adr:{zone:"Z"},lignes:[],montant_attendu:0}};
  user={id:"u"};moi={nom:"Livreur Test"};const o={};
  o.sans=(()=>{missions=recevoir([vrai]);PAGE="stats";vueMissions();return /pas encore disponibles/.test(document.body.innerText)})();
  missions=recevoir([vrai,pseudo]);o.separe=missions.length===1&&missions[0].livraison_ref==="a"&&!!STATS;
  PAGE="cours";vueMissions();o.pasMission=!/stats:l1|STATS/.test(document.body.innerText);
  MENU=true;vueMissions();o.menu=/Mes statistiques/.test(document.querySelector(".dr nav").innerText);MENU=false;
  PAGE="stats";SP="s7";vueMissions();const t7=document.body.innerText;o.s7=/Mes statistiques/.test(t7)&&/6\s*livraisons/.test(t7)&&/86 %|86%/.test(t7)&&/42 min/.test(t7)&&/mes gains/.test(t7)&&/Client absent/.test(t7)&&/Yopougon/.test(t7)&&/7 derniers jours/.test(t7)&&/4\.5 ★/.test(t7);
  ACT.sp("j");const tj=document.body.innerText;ACT.sp("mois");const tm=document.body.innerText;o.periodes=/1\s*livraisons/.test(tj)&&/10\s*livraisons/.test(tm)&&!!document.querySelector(".chip.on");
  return o});
 chk("SL-4","application livreur : « Mes statistiques » dans le menu ☰ ; la pseudo-mission « stats » n'apparaît jamais comme commande ; message tant que le bureau n'a rien publié",v.sans&&v.separe&&v.pasMission&&v.menu,JSON.stringify(v));
 chk("SL-5","page « Mes statistiques » : livraisons, échecs, réussite, durée, délais, note, encaissé, gains, activité, motifs d'échec, zones, 7 derniers jours ; périodes aujourd'hui / 7 jours / 30 jours / mois",v.s7&&v.periodes,JSON.stringify(v));
 chk("SL-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
