/* Signaux sonores (tablettes en atelier bruyant) : moteur, réglages dans Paramètres, détection des arrivées (commande, à préparer, à répartir, paiement, échec, demandes du portail, client injoignable), priorité, rôles, sourdine de l'appareil, application livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/signaux.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(Object.assign({args:["--autoplay-policy=no-user-gesture-required"]},process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}));const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("distribution: "+e.message));D.on("dialog",x=>x.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 await D.evaluate(()=>{window.__calls=[];ANGELS_SIGNAL.jouer=(son,o)=>{__calls.push({son,rep:o&&o.rep,force:!!(o&&o.force),dire:(o&&o.dire)||""});return true};
  window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)||ME};window.__as("admin");window.__T=[];toast=m=>{__T.push(m)};
  window.__new=(o)=>{const c=JSON.parse(JSON.stringify(S.commandes[0]));c.id="sg"+Math.random().toString(36).slice(2,7);c.numero="CMD-SG-"+S.commandes.length;delete c.web;Object.assign(c,o);S.commandes.unshift(c);return c};
  window.__go=()=>{__calls.length=0;__T.length=0;signalVerif();return __calls.map(x=>x.son+"x"+x.rep).join(",")};
  signalVerif();});
 /* moteur */
 const eng=await D.evaluate(()=>{const A=ANGELS_SIGNAL;return{sons:A.SONS.length,vol:A.dev().vol,mute:A.dev().mute,def:A.dev().vib}});
 chk("SG-1","moteur de sons : 5 sons au choix, volume, sourdine et vibration propres à l'appareil",eng.sons===5&&eng.vol===0.8&&eng.mute===false&&eng.def===true,JSON.stringify(eng));
 /* arrivée d'une commande d'un autre poste */
 const r1=await D.evaluate(()=>{__new({cree_par:"Autre poste",statut:"attente"});return __go()});
 chk("SG-2","commande créée par un autre poste : « carillon » une fois, avec un message « nouvelle commande reçue »",r1==="carillonx1"&&await D.evaluate(()=>__T.some(m=>/nouvelle\(s\) commande/.test(m))),r1);
 const r2=await D.evaluate(()=>{__new({cree_par:who(),statut:"attente"});return __go()});
 chk("SG-3","ses propres commandes ne sonnent pas",r2==="",r2);
 const r3=await D.evaluate(()=>{__new({cree_par:"Portail",statut:"attente",web:{ref:"ZZ1",pm:"mm",pay:"a_verifier"}});return __go()});
 chk("SG-4","commande du portail payée par Mobile Money : un seul son (priorité : « cloche » paiement à vérifier avant l'arrivée), les deux messages affichés",r3==="clochex2"&&await D.evaluate(()=>__T.length===2),r3);
 /* changements de statut par un autre */
 const r4=await D.evaluate(()=>{const c=__new({cree_par:who(),statut:"preparation"});__go();c.statut="prete";c.hist.push({ts:now(),de:"preparation",a:"prete",par:"Préparateur Y",note:""});return __go()});
 chk("SG-5","commande passée « prête » par un autre : « alerte forte » deux fois (à répartir)",r4==="alertex2",r4);
 const r5=await D.evaluate(()=>{const c=__new({cree_par:who(),statut:"preparation"});__go();c.statut="prete";c.hist.push({ts:now(),de:"preparation",a:"prete",par:who(),note:""});return __go()});
 chk("SG-6","un statut changé par soi-même ne sonne pas",r5==="",r5);
 const r6=await D.evaluate(()=>{const c=__new({cree_par:who(),statut:"en_cours"}),d=__new({cree_par:who(),statut:"preparation"});__go();c.statut="echouee";c.hist.push({ts:now(),de:"en_cours",a:"echouee",par:"Livreur Z",note:""});d.statut="confirmee";d.hist.push({ts:now(),de:"attente",a:"confirmee",par:"Autre",note:""});return __go()});
 chk("SG-7","plusieurs événements en même temps : un seul son, le plus important (échec de livraison : « sirène »)",r6==="sirenex2"&&await D.evaluate(()=>__T.length===2),r6);
 /* rôles */
 const r7=await D.evaluate(()=>{__as("preparateur");signalVerif();const a=(()=>{__new({cree_par:"Autre",statut:"attente"});return __go()})();__as("caissier");signalVerif();const b2=(()=>{__new({cree_par:"Autre",statut:"attente"});return __go()})();__as("admin");signalVerif();return[a,b2]});
 chk("SG-8","chaque rôle n'entend que ses points : le préparateur entend l'arrivée d'une commande, le caissier non",r7[0]==="carillonx1"&&r7[1]==="",JSON.stringify(r7));
 /* paramètres : réglages */
 await D.evaluate(()=>{__as("admin");view="params";ui.ptab="son";render()});
 const ui=await D.evaluate(()=>({lignes:document.querySelectorAll("[data-sig^='son:']").length,glob:!!document.querySelector("[data-sig='on']"),tester:document.querySelectorAll("[data-act='sigTestEvt']").length}));
 chk("SG-9","Paramètres → Signaux sonores : interrupteur général et 7 points (actif, son, répétitions, test)",ui.lignes===7&&ui.glob&&ui.tester===7,JSON.stringify(ui));
 await D.selectOption("[data-sig='son:cmd_arrivee']","cloche");await D.selectOption("[data-sig='rep:cmd_arrivee']","3");
 const r8=await D.evaluate(()=>{__new({cree_par:"Autre",statut:"attente"});return __go()});
 chk("SG-10","changer le son et le nombre de répétitions d'un point s'applique aussitôt (« cloche » 3 fois), enregistré dans les paramètres partagés et le journal d'audit",r8==="clochex3"&&await D.evaluate(()=>S.config.signal.evts.cmd_arrivee.son==="cloche"&&S.audit.some(a=>a.action==="Signaux sonores modifiés")),r8);
 await D.evaluate(()=>{view="params";ui.ptab="son";render()});await D.uncheck("[data-sig='on:cmd_arrivee']");
 const r9=await D.evaluate(()=>{__new({cree_par:"Autre",statut:"attente"});return __go()});
 await D.evaluate(()=>{view="params";ui.ptab="son";render()});await D.check("[data-sig='on:cmd_arrivee']");await D.uncheck("[data-sig='on']");
 const r10=await D.evaluate(()=>{__new({cree_par:"Autre",statut:"attente"});const a=__go();const c=__new({cree_par:"Autre",statut:"prete"});return a});
 await D.evaluate(()=>{view="params";ui.ptab="son";render()});await D.check("[data-sig='on']");
 chk("SG-11","un point désactivé ne sonne plus ; l'interrupteur général coupe tous les signaux",r9===""&&r10==="",r9+"|"+r10);
 /* test d'un point */
 await D.evaluate(()=>{__calls.length=0;ACT.sigTestEvt("cmd_a_repartir")});
 chk("SG-12","bouton « Tester » : joue le son choisi pour le point, même en sourdine",await D.evaluate(()=>__calls.length===1&&__calls[0].son==="alerte"&&__calls[0].force));
 /* demandes du portail */
 const r11=await D.evaluate(()=>{signalVerif();S.config.portail_refus=(S.config.portail_refus||[]).concat({id:"x",ref:"R1",type:"BOUTIQUE",motif:"test",le:now(),message:""});return __go()});
 chk("SG-13","demande du portail refusée (à traiter à la main) : « cloche » deux fois",r11==="clochex2",r11);
 /* injoignable */
 const r12=await D.evaluate(()=>{__calls.length=0;ijBip();return __calls.map(x=>x.son+"x"+x.rep).join(",")});
 chk("SG-14","client injoignable : l'ancien bip est remplacé par le signal réglable (« alerte forte » 3 fois)",r12==="alertex3",r12);
 /* appareil */
 await D.evaluate(()=>{view="commandes";render()});
 const dv=await D.evaluate(()=>{const l=[...document.querySelectorAll("a[data-act='sigDev']")];ACT.sigDev();return{lien:l.length,modal:!!document.querySelector("#modal [data-sigd='vol']")&&!!document.querySelector("#modal [data-sigd='mute']")&&document.querySelectorAll("#modal [data-act='sigTestSon']").length===5}});
 chk("SG-15","menu « 🔔 Sons de cette tablette » (tous rôles) : sourdine, volume, vibration et écoute des 5 sons",dv.lien===1&&dv.modal,JSON.stringify(dv));
 await D.fill("#modal [data-sigd='vol']","40");await D.dispatchEvent("#modal [data-sigd='vol']","change");await D.check("#modal [data-sigd='mute']");
 const sav=await D.evaluate(()=>JSON.parse(localStorage.getItem("angels_signal_dev")||"{}"));
 chk("SG-16","les réglages de la tablette (volume 40 %, sourdine) sont gardés sur l'appareil, pas dans les données partagées",sav.vol===0.4&&sav.mute===true&&await D.evaluate(()=>!JSON.stringify(S.config).includes("angels_signal_dev")),JSON.stringify(sav));
 /* moteur réel : son joué, coupé par la sourdine */
 const R=await ctx.newPage();R.on("pageerror",e=>errs.push("moteur: "+e.message));await R.goto(base+"/distribution.html");await R.waitForTimeout(600);
 const rl=await R.evaluate(async()=>{let n=0;const AC=window.AudioContext;const oc=AC.prototype.createOscillator;AC.prototype.createOscillator=function(){n++;return oc.call(this)};
  ANGELS_SIGNAL.setDev({mute:false,vol:0.8});ANGELS_SIGNAL.unlock();await new Promise(r=>setTimeout(r,200));const a=ANGELS_SIGNAL.jouer("carillon",{rep:1});await new Promise(r=>setTimeout(r,150));const n1=n;ANGELS_SIGNAL.setDev({mute:true});const b2=ANGELS_SIGNAL.jouer("carillon",{rep:1});const t=ANGELS_SIGNAL.tester("bip");await new Promise(r=>setTimeout(r,100));return{a,b2,t,n1,n};});
 chk("SG-17","moteur réel : le son est produit (oscillateurs), coupé en sourdine, mais « Tester » joue quand même",rl.a===true&&rl.n1>=2&&rl.b2===false&&rl.t===true&&rl.n>rl.n1,JSON.stringify(rl));
 /* application livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("livreur: "+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const lv=await L.evaluate(()=>{const calls=[];ANGELS_SIGNAL.jouer=(s,o)=>{calls.push(s+"x"+o.rep);return true};toast=()=>{};
  missions=[{livraison_ref:"L1",statut:"affectee"}];sigMissions();const a=calls.length;
  missions=[{livraison_ref:"L1",statut:"affectee"},{livraison_ref:"L2",statut:"affectee"}];sigMissions();const b2=calls.slice();
  missions=[{livraison_ref:"L1",statut:"affectee"},{livraison_ref:"L2",statut:"affectee"}];sigMissions();
  return{premier:a,nouveau:b2,repete:calls.length}});
 chk("SG-18","application livreur : rien au premier chargement, « alerte forte » 3 fois à l'arrivée d'une nouvelle mission, une seule fois par mission",lv.premier===0&&lv.nouveau.join()==="alertex3"&&lv.repete===1,JSON.stringify(lv));
 /* ---- lecture vocale des notifications ---- */
 await D.evaluate(()=>{closeModal();__as("admin");view="params";ui.ptab="son";render()});
 const v1=await D.evaluate(()=>({glob:!!document.querySelector("[data-sig='voix']"),coche:document.querySelector("[data-sig='voix']").checked,evts:document.querySelectorAll("[data-sig^='voix:']").length,desact:[...document.querySelectorAll("[data-sig^='voix:']")].every(x=>x.disabled),test:!!document.querySelector("[data-act='sigTestVoix']")}));
 chk("SG-20","Paramètres → Signaux sonores : case « Lecture vocale des notifications » (décochée par défaut), colonne « Lire » par point (grisée tant que la lecture vocale est coupée), bouton « Tester la voix »",v1.glob&&!v1.coche&&v1.evts===7&&v1.desact&&v1.test,JSON.stringify(v1));
 const v2=await D.evaluate(()=>{signalVerif();__new({cree_par:"Autre",statut:"attente"});__go();return window.__signaux.slice(-1)[0].dire});
 chk("SG-21","lecture vocale coupée (par défaut) : le son joue, rien n'est lu",v2==="",v2);
 await D.check("[data-sig='voix']");await D.waitForTimeout(200);
 const v3=await D.evaluate(()=>({sauve:S.config.signal.voix===true,actives:[...document.querySelectorAll("[data-sig^='voix:']")].every(x=>!x.disabled&&x.checked),dire:(()=>{__new({cree_par:"Autre",statut:"attente"});__go();return window.__signaux.slice(-1)[0].dire})()}));
 chk("SG-22","lecture vocale activée : enregistrée dans les paramètres partagés, cases « Lire » dégrisées et cochées, la notification est lue (« 1 nouvelle commande reçue »)",v3.sauve&&v3.actives&&v3.dire==="1 nouvelle commande reçue",JSON.stringify(v3));
 const v4=await D.evaluate(()=>{__new({cree_par:"Autre",statut:"attente"});__new({cree_par:"Autre",statut:"attente"});__go();const a=window.__signaux.slice(-1)[0].dire;
  const c=__new({cree_par:who(),statut:"en_cours"});__go();c.statut="echouee";c.hist.push({ts:now(),de:"en_cours",a:"echouee",par:"Livreur Z",note:""});__new({cree_par:"Autre",statut:"attente"});__go();const b2=window.__signaux.slice(-1)[0].dire;return[a,b2]});
 chk("SG-23","pluriel correct (« 2 nouvelles commandes reçues ») ; plusieurs événements lus à la suite, le plus urgent d'abord",v4[0]==="2 nouvelles commandes reçues"&&/^Attention, 1 livraison échouée ou retour\. 1 nouvelle commande reçue$/.test(v4[1]),JSON.stringify(v4));
 await D.evaluate(()=>{view="params";ui.ptab="son";render()});await D.uncheck("[data-sig='voix:cmd_arrivee']");
 const v5=await D.evaluate(()=>{__new({cree_par:"Autre",statut:"attente"});__go();return window.__signaux.slice(-1)[0].dire});
 chk("SG-24","« Lire » décoché pour un point : le son joue mais ce point n'est pas lu",v5==="",v5);
 await D.evaluate(()=>{view="params";ui.ptab="son";render()});await D.check("[data-sig='voix:cmd_arrivee']");
 await D.evaluate(()=>{__calls.length=0;ACT.sigTestVoix()});
 const v6=await D.evaluate(()=>({n:__calls.length}));
 chk("SG-25","bouton « Tester la voix » : ne plante pas, même sans voix installée",v6.n===0);
 /* moteur réel */
 const R2=await ctx.newPage();R2.on("pageerror",e=>errs.push("voix: "+e.message));await R2.goto(base+"/distribution.html");await R2.waitForTimeout(600);
 const vr=await R2.evaluate(async()=>{const dits=[];speechSynthesis.speak=u=>dits.push({t:u.text,lang:u.lang,vol:u.volume,rate:u.rate});speechSynthesis.cancel=()=>{};
  const A=ANGELS_SIGNAL,o={vocal:A.vocal()};A.setDev({mute:false,vol:0.6,voice:true,rate:1.2});
  o.a=A.parler("Nouvelle commande");o.d1=dits.slice();A.setDev({voice:false});o.b=A.parler("coupée");o.c=A.parler("forcée",{force:true});A.setDev({voice:true,mute:true});o.d=A.parler("sourdine");o.n=dits.length;A.setDev({mute:false});
  A.unlock();await new Promise(r=>setTimeout(r,200));A.jouer("bip",{rep:1,dire:"après le son"});o.avant=dits.length;await new Promise(r=>setTimeout(r,1500));o.apres=dits.length;o.dernier=dits[dits.length-1].t;return o});
 chk("SG-26","moteur réel : voix française (fr-FR), volume et vitesse de la tablette appliqués ; rien si la voix est coupée sur l'appareil ou en sourdine (sauf « forcée » = test) ; la voix suit le son",vr.vocal&&vr.a===true&&vr.d1[0].lang.startsWith("fr")&&Math.abs(vr.d1[0].vol-0.6)<0.001&&Math.abs(vr.d1[0].rate-1.2)<0.001&&vr.b===false&&vr.c===true&&vr.d===false&&vr.n===2&&vr.avant===2&&vr.apres===3&&vr.dernier==="après le son",JSON.stringify(vr));
 const dm=await D.evaluate(()=>{ANGELS_SIGNAL.setDev({mute:false,voice:true});ACT.sigDev();return{vo:!!document.querySelector("#modal [data-sigd='voice']"),rate:!!document.querySelector("#modal [data-sigd='rate']"),test:!!document.querySelector("#modal [data-act='sigTestVoix']")}});
 chk("SG-27","« Sons de cette tablette » : case de lecture vocale, vitesse (lente / normale / rapide) et « Écouter la voix »",dm.vo&&dm.rate&&dm.test,JSON.stringify(dm));
 await D.check("#modal [data-sigd='voice']");await D.uncheck("#modal [data-sigd='voice']");const dv2=await D.evaluate(()=>JSON.parse(localStorage.getItem("angels_signal_dev")||"{}").voice);
 chk("SG-28","la lecture vocale se coupe sur l'appareil seulement (réglage local)",dv2===false,dv2);
 const lvo=await L.evaluate(()=>{localStorage.removeItem("angels_signal_dev");const calls=[];ANGELS_SIGNAL.jouer=(s,o)=>{calls.push(o.dire);return true};toast=()=>{};SIGM.vus=null;const m=(...r)=>r.map(x=>({livraison_ref:x,statut:"affectee"}));
  missions=m("A");sigMissions();missions=m("A","B");sigMissions();missions=m("A","B","C","D");sigMissions();return{calls,defVoix:ANGELS_SIGNAL.dev().voice,btn:/data-a="voix"/.test(String(reglagesHtml)),icone:typeof voixIcone==="function"}});
 chk("SG-29","application livreur : nouvelle mission lue (« Nouvelle mission » / « 2 nouvelles missions »), rien au premier chargement, bouton voix pour l'activer ou la couper",JSON.stringify(lvo.calls)==='["Nouvelle mission","2 nouvelles missions"]'&&lvo.btn&&lvo.icone,JSON.stringify(lvo));
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),pg=["distribution","livreur"].every(f=>fs.readFileSync(path.join(root,f+".html"),"utf8").includes('<script src="signal-engine.js">'));
 chk("SG-19","moteur chargé par Distribution et l'application livreur, et mis en cache hors ligne",pg&&sw.includes('"signal-engine.js"'));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
