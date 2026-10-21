/* Notifications push : service worker (affichage, clic), application livreur (activation, état, bandeau), bureau (file d'envoi et déclencheurs).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/push-app.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),vm=require("vm");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 let ok=0,ko=0;const errs=[];const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 /* ---- service worker (exécuté dans un bac à sable) ---- */
 const H={},shown=[],opened=[],navs=[],focus=[];
 const sw={addEventListener:(t,f)=>{H[t]=f},registration:{scope:"https://app.test/",showNotification:(t,o)=>{shown.push({t,o});return Promise.resolve()}},
  clients:{matchAll:()=>Promise.resolve(sw._cs),openWindow:u=>{opened.push(u);return Promise.resolve()}},_cs:[],skipWaiting:()=>{},caches:{open:()=>Promise.resolve({addAll:()=>Promise.resolve(),add:()=>Promise.resolve()}),keys:()=>Promise.resolve([]),match:()=>Promise.resolve(null)}};
 sw.self=sw;vm.runInNewContext(fs.readFileSync(path.join(root,"sw.js"),"utf8"),Object.assign(sw,{URL,Promise,fetch:()=>Promise.reject(new Error("off")),console}));
 const wait=[];const ev=(extra)=>Object.assign({waitUntil:p=>wait.push(p)},extra);
 H.push(ev({data:{json:()=>({t:"🛵 Nouvelle mission",b:"CMD-1 · Cocody",tag:"mission-9",u:"livreur.html"}),text:()=>""}}));await Promise.all(wait);
 H.push(ev({data:{json:()=>{throw new Error("x")},text:()=>"texte brut"}}));await Promise.all(wait);
 H.push(ev({data:null}));await Promise.all(wait);
 chk("PA-1","service worker : notification affichée (titre, texte, tag, lien, vibration) ; charge illisible ou vide tolérée",shown.length===3&&shown[0].t==="🛵 Nouvelle mission"&&shown[0].o.body==="CMD-1 · Cocody"&&shown[0].o.tag==="mission-9"&&shown[0].o.data.u==="livreur.html"&&shown[0].o.requireInteraction&&shown[0].o.vibrate.length>2&&shown[1].o.body==="texte brut"&&shown[2].t.length>0,JSON.stringify(shown.map(x=>[x.t,x.o.body])));
 let closed=0;const click=(u,cs)=>{sw._cs=cs;wait.length=0;H.notificationclick(ev({notification:{close:()=>{closed++},data:u?{u}:{}}}));return Promise.all(wait)};
 await click("livreur.html",[]);const c1=opened[0]==="https://app.test/livreur.html"&&closed===1;
 const w={url:"https://app.test/livreur.html?x=1",focus:()=>{focus.push(1);return Promise.resolve(w)}};opened.length=0;await click("livreur.html",[w]);const c2=focus.length===1&&opened.length===0;
 const w2={url:"https://app.test/distribution.html",focus:()=>Promise.resolve(w2),navigate:u=>{navs.push(u);return Promise.resolve(w2)}};opened.length=0;await click("livreur.html",[w2]);const c3=navs[0]==="https://app.test/livreur.html";
 chk("PA-2","clic sur la notification : ouvre l'application, réutilise la fenêtre ouverte, ou la ramène à la bonne page",c1&&c2&&c3,JSON.stringify([c1,c2,c3,opened,navs]));
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}});
 /* ---- application livreur ---- */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async()=>{const o={};user={id:"u"};moi={nom:"T",livreur_ref:"l1"};missions=[];STATS={statut:"stats",payload:{p:{j:{},s7:{},m30:{},mois:{}},jours7:[]}};
  const K=btoa(String.fromCharCode(...new Uint8Array(65).fill(4))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  o.cle=cleVapid(K).length===65&&cleVapid(K)[0]===4;
  window.ANGELS_PASSERELLE=Object.assign({},window.ANGELS_PASSERELLE,{vapid:""});o.bureau=(await pushEtat())==="bureau";PAGE="reglages";vueMissions();o.carteBureau=/non configurées par le bureau/.test(document.body.innerText);
  window.ANGELS_PASSERELLE.vapid=K;
  /* faux gestionnaire push + permission */
  let sub=null,appels=[],perm="default";const fakeSub={endpoint:"https://fcm.googleapis.com/fcm/send/abc",toJSON(){return{endpoint:this.endpoint,keys:{p256dh:"P",auth:"A"}}},unsubscribe:async()=>{sub=null;return true}};
  const reg={pushManager:{getSubscription:async()=>sub,subscribe:async o=>{appels.push(o);sub=fakeSub;return fakeSub}},showNotification:async(t,o)=>{appels.push(["show",t])}};
  Object.defineProperty(navigator.serviceWorker,"ready",{configurable:true,get:()=>Promise.resolve(reg)});
  Object.defineProperty(Notification,"permission",{configurable:true,get:()=>perm});Notification.requestPermission=async()=>{perm="granted";return"granted"};
  o.inactif=(await pushEtat())==="inactif";
  user={id:"u"};PAGE="cours";vueMissions();o.bandeau=/Activez les notifications/.test(document.body.innerText);
  let envoyes=[];window.api=async(fn,b)=>{envoyes.push({fn,b});return{ok:true}};
  const r=await pushActiver();o.activ=r===true&&PUSHST==="actif"&&appels[0].userVisibleOnly===true&&appels[0].applicationServerKey.length===65&&envoyes[0].fn==="push-abonner"&&envoyes[0].b.action==="abonner"&&envoyes[0].b.subscription.endpoint.includes("fcm.googleapis.com");
  vueMissions();o.sansBandeau=!/Activez les notifications/.test(document.body.innerText);PAGE="reglages";vueMissions();o.carteActive=/actives/.test(document.body.innerText)&&/Couper les notifications/.test(document.body.innerText)&&/Tester/.test(document.body.innerText);
  sb=sb||{};envoyes=[];lsSet(LS.n,{on:true,t:Date.now()-2*864e5});await pushEntretien();o.entretien=envoyes.length===1&&envoyes[0].b.action==="abonner";
  envoyes=[];lsSet(LS.n,{on:true,t:Date.now()});await pushEntretien();o.pasTrop=envoyes.length===0;
  envoyes=[];await pushCouper();o.coupe=envoyes[0].b.action==="desabonner"&&envoyes[0].b.endpoint===fakeSub.endpoint&&sub===null&&PUSHST==="inactif"&&lsGet(LS.n,{}).on===false;
  envoyes=[];lsSet(LS.n,{on:false,t:Date.now()-5*864e5});await pushEntretien();o.respecte=envoyes.length===0;
  perm="denied";o.refuse=(await pushEtat())==="refuse";PAGE="cours";vueMissions();o.sansBandeauRefuse=!/Activez les notifications/.test(document.body.innerText);
  return o});
 chk("PA-3","app livreur : état « non configuré par le bureau », clé VAPID décodée, bandeau d'activation",v.cle&&v.bureau&&v.carteBureau&&v.inactif&&v.bandeau,JSON.stringify(v));
 chk("PA-4","app livreur : activation (permission, abonnement, enregistrement serveur), carte « actives », test, bandeau disparu",v.activ&&v.sansBandeau&&v.carteActive,JSON.stringify(v));
 chk("PA-5","app livreur : entretien quotidien de l'abonnement, coupure respectée, refus du navigateur sans bandeau",v.entretien&&v.pasTrop&&v.coupe&&v.respecte&&v.refuse&&v.sansBandeauRefuse,JSON.stringify(v));
 /* ---- bureau ---- */
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const d=await D.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};S.push_file=[];lv.ident_serveur=null;
  o.sansCompte=pushLivreur(lv,"mission","T","c")===false;lv.ident_serveur="t.lv";
  o.queue=pushLivreur(lv,"mission","🛵 T","corps","t1")===true&&S.push_file.length===1;o.dedup=pushLivreur(lv,"mission","🛵 T","corps","t1")===false&&S.push_file.length===1;
  S.config.push={actif:true,types:{chat:false}};o.type=pushLivreur(lv,"chat","T","c","t2")===false;S.config.push={actif:false,types:{}};o.off=pushLivreur(lv,"mission","T","autre","t3")===false;S.config.push={actif:true,types:{}};
  /* déclencheurs réels */
  S.push_file=[];const as=(r,f)=>{const m=ME;ME=S.users.find(u=>u.role===r&&u.actif);try{return f()}finally{ME=m}};
  const p=S.produits[0],c=as("admin",()=>creerCmd({client_id:S.clients[0].id,adr:Object.assign({},S.clients[0].adresses[0]),lignes:[{produit_id:p.id,qte:1,pu:p.prix}],frais:2000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true}));
  as("admin",()=>{setStatut(c,"preparation");marquerPrete(c)});as("admin",()=>affecter(c,lv.id,""));
  o.mission=S.push_file.some(x=>x.tag.startsWith("mission-")&&/Nouvelle mission/.test(x.titre)&&x.corps.includes(c.numero));
  chatAjout(lv.id,"centre","Passez au dépôt","Marie");o.chat=S.push_file.some(x=>x.tag==="chat-"+lv.id&&x.corps==="Passez au dépôt");
  chatAjout(lv.id,"livreur","ok","x");o.chatSens=S.push_file.filter(x=>x.tag==="chat-"+lv.id).length===1;
  S.sos=[{id:"s1",livreur_id:lv.id,type:"panne",statut:"ouverte",cree_le:now()}];sosAgir("s1","prendre");o.sos=S.push_file.some(x=>x.tag==="sos-s1");
  /* envoi (passerelle simulée) */
  S.config.passerelle_actif=true;S.config.appel_pont={actif:true,url:"https://x.supabase.co/functions/v1/",cle_admin:"cle"};const log=[];let mode="ok";
  window.fetch=async(u,i)=>{log.push({u:String(u),h:i.headers,b:JSON.parse(i.body)});return mode==="ok"?{ok:true,status:200,json:async()=>({ok:true})}:{ok:false,status:500,json:async()=>({ok:false,erreur:"Erreur"})}};
  const n=S.push_file.length;await pushFlush();
  o.flush=S.push_file.length===0&&log.length===n&&log.every(x=>/push-envoyer/.test(x.u)&&x.h["x-admin-key"]==="cle")&&log[0].b.livreur_ref===lv.id&&!!log[0].b.titre&&Object.keys(log[0].b).sort().join()==="corps,livreur_ref,tag,titre,url";
  mode="ko";pushLivreur(lv,"mission","T","reessai","t9");await pushFlush();const e1=S.push_file.length===1&&S.push_file[0].essais===1;await pushFlush();await pushFlush();o.abandon=e1&&S.push_file.length===0;
  mode="ok";S.push_file=[{id:"v",livreur_ref:lv.id,titre:"vieux",corps:"",tag:"v",url:"livreur.html",ts:new Date(Date.now()-20*60000).toISOString(),essais:0}];log.length=0;await pushFlush();o.perime=log.length===0&&S.push_file.length===0;
  /* réglages */
  view="params";const h=VIEWS.params();o.params=/Notifications push des livreurs/.test(h);
  return o});
 chk("PA-6","bureau : file d'envoi (sans compte serveur, doublon, type ou envoi désactivé ignorés)",d.sansCompte&&d.queue&&d.dedup&&d.type&&d.off,JSON.stringify(d));
 chk("PA-7","bureau : déclencheurs (mission affectée, message du centre seulement, SOS pris en charge)",d.mission&&d.chat&&d.chatSens&&d.sos,JSON.stringify(d));
 chk("PA-8","bureau : envoi par la passerelle (clé admin, champs minimaux), 3 essais puis abandon, notifications périmées ignorées, réglages",d.flush&&d.abandon&&d.perime&&d.params,JSON.stringify(d));
 chk("PA-9","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
