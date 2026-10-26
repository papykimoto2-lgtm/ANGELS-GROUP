/* Nouvelle commande (module Livraison) : commande d'ANGEL'S rattachée ou non à un vendeur partenaire.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/commande-vendeur.js */
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
  window.__ch=(el,v)=>{el.value=v;el.dispatchEvent(new Event("change",{bubbles:true}))};window.__in=(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))};
  window.__ok=()=>[...document.querySelectorAll("#mf button, .modal button, button")].find(x=>/Créer la commande/.test(x.textContent)).click();
  window.__V=()=>S.vendeurs[0]});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("CV-1","le formulaire propose l'origine : vente propre par défaut, ou un vendeur partenaire ; produits du catalogue",()=>{__as("admin");formCmd();const s=document.getElementById("f_vend"),E=[];if(!s)return"sélecteur absent";if(s.value!=="")E.push("défaut "+s.value);
  if(![...s.options].some(o=>o.value===__V().id))E.push("vendeur absent");if(!document.querySelector(".lrow .l_prod"))E.push("catalogue absent");if(document.getElementById("f_payrow").classList.contains("hide"))E.push("paiement masqué");
  const own=[...document.getElementById("f_client").options].filter(o=>o.value&&o.value!=="__new"&&o.value!=="__div").length;if(own!==S.clients.filter(c=>!c.vendeur_id&&!c.divers).length)E.push("clients "+own);return E.length?E.join(" ; "):true});
 await t("CV-2","choisir un vendeur : clients du vendeur seulement, lignes libres (désignation), paiement au vendeur à la place du paiement ANGEL'S",()=>{const E=[];const v=__V();const cl=S.clients.find(c=>c.vendeur_id===v.id);__ch(document.getElementById("f_vend"),v.id);
  const opts=[...document.getElementById("f_client").options].filter(o=>o.value&&o.value!=="__new"&&o.value!=="__div").map(o=>o.value);if(opts.some(id=>S.clients.find(c=>c.id===id).vendeur_id!==v.id))E.push("clients d'ANGEL'S visibles");if(cl&&!opts.includes(cl.id))E.push("client du vendeur absent");
  if(!document.querySelector(".lrow .l_desig")||document.querySelector(".lrow .l_prod"))E.push("lignes");if(!document.getElementById("f_payrow").classList.contains("hide"))E.push("paiement ANGEL'S visible");if(document.getElementById("f_vpayrow").classList.contains("hide"))E.push("paiement vendeur masqué");
  if(!/commission/.test(document.getElementById("f_vhint").textContent))E.push("aide");__ch(document.getElementById("f_vend"),"");if(!document.querySelector(".lrow .l_prod")||document.getElementById("f_vpayrow").classList.contains("hide")===false)E.push("retour vente propre");return E.length?E.join(" ; "):true});
 await t("CV-3","commande d'ANGEL'S sans vendeur : aucun rattachement, produit du catalogue, sortie de stock à la confirmation, client d'ANGEL'S",()=>{__as("admin");formCmd();const E=[],cl=S.clients.find(c=>!c.vendeur_id);__ch(document.getElementById("f_client"),cl.id);
  const r=document.querySelector(".lrow"),pr=prod(r.querySelector(".l_prod").value),st0=pr.stock;__in(r.querySelector(".l_qte"),"2");__ok();const c=S.commandes[0];
  if(!c||c.client_id!==cl.id)return"non créée "+(__T[__T.length-1]||"");if(c.vendeur_id)E.push("rattachée à tort");if(c.statut!=="confirmee")E.push("statut "+c.statut);if(!c.lignes[0].produit_id)E.push("ligne libre");
  setStatut(c,"preparation");marquerPrete(c);if(prod(c.lignes[0].produit_id).stock>=st0)E.push("stock non sorti "+prod(c.lignes[0].produit_id).stock+"/"+st0);return E.length?E.join(" ; "):true});
 await t("CV-4","commande rattachée au vendeur, paiement partiel chez le vendeur : vendeur_id, client du vendeur, pas de stock, solde livreur, PAS de collecte (saisie par l'agence), règlement vendeur",()=>{__as("admin");formCmd();const E=[],v=__V(),stock0=JSON.stringify(S.stock_mvts.length);
  __ch(document.getElementById("f_vend"),v.id);__ch(document.getElementById("f_client"),"__new");document.querySelector('[name="n_nom"]').value="Mme Test Vendeur";document.querySelector('[name="n_tel"]').value="0505050505";document.querySelector('[name="a_q"]').value="Riviera";
  const r=document.querySelector(".lrow");r.querySelector(".l_desig").value="Robe wax";__in(r.querySelector(".l_qte"),"2");__in(r.querySelector(".l_pu"),"10000");__ch(document.getElementById("f_vpay"),"partiel");__in(document.getElementById("f_vmontant"),"6000");__in(document.getElementById("f_frais"),"1500");
  if(!/15500/.test(document.getElementById("t_solde").textContent.replace(/\s/g,"")))E.push("solde affiché "+document.getElementById("t_solde").textContent);
  __ok();const c=S.commandes[0];if(!c||c.vendeur_id!==v.id)return"commande non rattachée "+(__T[__T.length-1]||"");
  if(c.paye_vendeur!==6000||c.vendeur_encaisse)E.push("paye_vendeur "+c.paye_vendeur);if(c.lignes[0].produit_id!==null||c.lignes[0].desig!=="Robe wax")E.push("ligne");const cl=S.clients.find(x=>x.id===c.client_id);if(!cl||cl.vendeur_id!==v.id)E.push("client");
  if(c.statut!=="confirmee")E.push("statut "+c.statut);if(S.stock_mvts.length!==+stock0)E.push("stock touché");if(soldeCmd(c)!==c.total-6000||c.total!==21500)E.push("solde "+soldeCmd(c)+"/"+c.total);if(aCollecter(v.id).some(x=>x.id===c.id))E.push("commande saisie par l'agence : ne doit PAS être à collecter chez le vendeur");
  if(!/rattachée/.test(__T[__T.length-1]||""))E.push("message");return E.length?E.join(" ; "):true});
 await t("CV-5","commande rattachée, articles payés en totalité chez le vendeur : vendeur_encaisse, le livreur n'encaisse que la livraison",()=>{__as("admin");formCmd();const E=[],v=__V();__ch(document.getElementById("f_vend"),v.id);const cl=S.clients.find(c=>c.vendeur_id===v.id);
  __ch(document.getElementById("f_client"),cl.id);const r=document.querySelector(".lrow");r.querySelector(".l_desig").value="Sac";__in(r.querySelector(".l_pu"),"8000");__ch(document.getElementById("f_vpay"),"paye");__in(document.getElementById("f_frais"),"2000");__ok();
  const c=S.commandes[0];if(!c||c.vendeur_id!==v.id||c.client_id!==cl.id)return"non créée "+(__T[__T.length-1]||"");if(!c.vendeur_encaisse||c.paye_vendeur!==8000)E.push("paiement "+c.paye_vendeur);if(soldeCmd(c)!==2000)E.push("solde "+soldeCmd(c));return E.length?E.join(" ; "):true});
 await t("CV-6","contrôles : aucun article du vendeur, ou paiement partiel sans montant, ou montant supérieur au prix : refus et rien créé",()=>{__as("admin");const E=[],v=__V(),n0=S.commandes.length;
  formCmd();__ch(document.getElementById("f_vend"),v.id);__ch(document.getElementById("f_client"),S.clients.find(c=>c.vendeur_id===v.id).id);__ok();if(!/article du vendeur/.test(__T[__T.length-1]||""))E.push("sans article : "+__T[__T.length-1]);
  const r=document.querySelector(".lrow");r.querySelector(".l_desig").value="Pagne";__in(r.querySelector(".l_pu"),"5000");__ch(document.getElementById("f_vpay"),"partiel");__ok();if(!/Indiquez le montant/.test(__T[__T.length-1]||""))E.push("sans montant : "+__T[__T.length-1]);
  __in(document.getElementById("f_vmontant"),"9000");__ok();if(!/compris entre/.test(__T[__T.length-1]||""))E.push("montant trop grand : "+__T[__T.length-1]);if(S.commandes.length!==n0)E.push("commande créée à tort");return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
