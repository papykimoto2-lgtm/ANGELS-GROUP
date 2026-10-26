/* Centre de livraison — conduite de la journée : affectation guidée, groupage en tournées, alertes, créneaux, confirmation client, contacts, échecs, dossier de preuve,
   contrôle des colis, planning et collectes récurrentes, performance, clôture, réglages et sons.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/centre-pilotage.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const ctx=await b.newContext({viewport:{width:420,height:880},isMobile:true,hasTouch:true}),p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));
 await p.goto(base+"/distribution.html?app=centre");await p.waitForTimeout(700);
 const SHOT=process.env.SHOT||"/tmp";
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};window.__O=[];window.open=u=>{__O.push(u);return null};window.__SIG=[];window.ANGELS_SIGNAL={jouer:(s,o)=>{__SIG.push(s);return true}};
  ME=S.users.find(u=>u.role==="admin"&&u.actif);view="centre";render();
  /* jeu d'essai : 4 commandes prêtes, à Cocody, proches ; une livraison active à vieillir */
  const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0];window.__base=base;
  window.__mk=(n,q,gps)=>{const c=JSON.parse(JSON.stringify(base));c.id="cp_"+n;c.numero="CMD-CP-"+n;c.statut="prete";c.priorite="normale";c.adr={zone:"Cocody",quartier:q,repere:"",gps:gps};c.hist=[{ts:new Date(Date.now()-40*60000).toISOString(),de:"preparation",a:"prete",par:"test",note:""}];c.creneau=null;c.conf_client=null;c.colis=null;S.commandes.push(c);return c};});
 // 1. affectation guidée
 let r=await p.evaluate(()=>{const c=__mk(1,"Riviera",{lat:5.3600,lng:-3.9800});const rk=cenRank(c);return{n:rk.length,tri:rk.every((x,i)=>i===0||rk[i-1].sc<=x.sc),best:rk[0].l.nom,why:rk[0].why,sug:/⭐/.test(cenSug(c)),mod:(assignModal(c),document.querySelector("#modal").innerText)}});
 chk("CP-1","affectation guidée : livreurs classés (zone, charge, distance, réussite) ; le meilleur est suggéré ⭐ dans la fenêtre d'affectation",r.n>0&&r.tri&&r.why.length>0&&r.sug&&/suggéré/.test(r.mod),JSON.stringify(r).slice(0,300));
 await p.evaluate(()=>closeModal());
 r=await p.evaluate(()=>{const c=cmd("cp_1");cenAffAuto(c.id);return{st:c.statut,l:!!activeLiv(c.id),t:__T.join("|")}});
 chk("CP-2","« ⚡ Affecter » : la commande est affectée au livreur suggéré en un clic",r.st==="affectee"&&r.l,JSON.stringify(r));
 // 3. groupage
 r=await p.evaluate(()=>{["a","b","c"].forEach((n,i)=>__mk("g"+n,"Riviera",{lat:5.3601+i*.002,lng:-3.9801}));const g=cenGroupes();return{nG:g.G.length,n:g.G.length?g.G[0].cmds.length:0,eco:g.G.length?g.G[0].eco:0,l:g.G.length&&!!g.G[0].l}});
 chk("CP-3","groupage : les commandes prêtes proches (même zone, ≤ 3 km) sont regroupées en tournée avec économie estimée et livreur proposé",r.nG>=1&&r.n>=3&&r.eco===r.n*800&&r.l,JSON.stringify(r));
 r=await p.evaluate(async()=>{const t0=S.tournees.length;cenTourModal();const txt=document.querySelector("#modal").innerText;document.querySelector("#mf").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));await new Promise(r=>setTimeout(r,200));return{mod:/Économie estimée/.test(txt),nt:S.tournees.length-t0,lies:S.livraisons.filter(l=>l.tournee_id&&S.tournees[S.tournees.length-1]&&l.tournee_id===S.tournees[S.tournees.length-1].id).length}});
 chk("CP-4","« Proposer des tournées » : fenêtre avec économie, validation → tournée créée, livraisons liées",r.mod&&r.nt>=1&&r.lies>=2,JSON.stringify(r));
 // 5. alertes
 r=await p.evaluate(()=>{const l=S.livraisons.find(x=>x.statut==="affectee"&&cmd(x.commande_id));const c=cmd(l.commande_id);l.affectee_at=new Date(Date.now()-120*60000).toISOString();
  const l2=S.livraisons.find(x=>x.statut==="en_cours");if(l2){S.pos[l2.livreur_id]=Object.assign({},S.pos[l2.livreur_id]||{lat:5.3,lng:-3.9},{ts:new Date(Date.now()-60*60000).toISOString()})}
  const pr=__mk("late","Angré",null);pr.hist[0].ts=new Date(Date.now()-90*60000).toISOString();
  const cc=__mk("cren","Angré",null);cc.creneau={de:new Date(Date.now()-5*36e5).toISOString(),a:new Date(Date.now()-3*36e5).toISOString()};
  const A=cenAlertes();return{n:A.length,types:[...new Set(A.map(a=>a.ic))].join(""),er:A.filter(a=>a.k==="er").length,txt:A.map(a=>a.txt).join(" | ").slice(0,300),ord:A.every((a,i)=>i===0||!(A[i-1].k!=="er"&&a.k==="er"))}});
 chk("CP-5","alertes : offre non acceptée, retard, position perdue, commande qui attend, créneau dépassé — urgentes en premier",r.n>=4&&/🐢|⏳/.test(r.types)&&/🕒/.test(r.types)&&/📦/.test(r.types)&&r.ord,JSON.stringify(r));
 // 6. créneaux
 r=await p.evaluate(()=>{const c=cmd("cp_1");cenCreneauForm(c.id);const f=document.querySelector("#mf");f.j.value=ymd(new Date());f.s.value="3";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));return{cr:!!c.creneau,t:cenCreTxt(c),h:new Date(c.creneau.de).getHours()+"-"+new Date(c.creneau.a).getHours()}});
 chk("CP-6","créneau promis : fenêtre de 2 h enregistrée sur la commande et lisible (« aujourd'hui 14h–16h »)",r.cr&&/14h–16h/.test(r.t)&&r.h==="14-16",JSON.stringify(r));
 // 7. confirmation client + contacts
 r=await p.evaluate(()=>{const c=cmd("cp_1");const cl=cli(c.client_id);cl.tel="0707070707";cenConfEnvoyer(c.id);const e1=c.conf_client.statut,u=__O[__O.length-1]||"";cenConfRep(c.id,"oui");const e2=c.conf_client.statut;cenConfRep(c.id,"report");const m=document.querySelector("#modal").innerText;closeModal();return{e1,wa:/wa\.me/.test(u)&&/CONFIRMER/.test(decodeURIComponent(u)),e2,e3:c.conf_client.statut,reprog:/Créneau de livraison/.test(m),btn:cenBtns("0707070707","x")}});
 chk("CP-7","confirmation avant départ : WhatsApp au client avec le créneau (1 confirmer / 2 reporter) ; « confirmé » ; « reporter » rouvre le créneau",r.e1==="envoye"&&r.wa&&r.e2==="ok"&&r.e3==="report"&&r.reprog,JSON.stringify(r));
 chk("CP-8","appel et message en un geste : boutons 📞 (tel:) et 💬 (WhatsApp) générés",/href="tel:0707070707"/.test(r.btn)&&/wa\.me/.test(r.btn));
 // 9. échecs
 r=await p.evaluate(()=>{const l=S.livraisons.find(x=>x.statut==="en_cours")||S.livraisons.find(x=>isActive(x));const c=cmd(l.commande_id);ME=S.users.find(u=>u.role==="admin");l.statut="echouee";l.fin_at=new Date().toISOString();l.motif_echec="Client absent";c.statut="echouee";
  view="echecs";render();const t1=document.querySelector("main").innerText;const l2=JSON.parse(JSON.stringify(l));l2.id="lx2";l2.fin_at=new Date().toISOString();S.livraisons.push(l2);render();const t2=document.querySelector("main").innerText;return{un:/Client absent/.test(t1)&&/Nouvelle tentative/.test(t1)&&/1 tentative/.test(t1),deux:/2 tentatives/.test(t2)&&/Proposer le retour/.test(t2)&&!/Nouvelle tentative/.test(t2.split(c.numero)[1]||"")}});
 chk("CP-9","échecs & retours : motif, nombre de tentatives, « Nouvelle tentative » ; à 2 échecs, retour au vendeur recommandé",r.un&&r.deux,JSON.stringify(r));
 await p.screenshot({path:SHOT+"/centre-echecs.png"});
 // 10. dossier de preuve
 r=await p.evaluate(()=>{const l=S.livraisons.find(x=>x.statut==="livree"&&cmd(x.commande_id));const c=cmd(l.commande_id);l.recu_par="M. Test";l.gps_confirm={lat:5.35,lng:-3.98,ts:new Date().toISOString()};cenPreuve(c.id);const t=document.querySelector("#modal").innerHTML;closeModal();return{h:/Dossier de preuve/.test(t),rec:/M\. Test/.test(t),gps:/google\.com\/maps\?q=5\.35/.test(t),hist:/Historique/.test(t),print:typeof cenPreuvePrint==="function"}});
 chk("CP-10","dossier de preuve : livreur, reçu par, position GPS de la remise, historique complet, impression/PDF",r.h&&r.rec&&r.gps&&r.hist&&r.print,JSON.stringify(r));
 // 11. contrôle des colis
 r=await p.evaluate(async()=>{const l=S.livraisons.find(x=>x.statut==="affectee"&&cmd(x.commande_id));const c=cmd(l.commande_id);colisGenerer(c,2);cenControle(l.livreur_id);const tok=c.colis[0].tok,m=document.querySelector("#modal").innerText;
  const sc=document.getElementById("cen_scan");sc.value=tok.toLowerCase();sc.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await new Promise(r=>setTimeout(r,100));
  const coche=[...document.querySelectorAll('#mf input[data-tok]')].filter(x=>x.checked).length;document.querySelector("#mf").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));await new Promise(r=>setTimeout(r,100));
  return{m:/Colis/.test(m)&&/sortie/.test(m),coche,sortie:!!c.colis[0].sortie_at,autre:!!c.colis[1].sortie_at,t:__T.slice(-1)[0]}});
 chk("CP-11","contrôle au départ : scan d'un code coche le bon colis, l'enregistrement date la sortie, l'autre colis est signalé « non sorti »",r.m&&r.coche>=1&&r.sortie&&!r.autre&&/non encore sortis/.test(r.t),JSON.stringify(r));
 // 12. planning et collectes récurrentes
 r=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const v=S.vendeurs.find(x=>aCollecter(x.id).length)||S.vendeurs[0];const cm=S.commandes.find(c=>c.vendeur_id===v.id&&c.statut==="confirmee");
  S.collectes=(S.collectes||[]).filter(c=>c.vendeur_id!==v.id);S.col_rec=[{id:"cr1",vendeur_id:v.id,jour:new Date().getDay(),heure:"09:00",livreur_id:S.livreurs[0].id,actif:true}];
  const avant=S.collectes.length;const dues=aCollecter(v.id).length;const n=cenColGen(true);view="collectes";ui.colt="plan";render();const t=document.querySelector("main").innerText;return{dues,n,apres:S.collectes.length-avant,note:S.collectes.slice(-1)[0]&&S.collectes.slice(-1)[0].note,pl:/Les 7 prochains jours/.test(t)&&/Collectes récurrentes/.test(t)}});
 chk("CP-12","planning : vue des 7 jours, collectes récurrentes ; la collecte due est planifiée automatiquement (une seule fois)",r.pl&&((r.dues>0&&r.n===1&&r.apres===1&&r.note==="Collecte récurrente")||(r.dues===0&&r.n===0)),JSON.stringify(r));
 r=await p.evaluate(()=>{const n=cenColGen(true);return n});chk("CP-13","pas de doublon : relancer la génération ne crée rien de plus",r===0,r);
 await p.screenshot({path:SHOT+"/centre-planning.png"});
 // 14. performance
 r=await p.evaluate(()=>{view="perf";ui.pf="30";render();const t=document.querySelector("main").innerText;const P=cenPerf(new Date(Date.now()-30*864e5),new Date());return{k:/Livrées à la 1re tentative/.test(t)&&/Dans les délais/.test(t)&&/Coût moyen par colis/.test(t)&&/Par livreur/.test(t)&&/Motifs d'échec/.test(t),coh:P.ok+P.ko===P.n,csv:typeof ACT.cenPerfCsv==="function"}});
 chk("CP-14","performance : 1re tentative, délais de zone, créneau, coût par colis, tableaux par livreur / zone / motif ; export CSV",r.k&&r.coh&&r.csv,JSON.stringify(r));
 await p.screenshot({path:SHOT+"/centre-perf.png"});
 // 15. clôture
 r=await p.evaluate(()=>{view="cloture";render();const t=document.querySelector("main").innerText;const D=cenCloture();window.confirm=()=>true;cenClore();cenClore();const n=S.clotures_j.filter(x=>x.jour===D.j).length;render();return{t:/Courses non terminées/.test(t)&&/Argent détenu/.test(t)&&/Colis sortis non revenus/.test(t),n,fait:/Journée clôturée/.test(document.querySelector("main").innerText)}});
 chk("CP-15","clôture du jour : points ouverts (courses, échecs, retours, collectes, colis, écarts, argent détenu) ; clôture enregistrée une seule fois par jour",r.t&&r.n===1&&r.fait,JSON.stringify(r));
 await p.screenshot({path:SHOT+"/centre-cloture.png"});
 // 16. réglages et sons
 r=await p.evaluate(()=>{cenReglages();const f=document.querySelector("#mf");f.max.value="6";f.cu.value="2000";f.cg.value="900";f.son.checked=true;f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));return{cfg:cenCfg(),dev:cenDev()}});
 chk("CP-16","réglages du centre : règles partagées (tournée max, coûts, délais) et préférences de l'appareil (son, écran allumé) enregistrées",r.cfg.max_tournee===6&&r.cfg.cout_unit===2000&&r.cfg.cout_groupe===900&&r.dev.son===true,JSON.stringify(r));
 r=await p.evaluate(()=>{CEN_VU=new Set();__SIG.length=0;cenWatch();const a=__SIG.length;cenWatch();return{premier:a,second:__SIG.length-a}});
 chk("CP-17","sons : une nouvelle alerte urgente fait sonner une fois ; elle ne sonne pas en boucle",r.premier===1&&r.second===0,JSON.stringify(r));
 // 18. accueil et navigation
 r=await p.evaluate(()=>{view="centre";render();const t=document.querySelector("main").innerText;return{al:/Alertes/.test(t),btn:["Tour de contrôle","Échecs & retours","Clôture du jour","Réglages"].every(x=>t.includes(x)),sug:/Affecter/.test(t)}});
 chk("CP-18","accueil : alertes en tête et raccourcis Tour de contrôle, Échecs & retours, Clôture, Réglages",r.al&&r.btn,JSON.stringify(r));
 await p.screenshot({path:SHOT+"/centre-accueil2.png"});
 r=await p.evaluate(()=>{view="tour";render();const t=document.querySelector("main").innerText;return{k:/Libres/.test(t)&&/En course/.test(t)&&/Indisponibles/.test(t),liv:document.querySelectorAll(".cgrid .card").length,conf:/Confirmations clients/.test(t),btn:/Proposer des tournées/.test(t)}});
 chk("CP-19","tour de contrôle : compteurs par état, fiche de chaque livreur (courses, collectes, position, appel), à affecter avec suggestion, confirmations clients",r.k&&r.liv>=1&&r.conf&&r.btn,JSON.stringify(r));
 await p.screenshot({path:SHOT+"/centre-tour.png",fullPage:false});
 // 20. droits et navigation
 r=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="preparateur");view="centre";render();const a=NAV.filter(voirNav).map(n=>n.v);ME=S.users.find(u=>u.role==="superviseur");const b=NAV.filter(voirNav).map(n=>n.v);return{prep:["tour","cloture","perf"].some(v=>a.includes(v)),echecs:a.includes("echecs"),sup:["tour","cloture","perf","echecs","collectes"].every(v=>b.includes(v))}});
 chk("CP-20","droits : le préparateur n'a ni Tour de contrôle, ni Clôture, ni Performance mais garde Échecs & retours ; le superviseur a tout",!r.prep&&r.echecs&&r.sup,JSON.stringify(r));
 chk("CP-21","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
