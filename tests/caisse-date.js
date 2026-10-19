/* Date du bon de caisse (même principe que la caisse Menko immo) : date du jour par défaut, jamais dans le futur,
   bon antérieur à la session = choix tiroir / régularisation, bon antérieur au démarrage de la caisse = hors tiroir d'office.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/caisse-date.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__j=n=>{const d=new Date();d.setDate(d.getDate()+n);return cxJour(d)};
  /* caisse dont la première session a été ouverte il y a 10 jours, session courante ouverte il y a 2 jours */
  window.__nc=nom=>{__as("admin");cxCreerLocal(nom,"572");const c=S.caisses.find(x=>x.nom===nom);__as("caissier");cxOuvrirLocal(c,0,"");const s=cxOpen(c);s.ouverte_le=new Date(Date.now()-10*864e5).toISOString();
   __as("admin");cxBonLocal(c,"entree",50000,"Apport","Associé","","Apport");cxCloturerLocal(s.id,50000,"",{aveugle:false,motif_enc:"mise en place du test"});
   __as("caissier");cxOuvrirLocal(c,50000,"");cxOpen(c).ouverte_le=new Date(Date.now()-2*864e5).toISOString();return c};
  window.__ad=(f)=>{__as("admin");try{return f()}catch(e){return "ERR:"+e.message}}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("CDT-1","sans date : le bon prend la date du jour ; le N° de bon porte cette date ; le solde bouge",()=>{const c=__nc("CDT1"),E=[];__as("admin");const m=cxBonLocal(c,"sortie",1000,"Café","Cantine","","Fournitures");
  if(m.date!==cxJour())E.push("date "+m.date);if(!m.numero.includes(cxJour().replace(/-/g,"")))E.push("numéro "+m.numero);if(cxSolde(c)!==49000)E.push("solde "+cxSolde(c));if(m.hors_tiroir)E.push("hors tiroir");return E.length?E.join(" ; "):true});
 await t("CDT-2","date future refusée ; format invalide refusé",()=>{const c=__nc("CDT2"),E=[];
  if(!/futur/.test(__ad(()=>cxBonLocal(c,"entree",100,"x","y","","Apport",false,__j(1)))))E.push("futur accepté");
  if(!/invalide/.test(__ad(()=>cxBonLocal(c,"entree",100,"x","y","","Apport",false,"31/12/2025"))))E.push("format accepté");return E.length?E.join(" ; "):true});
 await t("CDT-3","date passée dans la session courante... : bon daté d'hier compté dans le tiroir (choix « OK »), N° et date d'hier",()=>{const c=__nc("CDT3"),E=[],d=__j(-1);__as("admin");
  const m=cxBonLocal(c,"sortie",2000,"Carburant","Station","","Carburant",false,d,false);
  if(m.date!==d)E.push("date "+m.date);if(!m.numero.includes(d.replace(/-/g,"")))E.push("numéro "+m.numero);if(cxSolde(c)!==48000)E.push("solde "+cxSolde(c));if(cxDecale(m)!==true)E.push("décalé");return E.length?E.join(" ; "):true});
 await t("CDT-4","régularisation (choix « Annuler ») : bon avant la session, hors tiroir : le solde du tiroir ne bouge pas, mais il suit la validation et la comptabilité à sa date",()=>{const c=__nc("CDT4"),E=[],d=__j(-5);
  const m=__ad(()=>cxBonLocal(c,"sortie",7000,"Facture oubliée","Fournisseur","F-9","Fournitures",false,d,true));
  if(!m.hors_tiroir)E.push("pas hors tiroir");if(cxSolde(c)!==50000)E.push("solde "+cxSolde(c));if(m.statut!=="valide")E.push("statut "+m.statut);
  if(!(m.date===d))E.push("date");return E.length?E.join(" ; "):true});
 await t("CDT-5","reprise d'historique : date antérieure au démarrage de la caisse = hors tiroir d'office, sans demander",()=>{const c=__nc("CDT5"),E=[],d=__j(-20);
  const m=__ad(()=>cxBonLocal(c,"entree",9000,"Recette ancienne","Client","","Apport",false,d,false));if(!m.hors_tiroir)E.push("pas hors tiroir");if(cxSolde(c)!==50000)E.push("solde "+cxSolde(c));return E.length?E.join(" ; "):true});
 await t("CDT-6","clôture : un bon hors tiroir ne fausse ni le théorique ni l'écart",()=>{const c=__nc("CDT6"),E=[];__ad(()=>cxBonLocal(c,"sortie",3000,"Régul","Fournisseur","F-1","Fournitures",false,__j(-6),true));
  const s=cxOpen(c);if(cxSoldeS(s)!==50000)E.push("théorique "+cxSoldeS(s));__as("caissier");cxCloturerLocal(s.id,50000,"",{aveugle:false,motif_enc:"test clôture tardive"});const z=S.caisse_sessions.find(x=>x.id===s.id);if(z.ecart!==0)E.push("écart "+z.ecart);return E.length?E.join(" ; "):true});
 await t("CDT-7","sortie hors tiroir plus grosse que le solde : pas de blocage (aucun effet sur le tiroir) ; validation d'un bon hors tiroir sans contrôle de solde",()=>{const c=__nc("CDT7"),E=[];__as("caissier");
  const m=cxBonLocal(c,"sortie",900000,"Ancienne facture","Fournisseur","F-2","Fournitures",false,__j(-6),true);if(m.statut!=="en_attente")E.push("statut "+m.statut);
  __as("admin");cxValiderLocal(m.id,"valider");if(m.statut!=="valide"||cxSolde(c)!==50000)E.push("validation "+m.statut+" "+cxSolde(c));return E.length?E.join(" ; "):true});
 await t("CDT-8","formulaire : champ « Date du bon » (type date, jour par défaut, plafonné au jour) ; saisie d'un bon daté d'hier via l'interface",()=>{const c=__nc("CDT8"),E=[];__as("admin");cxBonForm(c,"sortie");
  const i=document.querySelector('input[name="date"]');if(!i)return"champ absent";if(i.type!=="date"||i.value!==cxJour()||i.max!==cxJour())E.push("attributs "+i.type+"/"+i.value+"/"+i.max);
  document.querySelector('[name="m"]').value="1500";document.querySelector('[name="motif"]').value="Papier";document.querySelector('[name="tiers"]').value="Papeterie";i.value=__j(-1);
  const bt=[...document.querySelectorAll("button")].find(x=>/Enregistrer le bon/.test(x.textContent));if(!bt)return"bouton absent";bt.click();
  const m=S.caisse_mvts.filter(x=>x.caisse_id===c.id&&x.motif==="Papier")[0];if(!m)E.push("bon non enregistré "+(__T[__T.length-1]||""));else if(m.date!==__j(-1))E.push("date "+m.date);return E.length?E.join(" ; "):true});
 await t("CDT-9","affichage : bon daté d'un autre jour repéré (📅) dans le brouillard, bon hors tiroir signalé, brouillard par période sans variation du solde, impression du bon avec la date",()=>{const c=__nc("CDT9"),E=[];
  const m=__ad(()=>cxBonLocal(c,"sortie",4000,"Loyer oublié","Bailleur","Q-1","Fournitures",false,__j(-6),true));ui.cxsel=c.id;ui.cxbm="session";__as("admin");
  const h=VIEWS.caisse();if(!/hors tiroir/.test(h)||!/📅/.test(h))E.push("session");
  ui.cxbm="periode";ui.cxd1=__j(-30);ui.cxd2=__j(0);const h2=VIEWS.caisse();if(!/hors tiroir/.test(h2))E.push("période");const d=cxBrData();const last=d.rows[d.rows.length-1];if(d.run!==50000)E.push("solde période "+d.run);
  let pr="";const old=window.rapport;window.rapport=(t,x)=>{pr=x};try{cxPrintBon(m.id)}finally{window.rapport=old}if(!pr.includes(new Date(m.date+"T12:00:00").toLocaleDateString("fr-FR"))||!/sans effet sur le tiroir/.test(pr))E.push("impression");return E.length?E.join(" ; "):true});
 await t("CDT-10","anciens bons (sans date) : comportement inchangé ; mode serveur : bon d'un autre jour refusé proprement",()=>{const c=__nc("CDT10"),E=[];__as("admin");const m=cxBonLocal(c,"entree",100,"Ancien","X","","Apport");delete m.date;delete m.hors_tiroir;
  if(!(cxT(m)-new Date(m.cree_le)===0))E.push("date de repli");if(cxDecale(m))E.push("décalé");if(cxSolde(c)!==50100)E.push("solde "+cxSolde(c));
  cxBonForm(c,"entree");const cl=CL.on;CL.on=true;try{document.querySelector('[name="m"]').value="10";document.querySelector('[name="motif"]').value="Srv";document.querySelector('[name="tiers"]').value="Z";document.querySelector('input[name="date"]').value=__j(-1);
   [...document.querySelectorAll("button")].find(x=>/Enregistrer le bon/.test(x.textContent)).click()}finally{CL.on=cl}if(!/mode serveur/.test(__T[__T.length-1]||""))E.push("message serveur : "+__T[__T.length-1]);return E.length?E.join(" ; "):true});

 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
