/* Revue du champ « Adresse de livraison » du formulaire de commande : pas d'adresse orpheline, pas de doublon, libellé, contrôles, récapitulatif.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/commande-adresse.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";
  window.__ch=(el,v)=>{el.value=v;el.dispatchEvent(new Event("change",{bubbles:true}))};window.__in=(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))};
  window.__clic=re=>[...document.querySelectorAll("button")].find(x=>re.test(x.textContent)).click();window.__Z=()=>S.config.zones[0].nom;window.__Z2=()=>S.config.zones[1].nom;
  window.__cl=()=>S.clients.find(c=>!c.vendeur_id&&!c.divers&&c.adresses.length);
  window.__nouv=(q,rep,o)=>{o=o||{};__ch(document.getElementById("f_adr"),"__new");const f=n=>document.querySelector('[name="'+n+'"]');f("a_zone").value=o.zone||__Z();f("a_q").value=q;f("a_rep").value=rep;if(o.lib!==undefined)f("a_lib").value=o.lib;if(o.ins)f("a_ins").value=o.ins}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("AD-1","formulaire : zone obligatoire, quartier ou repère, instructions, nom de l'adresse, aide pour le livreur ; récapitulatif de l'adresse choisie (zone, quartier, repère, GPS)",()=>{__as("admin");formCmd();const E=[],cl=__cl();
  for(const n of ["a_zone","a_q","a_rep","a_ins","a_lib"])if(!document.querySelector('[name="'+n+'"]'))E.push("champ "+n);if(!/le livreur s'en sert/.test(document.getElementById("newadr").innerText))E.push("aide");
  __ch(document.getElementById("f_client"),cl.id);const inf=document.getElementById("f_adrinfo");if(inf.classList.contains("hide")||!inf.innerText.includes(cl.adresses[0].zone)||!/GPS/.test(inf.innerText))E.push("récapitulatif "+inf.innerText);
  __ch(document.getElementById("f_adr"),"__new");if(!document.getElementById("f_adrinfo").classList.contains("hide"))E.push("récapitulatif visible pour une nouvelle adresse");if(document.getElementById("newadr").classList.contains("hide"))E.push("bloc nouvelle adresse masqué");return E.length?E.join(" ; "):true});
 await t("AD-2","un enregistrement refusé n'ajoute plus d'adresse orpheline au client existant ni de client fantôme",()=>{__as("admin");formCmd();const cl=__cl(),E=[],na=cl.adresses.length,nc=S.clients.length;
  __ch(document.getElementById("f_client"),cl.id);__nouv("Zone Fantôme","Près du stade");document.querySelectorAll(".lrow").forEach(r=>r.remove());__clic(/Créer la commande/);
  if(!/au moins un produit/.test(__last()))E.push("pas de refus : "+__last());if(cl.adresses.length!==na)E.push("adresse orpheline "+cl.adresses.length);
  __ch(document.getElementById("f_client"),"__new");document.querySelector('[name="n_nom"]').value="Fantôme";document.querySelector('[name="n_tel"]').value="0909090909";document.querySelector('[name="a_q"]').value="X";document.querySelectorAll(".lrow").forEach(r=>r.remove());__clic(/Créer la commande/);
  if(S.clients.length!==nc)E.push("client fantôme");return E.length?E.join(" ; "):true});
 await t("AD-3","nouvelle adresse d'un client existant : ajoutée une seule fois à la validation, avec son nom ; sans nom = « Livraison » ; instructions conservées",()=>{__as("admin");formCmd();const cl=__cl(),E=[],na=cl.adresses.length;
  __ch(document.getElementById("f_client"),cl.id);__nouv("Zone Test A","Face au marché",{lib:"Boutique",ins:"Portail bleu"});__clic(/Créer la commande/);const c=S.commandes[0];
  if(cl.adresses.length!==na+1)return"adresses "+cl.adresses.length+" au lieu de "+(na+1)+" "+__last();const a=cl.adresses[cl.adresses.length-1];if(a.libelle!=="Boutique"||a.instructions!=="Portail bleu"||c.adr.id!==a.id)E.push("adresse "+JSON.stringify(a));
  formCmd();__ch(document.getElementById("f_client"),cl.id);__nouv("Autre quartier","Station",{lib:""});__clic(/Créer la commande/);const b2=cl.adresses[cl.adresses.length-1];if(b2.libelle!=="Livraison")E.push("libellé par défaut "+b2.libelle);return E.length?E.join(" ; "):true});
 await t("AD-4","même adresse saisie deux fois (casse, accents, espaces) : réutilisée, jamais dupliquée",()=>{__as("admin");const cl=__cl(),E=[];formCmd();__ch(document.getElementById("f_client"),cl.id);__nouv("Zone Test A","Face au marché");__clic(/Créer la commande/);const n1=cl.adresses.length;
  formCmd();__ch(document.getElementById("f_client"),cl.id);__nouv("  zone test a ","FACE AU MARCHÉ");__clic(/Créer la commande/);if(cl.adresses.length!==n1)E.push("doublon "+cl.adresses.length+"/"+n1);
  const a=cl.adresses.find(x=>x.quartier==="Zone Test A"),c=S.commandes[0];if(!a||c.adr.id!==a.id)E.push("adresse non réutilisée");return E.length?E.join(" ; "):true});
 await t("AD-5","contrôles : ni quartier ni repère refusé ; zone vide refusée ; rien n'est créé",()=>{__as("admin");formCmd();const cl=__cl(),E=[],n=S.commandes.length;__ch(document.getElementById("f_client"),cl.id);__nouv("","");__clic(/Créer la commande/);
  if(!/le livreur en a besoin/.test(__last()))E.push("quartier/repère : "+__last());document.querySelector('[name="a_q"]').value="Q";const zs=document.querySelector('[name="a_zone"]');zs.innerHTML='<option value=""></option>';zs.value="";__clic(/Créer la commande/);
  if(!/zone de livraison/.test(__last()))E.push("zone : "+__last());if(S.commandes.length!==n)E.push("commande créée");return E.length?E.join(" ; "):true});
 await t("AD-6","client divers : adresse obligatoire, enregistrée sur le client propre à la commande avec son nom",()=>{__as("admin");formCmd();const E=[];__ch(document.getElementById("f_client"),"__div");document.querySelector('[name="a_zone"]').value=__Z2();document.querySelector('[name="a_q"]').value="Abobo";document.querySelector('[name="a_rep"]').value="Gare";document.querySelector('[name="a_lib"]').value="Chez la tante";__clic(/Créer la commande/);
  const c=S.commandes[0],cl=cli(c.client_id);if(!cl.divers||cl.adresses.length!==1||cl.adresses[0].libelle!=="Chez la tante"||c.adr.zone!==__Z2())E.push("client divers "+JSON.stringify(cl.adresses));return E.length?E.join(" ; "):true});
 await t("AD-7","modification : adresse actuelle préremplie avec récapitulatif ; changer pour une nouvelle adresse l'ajoute au client après validation et la trace",()=>{__as("admin");const c=S.commandes.find(x=>!x.vendeur_id&&cli(x.client_id)&&!cli(x.client_id).divers&&x.statut==="confirmee"),E=[];if(!c)return"aucune commande";const cl=cli(c.client_id),na=cl.adresses.length;
  formCmd(c);if(document.getElementById("f_adr").value!==c.adr.id)E.push("adresse non préremplie "+document.getElementById("f_adr").value);if(document.getElementById("f_adrinfo").classList.contains("hide"))E.push("récapitulatif");
  __nouv("Cocody Angré","Cité des arts",{lib:"Livraison 2"});__clic(/Enregistrer les modifications/);if(c.adr.quartier!=="Cocody Angré"||cl.adresses.length!==na+1)E.push("changement "+c.adr.quartier+"/"+cl.adresses.length+" "+__last());if(!/adresse/.test(c.hist[c.hist.length-1].note))E.push("historique");return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
