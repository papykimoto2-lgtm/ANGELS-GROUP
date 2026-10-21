/* Code de réception pour les clients sans smartphone : fiche client « téléphone simple » (code par SMS, sans lien), « code non reçu » côté livreur, appel du centre puis libération du code au livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/code-sans-smartphone.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin");const o={};
  S.config.notif.en_cours=true;S.config.tpl.en_cours=S.config.tpl.en_cours||"{client}, code : {code}";
  const lv=S.livreurs.find(x=>x.user_id),cm=S.commandes.find(c=>c.client_id&&cli(c.client_id)),cl=cli(cm.client_id);cl.tel=cl.tel||"0700000000";
  const l={id:"lc1",commande_id:cm.id,livreur_id:lv.id,statut:"en_cours",affectee_at:new Date().toISOString(),montant_attendu:0,code:"4821"};S.livraisons.push(l);
  S.notifs=[];cl.sans_smartphone=false;notifier(cm,"en_cours");const n1=S.notifs[0];
  cl.sans_smartphone=true;notifier(cm,"en_cours");const n2=S.notifs[1];
  o.normal={canal:n1.canal,suivi:/\{\{SUIVI\}\}/.test(n1.message)};o.simple={canal:n2.canal,suivi:/\{\{SUIVI\}\}/.test(n2.message),code:/4821/.test(n2.message)};
  view="notifs";const h=VIEWS.notifs();o.btnSms=/data-act="notifSms"[^>]*>Envoyer \(SMS\)/.test(h)&&/data-act="notifSend"[^>]*>Envoyer \(WhatsApp\)/.test(h);
  /* fiche client */
  cliForm(cl);o.case=!!document.querySelector("#modal [name=ssmart]")&&document.querySelector("#modal [name=ssmart]").checked;closeModal&&closeModal();
  /* demande de code */
  S.rappels=[];const n0=S.incidents.length,ev={type:"incident",livraison_ref:"lc1",livreur_ref:lv.id,donnees:{nature:"Code client",description:"x"}};
  o.r1=passAppliquer(ev);o.r2=passAppliquer(ev);o.nb=S.rappels.length;o.typ=S.rappels[0]&&S.rappels[0].type;o.inc=S.incidents.length-n0;
  const h2=VIEWS.notifs();o.boutons=/data-act="codeSms"/.test(h2)&&/data-act="codeLibere"/.test(h2);
  o.avant=passProjection(l).payload.code_libere;
  let url="";const wo=window.open;window.open=u=>{url=u;return null};ACT.codeSms(S.rappels[0].id);window.open=wo;o.sms=url;
  window.ask=(t,p,cb)=>cb("appel du client, il est chez lui");ACT.codeLibere(S.rappels[0].id);
  o.apres=passProjection(l).payload.code_libere;o.ferme=S.rappels[0].statut;o.audit=S.audit.some(a=>/Code libéré au livreur/.test(a.action||a.a||""));
  return o});
 chk("CS-1","client « téléphone simple » : notification en SMS, code inclus, sans lien de suivi ; client normal : WhatsApp avec lien ; bouton « Envoyer (SMS) » mis en avant ; case cochée dans la fiche",r.normal.canal==="WhatsApp"&&r.normal.suivi&&r.simple.canal==="SMS"&&!r.simple.suivi&&r.simple.code&&r.btnSms&&r.case,JSON.stringify(r));
 chk("CS-2","le livreur signale « code non reçu » : une seule demande « code » au bureau (pas un incident) avec les boutons SMS du code et « Libérer le code au livreur »",r.r1===""&&r.r2===""&&r.nb===1&&r.typ==="code"&&r.inc===0&&r.boutons,JSON.stringify(r));
 chk("CS-3","SMS du code au client (application SMS ouverte vers son numéro avec le code et la commande)",/^sms:\+?\d+\?body=/.test(r.sms)&&decodeURIComponent(r.sms).includes("4821"),r.sms);
 chk("CS-4","le code n'est jamais publié au livreur avant la libération ; après vérification par le centre il est publié, la demande est traitée et tracée dans l'audit",r.avant===null&&r.apres==="4821"&&r.ferme==="traite"&&r.audit,JSON.stringify([r.avant,r.apres,r.ferme,r.audit]));
 /* application livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async()=>{const mk=(lib)=>({livraison_ref:"liv1",commande_ref:"CMD-1",statut:"en_cours",payload:{numero:"CMD-1",client_nom:"C",adr:{zone:"Z",quartier:"Q",gps:null},lignes:[{desig:"A",qte:1}],montant_attendu:5000,code_libere:lib||null,modes:["Espèces"]}});const o={};localStorage.removeItem(LS.p);
  const c0=carte(mk());o.btn=/data-a="codenr"/.test(c0)&&/Le client n'a pas reçu le code/.test(c0)&&/data-a="confirmer"/.test(c0);
  let ap=[];const oe=window.envoyer;window.envoyer=async(rf,t,d)=>{ap.push({t,n:d.nature});return{ok:true}};missions=[mk()];await ACT.codenr("liv1");window.envoyer=oe;o.env=ap.length===1&&ap[0].t==="incident"&&ap[0].n==="Code client";
  const c1=carte(mk());o.att=/Demande envoyée au centre/.test(c1)&&!/data-a="codenr"/.test(c1);
  const c2=carte(mk("4821"));o.lib=/libéré le code/.test(c2)&&!/data-a="codenr"/.test(c2);
  missions=[mk("4821")];ACT.confirmer("liv1");await new Promise(r=>setTimeout(r,100));o.pre=(document.querySelector("input[name=code]")||{}).value;
  return o});
 chk("CS-5","application livreur : bouton « Le client n'a pas reçu le code (ou n'a pas de smartphone) » à côté de « Confirmer la livraison » ; la demande part (action incident « Code client »), puis message d'attente",v.btn&&v.env&&v.att,JSON.stringify(v));
 chk("CS-6","code libéré par le centre : message vert et code prérempli dans la confirmation de livraison",v.lib&&v.pre==="4821",JSON.stringify(v));
 chk("CS-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
