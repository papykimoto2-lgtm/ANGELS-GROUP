/* Passerelle livreur : bureau (publication sans numéros, application des actions) et application livreur (connexion, missions, actions), serveur simulé.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/passerelle-appli.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 const TEL="0707123456";
 /* ---------- Bureau ---------- */
 const off=await p.evaluate(async()=>{const calls=[];window.fetch=async(u,o)=>{calls.push(String(u));return{ok:true,status:200,json:async()=>({ok:true})}};S.config.appel_pont={actif:false,url:"https://fn.example/functions/v1",cle_admin:"ADM"};ME=S.users.find(u=>u.role==="admin");await passSync(true);return{n:calls.length,actif:!!PASS()}});
 chk("PG-0","par défaut (ancien système conservé) : passerelle désactivée, aucun appel réseau",off.n===0&&!off.actif,JSON.stringify(off));
 const pub=await p.evaluate(async TEL=>{
  const l=S.livraisons.find(x=>x.statut==="en_cours"),c=cmd(l.commande_id),cl=cli(c.client_id);cl.tel=TEL;c.adr.repere="Près du kiosque, tél. +225 07 07 12 34 56";c.adr.instructions="Appelez le client au 07 07 12 34 56";c.obs="Rappeler au 0707123456";
  window.__l=l.id;window.__code=l.code;window.__c=c.id;window.__lv=l.livreur_id;
  const calls=[];let events=[];window.fetch=async(u,o)=>{const body=o&&o.body?JSON.parse(o.body):null;calls.push({u:String(u),k:o&&o.headers&&o.headers["x-admin-key"],b:body});
   const a=body&&body.action;return{ok:true,status:200,json:async()=>a==="evenements"?{ok:true,evenements:events}:{ok:true,ignorees:0}}};
  window.__calls=calls;window.__setEv=e=>{events=e};
  S.config.appel_pont={actif:false,url:"https://fn.example/functions/v1",cle_admin:"ADM-KEY"};S.config.passerelle_actif=true;ME=S.users.find(u=>u.role==="admin");_passSig="";S.pass=undefined;await passSync(true);
  const pu=calls.find(x=>x.b&&x.b.action==="publier"),raw=JSON.stringify(pu&&pu.b),m=pu&&pu.b.missions.find(x=>x.livraison_ref===l.id);
  return{url:pu&&pu.u,k:pu&&pu.k,tel:/0707123456|07 07 12 34 56/.test(raw),nm:pu&&pu.b.missions.length,code:m&&m.code,payloadCode:m&&("code" in m.payload),payloadTel:m&&("tel" in m.payload)||/"tel"/.test(JSON.stringify(m&&m.payload)),cle:m&&m.payload.cle_appel&&m.payload.cle_appel.length,rep:m&&m.payload.adr.repere,order:calls.findIndex(x=>x.b&&x.b.action==="evenements")<calls.findIndex(x=>x.b&&x.b.action==="publier")}},TEL);
 chk("PG-1","publication : clé d'administration envoyée, aucun numéro de téléphone dans les données publiées (repère, instructions, observations masqués), le code n'est pas dans la projection",pub.url==="https://fn.example/functions/v1/mission-sync"&&pub.k==="ADM-KEY"&&!pub.tel&&!pub.payloadCode&&!pub.payloadTel&&pub.cle===32&&/••/.test(pub.rep),JSON.stringify(pub));
 chk("PG-2","les actions des livreurs sont récupérées avant la publication ; le code est transmis une fois au serveur pour empreinte",pub.order&&pub.code===(await p.evaluate(()=>window.__code)),JSON.stringify(pub));
 const ev=await p.evaluate(async()=>{
  const lv=liv(window.__lv),c0=cmd(window.__c);let aff=S.livraisons.find(x=>x.statut==="affectee"&&x.id!==window.__l);
  /* accepter → prise en charge → démarrer sur une autre mission, confirmer sur la mission en cours (signature exigée : contournée par la passerelle) */
  const tst=[];let id=100;const E=(l,t,d)=>({id:++id,livraison_ref:l.id,livreur_ref:l.livreur_id,type:t,donnees:d||{}});
  const l1=S.livraisons.find(x=>x.id===window.__l),att=l1.montant_attendu;S.config.signature_seuil=1;
  window.__setEv([E(l1,"position",{lat:5.35,lng:-4.0,precision:12}),E(l1,"incident",{nature:"Panne",description:"Crevaison"}),E(l1,"confirmer",{code:l1.code,montant:att,mode:"Espèces",recu_par:"Mme Konan",obs:"",ecart_note:""})]);
  window.__calls.length=0;_passLast=0;await passSync(true);
  const ack=window.__calls.find(x=>x.b&&x.b.action==="acquitter");
  return{statut:l1.statut,enc:l1.montant_encaisse,att,recu:l1.recu_par,pos:!!S.pos[l1.livreur_id]&&S.pos[l1.livreur_id].lat===5.35,inc:S.incidents.some(i=>i.desc==="Crevaison"),ack:ack&&ack.b.ids,audit:S.audit.some(a=>/passerelle/i.test(a.action)),me:ME&&ME.role}});
 chk("PG-3","le bureau applique les actions : position, incident, livraison confirmée (montant, personne ayant reçu), audit « via passerelle », puis acquittement",ev.statut==="livree"&&ev.enc===ev.att&&ev.recu==="Mme Konan"&&ev.pos&&ev.inc&&ev.audit&&JSON.stringify(ev.ack)==="[101,102,103]"&&ev.me==="admin",JSON.stringify(ev));
 const ev2=await p.evaluate(async()=>{const l=S.livraisons.find(x=>x.statut==="affectee");if(!l)return{skip:true};const E=(t,d)=>({id:200,livraison_ref:l.id,livreur_ref:l.livreur_id,type:t,donnees:d||{}});
  window.__setEv([E("accepter"),{...E("prise_en_charge",{nb_colis:2}),id:201},{...E("demarrer"),id:202}]);_passLast=0;await passSync(true);return{st:l.statut,nb:l.nb_colis,collecte:!!l.collecte_at}});
 chk("PG-4","accepter → prise en charge → démarrer appliqués dans l'ordre sur le poste du bureau",ev2.skip||(ev2.st==="en_cours"&&ev2.nb===2&&ev2.collecte),JSON.stringify(ev2));
 const ev3=await p.evaluate(async()=>{const l=S.livraisons.find(x=>x.statut==="livree"&&x.id===window.__l);window.__setEv([{id:300,livraison_ref:l.id,livreur_ref:l.livreur_id,type:"echec",donnees:{motif:"Client absent"}}]);window.__calls.length=0;_passLast=0;await passSync(true);const ack=window.__calls.find(x=>x.b&&x.b.action==="acquitter");return{st:l.statut,ack:ack&&ack.b.ids,audit:S.audit.some(a=>/non appliquée/.test(a.action))}});
 chk("PG-5","une action devenue impossible côté bureau (déjà livrée) est refusée, tracée, acquittée et l'état du bureau reste la référence",ev3.st==="livree"&&JSON.stringify(ev3.ack)==="[300]"&&ev3.audit,JSON.stringify(ev3));
 const cpt=await p.evaluate(async()=>{window.__calls.length=0;const orig=ANGELS_AUTH.afficherTemp;let vu=null;ANGELS_AUTH.afficherTemp=async o=>{vu=o};const f=window.fetch;window.fetch=async(u,o)=>{const body=JSON.parse(o.body);window.__calls.push({b:body});return{ok:true,status:200,json:async()=>body.action==="compte-creer"?{ok:true,ident:body.ident,mdp:"Tmp-Abc123-xyz"}:{ok:true,mdp:"Tmp-Reset9-xyz"}}};
  const lv=S.livreurs[0];delete lv.ident_serveur;const r1=await passCompte(lv,false);const r2=await passCompte(lv,true);ANGELS_AUTH.afficherTemp=orig;window.fetch=f;
  return{r1,r2,id:lv.ident_serveur,vu:vu&&vu.mdp,calls:window.__calls.map(x=>x.b.action),ref:window.__calls[0].b.livreur_ref===lv.id}});
 chk("PG-6","compte serveur : création puis réinitialisation, le mot de passe temporaire n'est montré que dans la fenêtre, jamais stocké sur le poste",cpt.r1&&cpt.r2&&/^[a-z0-9.]+$/.test(cpt.id||"")&&JSON.stringify(cpt.calls)==='["compte-creer","compte-reset"]'&&cpt.ref&&!JSON.stringify(await p.evaluate(()=>S)).includes("Tmp-"),JSON.stringify(cpt));

 /* ---------- Application livreur ---------- */
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push("livreur: "+e.message));
 const MISSION={livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-0001",statut:"affectee",maj_le:new Date().toISOString(),position:null,payload:{numero:"CMD-0001",priorite:"urgente",client_nom:"Mme Konan",adr:{zone:"Cocody",quartier:"Angré",repere:"Près du kiosque, tél. •• •• •• ••",instructions:"",gps:null},lignes:[{desig:"Robe wax",qte:2,pu:15000}],obs:"",montant_attendu:30000,paye_vendeur:0,nb_colis:0,collecte_at:null,cle_appel:"c".repeat(32),appel_possible:true,exige_colis:false,exige_signature:true,motifs:["Client absent","Adresse introuvable"],modes:["Espèces","Wave"]}};
 await q.addInitScript(()=>{
  window.__sent=[];window.__missions=null;window.__chg=true;
  const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:window.__chg}}});
  const sb={auth:{signInWithPassword:async({email,password})=>{window.__login={email,password};(window.__tries=window.__tries||[]).push(password);return password==="bon"?{data:{},error:null}:{data:null,error:{message:"Invalid login credentials"}}},getSession:async()=>({data:{session:window.__in?sess():null}}),updateUser:async({password,data})=>{window.__upd={password,data};window.__chg=false;return{data:{},error:null}},signOut:async()=>{window.__in=false}},
   from:t=>({select:()=>{const r={order:async()=>({data:window.__missions,error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})};return r}})};
  window.supabase={createClient:()=>{return new Proxy(sb,{get:(o,k)=>{if(k==="auth"){const a=o.auth;return{...a,signInWithPassword:async x=>{const r=await a.signInWithPassword(x);if(!r.error)window.__in=true;return r}}}return o[k]}})}};
 });
 await q.route("**/functions/v1/**",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");await q.evaluate(x=>window.__sent.push(x),{u:rq.url(),auth:rq.headers()["authorization"],apikey:rq.headers()["apikey"],b:body});
  const bad=body.type==="confirmer"&&body.donnees.code!=="4821";rt.fulfill({status:bad?403:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(bad?{ok:false,erreur:"Code de confirmation incorrect"}:{ok:true,message:"Votre téléphone va sonner",statut:"x"})})});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 chk("LV-0","non connecté : écran de connexion, aucune mission affichée",await q.locator("#fl").count()===1&&!/CMD-0001/.test(await q.content()));
 await q.evaluate(()=>{window.__missions=[JSON.parse(JSON.stringify(window.__M||null))]});
 await q.evaluate(m=>{window.__missions=[m]},MISSION);
 await q.fill("#li","koffi.yao");await q.fill("#lp","mauvais");await q.click("#fl button:not(.aa-e)");await q.waitForTimeout(300);
 chk("LV-1","mauvais mot de passe : refusé par le serveur avec un message clair",/incorrect/.test(await q.innerText("#app")),await q.innerText("#app"));
 await q.evaluate(()=>{window.__tries=[]});await q.fill("#li","KOFFI YAO");await q.fill("#lp","mauvais ");await q.click("#fl button:not(.aa-e)");await q.waitForTimeout(300);
 const tr=await q.evaluate(()=>window.__tries);
 chk("LV-1b","espace ajoutée par le clavier après le mot de passe : second essai sans l'espace ; le message indique l'identifiant réellement envoyé (« KOFFI YAO » → koffi.yao)",tr.join("|")==="mauvais |mauvais"&&/identifiant envoyé : koffi\.yao/.test(await q.innerText("#app")),JSON.stringify(tr)+await q.innerText("#app"));
 await q.fill("#li","Koffi.Yao");await q.fill("#lp","bon");await q.click("#fl button:not(.aa-e)");await q.waitForTimeout(400);
 const lg=await q.evaluate(()=>window.__login);
 chk("LV-2","connexion par le serveur avec l'identifiant converti en adresse technique ; mot de passe temporaire → changement obligatoire avant toute mission",lg.email==="koffi.yao@users.angels-erp.app"&&await q.locator("#fc").count()===1&&!/CMD-0001/.test(await q.innerText("#app")),JSON.stringify(lg));
 await q.fill("#n1","court");await q.fill("#n2","court");await q.click("#fc button:not(.aa-e)");await q.waitForTimeout(150);
 const faible=/trop faible/.test(await q.innerText("#app"));
 await q.fill("#n1","Koffi-Nouveau-2026");await q.fill("#n2","Koffi-Nouveau-2026");await q.click("#fc button:not(.aa-e)");await q.waitForTimeout(150);
 const nom=/nom/.test(await q.innerText("#cm"));
 await q.fill("#n1","Zèbre#Rapide-2026!");await q.fill("#n2","Zèbre#Rapide-2026!");await q.click("#fc button:not(.aa-e)");await q.waitForTimeout(500);
 const up=await q.evaluate(()=>window.__upd);
 chk("LV-3","politique appliquée (longueur, nom exclu) puis mot de passe changé côté serveur (indicateur chg levé)",faible&&nom&&up&&up.password==="Zèbre#Rapide-2026!"&&up.data.chg===false,JSON.stringify({faible,nom,up}));
 const ui=await q.evaluate(()=>({txt:document.getElementById("app").innerText,html:document.getElementById("app").innerHTML}));
 chk("LV-4","mission affichée sans numéro de téléphone ni code ; bouton d'appel masqué ; montant à encaisser visible",/CMD-0001/.test(ui.txt)&&/30 000 F/.test(ui.txt)&&!/0707|tel:|wa\.me|whatsapp/i.test(ui.html)&&/Appeler le client \(numéro masqué\)/.test(ui.txt)&&!/code/i.test(ui.txt.replace(/Code donné/g,"")),ui.txt);
 await q.click('[data-a="accepter"]');await q.waitForTimeout(300);
 const s1=await q.evaluate(()=>window.__sent);
 chk("LV-5","accepter : envoyé au serveur avec le jeton de la session et la clé publique, jamais de numéro",s1.length===1&&s1[0].u.endsWith("/functions/v1/mission-action")&&s1[0].auth==="Bearer JWT-TEST"&&/^eyJ/.test(s1[0].apikey)&&s1[0].b.type==="accepter"&&s1[0].b.livraison_ref==="l1",JSON.stringify(s1));
 await q.evaluate(m=>{m.statut="en_cours";m.payload.collecte_at=new Date().toISOString();window.__missions=[m]},MISSION);
 await q.evaluate(()=>{window.__sent.length=0});await q.evaluate(()=>{document.querySelector("#app")});
 await q.waitForTimeout(100);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(150);
 await q.click('[data-a="confirmer"]');await q.waitForTimeout(150);
 await q.fill('input[name="code"]',"0000");await q.fill('input[name="recu_par"]',"Mme Konan");await q.click('.ov button[type=submit]');await q.waitForTimeout(300);
 const mauvais=await q.evaluate(()=>({t:document.getElementById("toast").textContent,ouvert:!!document.querySelector(".ov")}));
 chk("LV-6","code incorrect : refusé par le serveur, la fenêtre reste ouverte, rien n'est confirmé",/incorrect/.test(mauvais.t)&&mauvais.ouvert,JSON.stringify(mauvais));
 await q.fill('input[name="code"]',"4821");await q.click('.ov button[type=submit]');await q.waitForTimeout(300);
 const bon=await q.evaluate(()=>window.__sent.filter(x=>x.b.type==="confirmer").pop());
 chk("LV-7","bon code : action « confirmer » envoyée avec montant, mode et personne ayant reçu (le code est vérifié par le serveur uniquement)",bon&&bon.b.donnees.code==="4821"&&bon.b.donnees.montant==="30000"&&bon.b.donnees.recu_par==="Mme Konan",JSON.stringify(bon));
 await q.evaluate(()=>{window.__sent.length=0});await q.click('[data-a="appeler"]');await q.waitForTimeout(300);
 const ap=await q.evaluate(()=>window.__sent[0]);
 chk("LV-8","appel du client : demande au pont avec la clé d'appel de la mission, jamais de numéro",ap&&ap.u.endsWith("/functions/v1/appel-pont")&&ap.b.commande==="CMD-0001"&&ap.b.cle==="c".repeat(32)&&!/tel|numero/i.test(JSON.stringify(ap.b)),JSON.stringify(ap));
 await q.click('[data-a="quitter"]');await q.waitForTimeout(200);
 chk("LV-9","déconnexion : retour à l'écran de connexion, missions effacées de l'écran",await q.locator("#fl").count()===1&&!/CMD-0001/.test(await q.content()));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.join(" | "):""));process.exit(ko||errs.length?1:0);
})();
