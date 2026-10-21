/* Rapport quotidien des connexions pour le DG, côté navigateur : réglages (Paramètres du hub → Connexions), génération à l'heure choisie, bandeau, message WhatsApp, un seul rapport par jour.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/rapport-dg.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const open=async f=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(f+": "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+f+".html");await p.waitForTimeout(700);return p};
 /* journal de départ : une connexion réelle sur Distributions, puis des échecs */
 const D=await open("distribution");
 await D.evaluate(async mdp=>{const go=async(u,pin)=>{ME=null;view="dashboard";render();const f=document.getElementById("lf");f.u.value=u.id;(f.pin||f.p).value=pin;f.requestSubmit();await new Promise(r=>setTimeout(r,900))};
  const ad=S.users.find(u=>u.role==="admin"&&u.actif),ca=S.users.find(u=>u.role==="caissier"&&u.actif);await go(ad,mdp);ACT.logout();for(let i=0;i<3;i++)await go(ca,"x"+i)},"Demo@Angels2026");
 const sync=await D.evaluate(()=>{const m=document.querySelectorAll("script[src='rapport-engine.js']").length;return{m,api:typeof ANGELS_RAPPORT,coll:(JSON.parse(localStorage.getItem("angels_sync_cfg")||"null"),1)}});
 chk("RD-1","le moteur du rapport est chargé dans Distributions (et fourni hors-ligne par le service worker)",sync.m===1&&sync.api==="object"&&/rapport-engine\.js/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8")));
 const sy=fs.readFileSync(path.join(root,"distribution.html"),"utf8")+fs.readFileSync(path.join(root,"transport.html"),"utf8")+fs.readFileSync(path.join(root,"agro.html"),"utf8");
 chk("RD-2","les trois applications synchronisent leur journal de connexion avec le serveur (collection « connexions ») pour le rapport automatique",(sy.match(/ajout:\["audit","connexions"\]/g)||[]).length===3);
 /* hub */
 const H=await open("parametres");await H.evaluate(()=>pTab("connexions"));await H.waitForTimeout(300);
 const carte=await H.evaluate(()=>{const c=document.getElementById("rp-card");return c?{actif:c.querySelector("[data-rp=actif]").checked,heure:c.querySelector("[data-rp=heure]").value,btn:[...c.querySelectorAll("[data-rpb]")].map(x=>x.dataset.rpb).join()}:null});
 chk("RD-3","Paramètres du hub → Connexions : carte « Rapport quotidien au DG » (actif, 11:00 par défaut, enregistrer / aperçu / WhatsApp / e-mail de test)",!!carte&&carte.actif&&carte.heure==="11:00"&&carte.btn==="save,apercu,wa,mail",JSON.stringify(carte));
 await H.fill("#rp-card [data-rp=nom]","Monsieur le DG");await H.fill("#rp-card [data-rp=tel]","07 01 02 03 04");await H.fill("#rp-card [data-rp=emails]","dg@exemple.ci, faux");await H.click("[data-rpb=save]");await H.waitForTimeout(200);
 const cf=await H.evaluate(()=>ANGELS_RAPPORT.cfg());
 chk("RD-4","les réglages (nom, WhatsApp, e-mails, heure) sont enregistrés sur l'appareil",cf.nom==="Monsieur le DG"&&cf.tel==="07 01 02 03 04"&&/dg@exemple\.ci/.test(cf.emails)&&cf.heure==="11:00",JSON.stringify(cf));
 /* aperçu */
 await H.click("[data-rpb=apercu]");await H.waitForTimeout(300);
 const ap=await H.evaluate(()=>{const o=document.getElementById("rp-ov");return o?o.innerText:""});
 chk("RD-5","« Aperçu maintenant » ouvre le rapport (connexions réussies, échecs répétés, noms des utilisateurs)",/Rapport de connexion/.test(ap)&&/Distributions/.test(ap)&&/échec/i.test(ap),ap.slice(0,200));
 await H.evaluate(()=>document.getElementById("rp-ov").remove());
 /* WhatsApp */
 const wa=await H.evaluate(()=>{let u="";window.open=x=>{u=x;return null};const x=ANGELS_RAPPORT.generer(Date.now(),true);ANGELS_RAPPORT.envoyerWA(x.id);return u});
 chk("RD-6","WhatsApp : lien wa.me vers le numéro du DG (indicatif 225 ajouté) avec le message déjà rédigé",/^https:\/\/wa\.me\/2250701020304\?text=/.test(wa)&&decodeURIComponent(wa).includes("Rapport de connexion"),wa.slice(0,120));
 /* planification */
 const pl=await H.evaluate(()=>{const R=ANGELS_RAPPORT;localStorage.removeItem("angels_rapports_dg");R.setCfg({derniere:"",fin:"",actif:true,heure:"11:00"});
  const jour=new Date(),d=new Date(Date.UTC(jour.getUTCFullYear(),jour.getUTCMonth(),jour.getUTCDate(),10,30)),e=new Date(Date.UTC(jour.getUTCFullYear(),jour.getUTCMonth(),jour.getUTCDate(),11,2));
  const avant=R.verifier(d.getTime()),a1=R.verifier(e.getTime()),a2=R.verifier(e.getTime()+36e5);
  return{avant:!!avant,a1:!!a1,a2:!!a2,n:R.liste().length,bar:!!document.getElementById("rp-bar"),t:a1&&a1.rapport.ok}});
 chk("RD-7","à 11 h (Abidjan) le rapport est généré une seule fois par jour ; rien avant l'heure ; bandeau « Rapport prêt »",!pl.avant&&pl.a1&&!pl.a2&&pl.n===1&&pl.bar,JSON.stringify(pl));
 const desact=await H.evaluate(()=>{const R=ANGELS_RAPPORT;localStorage.removeItem("angels_rapports_dg");R.setCfg({actif:false,derniere:""});return!R.verifier(Date.now()+864e5*3)});
 chk("RD-8","désactivé, aucun rapport n'est généré",desact===true);
 /* e-mail test sans synchronisation */
 const sansSync=await H.evaluate(async()=>{try{await ANGELS_RAPPORT.tester();return"ok"}catch(e){return e.message}});
 chk("RD-9","e-mail de test sans synchronisation activée : message clair, pas d'erreur de script",/Synchronisation non activée/.test(sansSync),sansSync);
 chk("RD-10","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
