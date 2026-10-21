/* Filtres date et lieu de livraison : Tableau de bord (période, dates précises, lieu) et Centre de livraison (à affecter, courses actives, échecs).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livraison-filtres.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(700);
 /* jeu de données : 3 courses terminées (2 quartiers, 2 dates) */
 const r=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],cl=S.clients[0],base=S.commandes[0];
  const mk=(num,quartier,zone,jours)=>{const t=new Date(Date.now()-jours*864e5).toISOString(),c=JSON.parse(JSON.stringify(base));c.id="tc_"+num;c.numero=num;c.date=t;c.statut="livree";c.adr=Object.assign({},c.adr,{zone,quartier,repere:""});S.commandes.push(c);
   S.livraisons.push({id:"tl_"+num,commande_id:c.id,livreur_id:lv.id,statut:"livree",affectee_at:t,depart_at:t,fin_at:t,montant_attendu:0,motif_echec:""})};
  const z=S.config.zones.map(x=>x.nom);mk("T-A",  "Zzquartier Alpha",z[0],1);mk("T-B","Zzquartier Beta",z[1]||z[0],1);mk("T-C","Zzquartier Alpha",z[0],20);
  const out={},nb=u=>{ui=u;view="livraisons";render();return +document.body.innerText.match(/À affecter \((\d+)/)[1]},st=u=>{ui=u;return statsPer().ok};
  ui={};view="dashboard";render();out.hdr=!!document.querySelector('[data-f=dp]')&&!!document.querySelector('[data-f=dlieu]');
  out.tout=st({dp:"all",dlieu:"zzquartier"});out.sept=st({dp:"7",dlieu:"zzquartier"});out.alpha=st({dp:"all",dlieu:"zzquartier alpha"});out.alpha7=st({dp:"7",dlieu:"alpha"});out.beta=st({dp:"all",dlieu:"beta"});out.rien=st({dp:"all",dlieu:"zzquartier gamma"});
  const d=x=>new Date(Date.now()-x*864e5).toISOString().slice(0,10);out.prec=st({dp:"c",ddu:d(25),dau:d(10),dlieu:"zzquartier"});ui={dp:"c",ddu:d(25),dau:d(10)};view="dashboard";render();out.dates=document.querySelectorAll('[data-f=ddu],[data-f=dau]').length;
  ui={};view="livraisons";render();out.liv=!!document.querySelector('[data-f=lvp]')&&!!document.querySelector('[data-f=flieu]');
  S.commandes.filter(c=>c.id.startsWith("tc_")).forEach(c=>{c.statut="prete"});
  out.a=[nb({lvp:"all",flieu:"zzquartier"}),nb({lvp:"all",flieu:"zzquartier alpha"}),nb({lvp:"7",flieu:"zzquartier"}),nb({lvp:"7",flieu:"alpha"}),nb({lvp:"all",flieu:"zzquartier gamma"})];return out});
 chk("LF-1","Tableau de bord : sélecteur de période (dont dates précises) et champ lieu de livraison",r.hdr===true&&r.dates===2,JSON.stringify(r));
 chk("LF-2","Tableau de bord : la période limite les livraisons comptées (7 jours écarte la course de 20 jours)",r.tout===3&&r.sept===2,JSON.stringify([r.tout,r.sept]));
 chk("LF-3","Tableau de bord : le lieu filtre par quartier et se combine à la période",r.alpha===2&&r.alpha7===1&&r.beta===1&&r.rien===0,JSON.stringify(r));
 chk("LF-4","Tableau de bord : dates précises (du 25e au 10e jour) : seule la course ancienne",r.prec===1,String(r.prec));
 chk("LF-5","Centre de livraison : filtres date et lieu sur « À affecter » (lieu et période se combinent)",r.liv===true&&r.a.join()==="3,2,2,1,0",JSON.stringify(r.a));
 chk("LF-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
