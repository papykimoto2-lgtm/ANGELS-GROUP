/* Distance parcourue + évaluation/prime périodique des livreurs.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/primes-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],c=S.commandes[0],o={};
  const d=new Date(),t0=new Date(d.getFullYear(),d.getMonth()-1,1).getTime(),t1=new Date(d.getFullYear(),d.getMonth(),0,23,59,59).getTime(),mid=t0+5*864e5;
  S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);S.avis=(S.avis||[]).filter(a=>a.livreur_id!==lv.id);S.primes=[];S.paie=S.paie.filter(p=>p.livreur_id!==lv.id);S.gps_hist=S.gps_hist.filter(p=>p.livreur_id!==lv.id);
  /* GPS : 3 points espacés de 1 km environ (0,009° ≈ 1 km), plus un saut aberrant ignoré */
  const T=n=>new Date(mid+n*60000).toISOString();[[5.30,-4.00,0],[5.309,-4.00,3],[5.318,-4.00,6],[6.9,-4.0,7]].forEach(x=>S.gps_hist.push({livreur_id:lv.id,lat:x[0],lng:x[1],ts:T(x[2])}));
  o.km=kmLiv(lv.id,t0,t1);
  S.config.prime={actif:true,jours_attendus:20,min_livraisons:20,poids:{reussite:30,delais:25,note:20,assiduite:15,fiabilite:10},paliers:[{nom:"Bronze",min:70,montant:5000},{nom:"Or",min:90,montant:20000}]};
  for(let i=0;i<22;i++){const f=new Date(mid+i*864e5).toISOString();S.livraisons.push({id:"pv"+i,commande_id:c.id,livreur_id:lv.id,statut:"livree",affectee_at:new Date(mid+i*864e5-20*60000).toISOString(),depart_at:new Date(mid+i*864e5-15*60000).toISOString(),fin_at:f,ecart:0,montant_encaisse:1000});S.avis.push({livraison_id:"pv"+i,livreur_id:lv.id,note:5})}
  const e=evalLiv(lv,t0,t1);o.e=[Math.round(e.score),e.palier&&e.palier.nom,e.montant,e.raisons.length];
  S.livraisons.splice(0,0);const e2=(()=>{S.livraisons=S.livraisons.filter(l=>+l.id.replace("pv","")<5||!/^pv/.test(l.id));return evalLiv(lv,t0,t1)})();o.peu=e2.raisons.length===1&&e2.montant===0;
  for(let i=5;i<22;i++)S.livraisons.push({id:"pv"+i,commande_id:c.id,livreur_id:lv.id,statut:"livree",affectee_at:new Date(mid+i*864e5-20*60000).toISOString(),depart_at:new Date(mid+i*864e5-15*60000).toISOString(),fin_at:new Date(mid+i*864e5).toISOString(),ecart:0,montant_encaisse:1000});
  view="finance";ui={fin:"prime",prp:"mp"};const html=VIEWS.finance();o.tab=/🏆 Primes/.test(html)&&/Période d'évaluation/.test(html)&&html.includes(lv.nom);
  const bn=perBornes("pr","mp");const avant=commPayee(lv.id);ACT.primeValider(lv.id);o.val=S.primes.length===1&&S.primes[0].statut==="validee"&&S.primes[0].montant===20000;
  ACT.primeValider(lv.id);o.dbl=S.primes.length===1;
  ACT.primePayer(S.primes[0].id);o.pay=S.primes[0].statut==="payee"&&S.paie.some(p=>p.type==="prime"&&p.livreur_id===lv.id&&p.montant===20000)&&commPayee(lv.id)===avant;
  ACT.primeDetail(lv.id);o.det=/Évaluation —/.test(document.getElementById("modal").innerHTML);
  view="livraisons";ui={cdt:"sta",stp:"30"};o.statkm=/<th>Km<\/th>/.test(VIEWS.livraisons());
  return o});
 chk("PR-1","distance : ≈ 2 km (saut aberrant écarté)",r.km>1.9&&r.km<2.1,r.km);
 chk("PR-2","score et palier : Or 20 000 F pour un livreur irréprochable",r.e[1]==="Or"&&r.e[2]===20000&&r.e[3]===0,JSON.stringify(r.e));
 chk("PR-3","pas de prime sous le minimum de livraisons",r.peu,JSON.stringify(r));
 chk("PR-4","onglet Primes, validation, pas de doublon",r.tab&&r.val&&r.dbl,JSON.stringify(r));
 chk("PR-5","paiement : écriture « prime » hors commissions",r.pay,JSON.stringify(r));
 chk("PR-6","détail d'évaluation et colonne Km des statistiques",r.det&&r.statkm,JSON.stringify(r));
 chk("PR-7","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
