/* Messages prêts livreur → client (via le centre) et chat livreur ↔ centre.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/chat-messages.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};
  const as=(r,f)=>{const m=ME;ME=S.users.find(u=>u.role===r&&u.actif);try{return f()}finally{ME=m}};
  const p=S.produits[0],mk=()=>as("admin",()=>creerCmd({client_id:S.clients[0].id,adr:Object.assign({},S.clients[0].adresses[0]),lignes:[{produit_id:p.id,qte:1,pu:p.prix}],frais:2000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true}));
  const c=mk();as("admin",()=>{setStatut(c,"preparation");marquerPrete(c)});const l=as("admin",()=>{const x=affecter(c,lv.id,"");accepter(x);priseEnCharge(x,1);demarrer(x);return x});
  S.notifs=[];const cl=cli(c.client_id);cl.tel=cl.tel||"0700000001";
  const ev=(d,ref)=>({livraison_ref:ref||l.id,livreur_ref:lv.id,type:"incident",donnees:{nature:"MSG",description:d}});
  o.route=passAppliquer(ev("MSG|route|"))===""&&S.notifs.length===1&&S.notifs[0].event==="livreur_msg"&&S.notifs[0].message.includes(c.numero)&&S.notifs[0].message.includes(cl.nom)&&S.notifs[0].message.includes(lv.nom.split(" ")[0])&&S.notifs[0].statut==="a_envoyer"&&S.notifs[0].livraison_id===l.id;
  const au=()=>JSON.stringify(S.audit.slice(-1));o.dedup=passAppliquer(ev("MSG|route|"))!==""&&S.notifs.length===1&&/déjà envoyé/.test(au());
  o.retard=passAppliquer(ev("MSG|retard|30"))===""&&/30 minutes/.test(S.notifs[1].message);
  o.inconnu=passAppliquer(ev("MSG|zzz|"))!=="";
  const tel=cl.tel;cl.tel="";o.sansTel=passAppliquer(ev("MSG|bas|"))!==""&&/sans numéro/.test(au());cl.tel=tel;
  o.alerte=alertes().some(a=>/message\(s\) de livreur à envoyer au client/.test(a.m));
  const nb=S.notifs.length;l.statut="livree";o.fin=passAppliquer(ev("MSG|arrive|"))!==""&&/terminée/.test(au())&&S.notifs.length===nb;l.statut="en_cours";
  const pr=passProjection(l).payload;o.proj=pr.msg_possible===true&&pr.msgs.length===2&&pr.msgs[0].tpl==="route";
  /* chat */
  S.chat=[];const cev=t=>({livraison_ref:"stats:"+lv.id,livreur_ref:lv.id,type:"incident",donnees:{nature:"CHAT",description:t}});
  o.chatIn=passAppliquer(cev("CHAT|Je suis bloqué | trafic"))===""&&S.chat.length===1&&S.chat[0].texte==="Je suis bloqué | trafic"&&S.chat[0].de==="livreur";
  o.chatDedup=(passAppliquer(cev("CHAT|Je suis bloqué | trafic")),S.chat.length===1);
  o.vide=passAppliquer(cev("CHAT|   "))!==""&&S.chat.length===1;
  o.nonlu=chatNonLusCentre()===1&&alertes().some(a=>/message\(s\) de livreur non lu/.test(a.m));
  view="livraisons";ui={cdt:"msg"};const h=VIEWS.livraisons();o.tab=/Messages des livreurs/.test(h)&&h.includes(lv.nom)&&/💬 Messages \(1\)/.test(h);
  chatOuvrir(lv.id);o.lu=chatNonLusCentre()===0&&/Je suis bloqué/.test(document.getElementById("modal").innerHTML);
  const f=document.getElementById("mf");f.querySelector("[name=t]").value="OK, on vous rappelle";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  o.reply=S.chat.length===2&&S.chat[1].de==="centre"&&chatPayload(lv).length===2&&chatPayload(lv)[1].de==="centre";
  lv.ident_serveur="t.lv";const M=passStatsMissions().find(x=>x.livreur_ref===lv.id).payload;o.pub=M.chat.length===2&&JSON.stringify(passStatsMissions())===JSON.stringify(passStatsMissions());o.chat=M.chat;
  return o});
 chk("CM-1","message prêt : arrive dans les notifications clients, texte complété (client, n°, livreur), dédoublonné 3 min, retard paramétré",r.route&&r.dedup&&r.retard,JSON.stringify(r));
 chk("CM-2","refus : message inconnu, client sans numéro, course terminée ; alerte « à envoyer sans attendre » ; état publié",r.inconnu&&r.sansTel&&r.fin&&r.alerte&&r.proj,JSON.stringify(r));
 chk("CM-3","chat : réception du livreur (texte avec |), dédoublonné, message vide refusé, non lus, onglet Messages",r.chatIn&&r.chatDedup&&r.vide&&r.nonlu&&r.tab,JSON.stringify(r));
 chk("CM-4","chat : ouverture marque lu, réponse du centre, publication au livreur (stable)",r.lu&&r.reply&&r.pub,JSON.stringify(r));
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async chat=>{const o={};user={id:"u"};moi={nom:"T",livreur_ref:"l1"};
  const mk=st=>({livraison_ref:"a",commande_ref:"CMD-1",statut:st,payload:{numero:"CMD-1",client_nom:"C",adr:{zone:"Cocody"},lignes:[],montant_attendu:0,msg_possible:true,msgs:[{tpl:"route",ts:new Date().toISOString(),statut:"a_envoyer"}]}});
  const ch=chat.map(m=>Object.assign({},m,{ts:new Date(Date.now()-5000).toISOString()}));
  STATS={livraison_ref:"stats:l1",statut:"stats",maj_le:new Date(Date.now()-60000).toISOString(),payload:{p:{j:{},s7:{},m30:{},mois:{}},jours7:[],chat:ch}};
  missions=[mk("en_cours")];PAGE="cours";vueMissions();let h=document.body.innerText;o.btn=/Message au client/.test(h)&&/Je suis en route — ⏳ en attente d'envoi/.test(h)&&/message\(s\) du centre/.test(h);
  let envoi=[];window.envoyer=async(r,t,d)=>{envoi.push({r,t,d});return{ok:true}};
  msgClient("a");const mo=document.querySelector(".ov").innerText;o.modal=Object.keys(MSGL).every(k=>mo.includes(MSGL[k].slice(2)));
  document.querySelector('[data-mt="arrive"]').click();await new Promise(r=>setTimeout(r,30));o.sendArrive=envoi.length===1&&envoi[0].r==="a"&&envoi[0].d.nature==="MSG"&&envoi[0].d.description==="MSG|arrive|";
  ferme();ouvert=null;msgClient("a");document.querySelector('[data-mt="retard"]').click();document.querySelector('[data-rt="20"]').click();await new Promise(r=>setTimeout(r,30));o.sendRetard=envoi.length===2&&envoi[1].d.description==="MSG|retard|20";
  ferme();ouvert=null;envoi=[];await msgEnvoyer("a","route","");o.recent=envoi.length===0;
  /* chat */
  ferme();ouvert=null;ACT.page("chat");const nv=chatNonLus();o.vu=nv===0;h=document.body.innerText;o.page=/Messages du centre/.test(h)&&/OK, on vous rappelle/.test(h)&&/Je suis bloqué/.test(h);
  envoi=[];document.getElementById("chin").value="Bien reçu | merci";ACT.chatsend();await new Promise(r=>setTimeout(r,30));o.sendChat=envoi.length===1&&envoi[0].r==="stats:l1"&&envoi[0].d.nature==="CHAT"&&envoi[0].d.description==="CHAT|Bien reçu / merci";o.pend=/Bien reçu \/ merci/.test(document.body.innerText)&&/en cours d'envoi/.test(document.body.innerText);
  envoi=[];ACT.chatq("1");await new Promise(r=>setTimeout(r,30));o.quick=envoi.length===1&&envoi[0].d.description==="CHAT|J'arrive";
  /* nouveau message du centre */
  PAGE="cours";CH.vus=null;sigChat();STATS.payload.chat=ch.concat([{de:"centre",texte:"Nouveau",ts:new Date().toISOString()}]);let sig=0;const t=window.toast;sigChat();o.sig=CH.vus===ch.filter(m=>m.de==="centre").length+1;o.nonlu=chatNonLus()>=1;
  return o},r.chat);
 chk("CM-5","app livreur : bouton « Message au client », 6 messages prêts, retard en minutes, envoi, anti-doublon, état d'envoi",v.btn&&v.modal&&v.sendArrive&&v.sendRetard&&v.recent,JSON.stringify(v));
 chk("CM-6","app livreur : chat (lu à l'ouverture, envoi, réponses rapides, message en cours d'envoi, signal de nouveau message)",v.vu&&v.page&&v.sendChat&&v.pend&&v.quick&&v.sig&&v.nonlu,JSON.stringify(v));
 chk("CM-7","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
