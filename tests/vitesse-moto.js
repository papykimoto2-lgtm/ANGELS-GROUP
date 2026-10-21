/* Vitesse max (dépassements GPS, avertissement, évaluation) + historique d'attribution et d'entretien des motos.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/vitesse-moto.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};
  const t0=Date.now()-3*36e5,T=n=>new Date(t0+n*1000).toISOString();S.config.vitesse_max=60;S.gps_hist=S.gps_hist.filter(p=>p.livreur_id!==lv.id);
  /* 0,0009° de latitude ≈ 100 m : 100 m en 10 s = 36 km/h ; 100 m en 4 s... on utilise 20 s d'intervalle : 400 m = 72 km/h */
  [[0,0],[20,.0036],[40,.0072],[60,.0090],[400,.0100],[420,.0136]].forEach(x=>S.gps_hist.push({livreur_id:lv.id,lat:5.3+x[1],lng:-4,ts:T(x[0])}));
  const v=vitLiv(lv.id,t0-1000,Date.now());o.v=[Math.round(v.max),v.n];
  S.config.vitesse_max=100;o.sans=vitLiv(lv.id,t0-1000,Date.now()).n===0;S.config.vitesse_max=60;
  const e=evalLiv(lv,t0-1000,Date.now());o.sec=e.comps.find(c=>c.k==="securite").val<1;
  view="livraisons";ui={cdt:"sta",stp:"30"};o.col=/<th>Vit\. max<\/th>/.test(VIEWS.livraisons());
  /* attribution de moto */
  const m1=S.motos[0],m2=S.motos[1];S.attributions=[];motoAttrib(lv,m1.id);lv.moto_id=m1.id;motoAttrib(lv,m2.id);lv.moto_id=m2.id;
  o.at=S.attributions.length===2&&!!S.attributions[0].au&&!S.attributions[1].au&&S.attributions[1].moto_id===m2.id;
  S.entretiens.push({id:"ex1",moto_id:m1.id,ts:new Date(Date.now()-864e5).toISOString(),type:"Vidange",km:100,cout:1000,note:""});
  histMoto(m1);const h=document.getElementById("modal").innerHTML;o.hist=/Historique d'attribution/.test(h)&&h.includes(lv.nom)&&/Livreur à l'époque/.test(h);
  ME=S.users.find(u=>u.id===lv.user_id);o.pan=/Ma moto/.test(motoDuLivreurHTML(lv));
  return o});
 chk("VM-1","vitesse : max 72 km/h, 2 épisodes de dépassement (limite 60)",r.v[0]===72&&r.v[1]===2,JSON.stringify(r.v));
 chk("VM-2","limite relevée : plus de dépassement ; pénalité d'évaluation ; colonne Vit. max",r.sans&&r.sec&&r.col,JSON.stringify(r));
 chk("VM-3","attribution moto : l'ancienne est clôturée, la nouvelle ouverte",r.at,JSON.stringify(r));
 chk("VM-4","historique moto (attributions, livreur à l'époque) et panneau « Ma moto » du livreur",r.hist&&r.pan,JSON.stringify(r));
 chk("VM-5","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
