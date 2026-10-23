/* Client divers + modification des commandes (staff et vendeurs partenaires), commandes déposées par les vendeurs.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/commande-modif.js */
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
  window.__clic=re=>[...document.querySelectorAll("button")].find(x=>re.test(x.textContent)).click();
  window.__V=()=>S.vendeurs[0];window.__Z=()=>S.config.zones[0].nom;
  window.__prod=()=>S.produits.find(x=>x.actif&&x.stock>=50);
  /* commande d'ANGEL'S pour un client divers, créée à la main */
  window.__div=(o)=>{o=o||{};const ad={id:uid("a"),libelle:"Livraison",zone:__Z(),quartier:o.q||"Cocody",repere:"Pharmacie",gps:null,instructions:"",defaut:true};
   const cl={id:uid("cl"),nom:"Client divers",tel:"",tel2:"",adresses:[ad],note:"",divers:true};if(o.vendeur)cl.vendeur_id=o.vendeur;S.clients.push(cl);
   __as("admin");return creerCmd({client_id:cl.id,adr:Object.assign({},ad),lignes:o.lignes||[{produit_id:__prod().id,qte:2,pu:__prod().prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",obs:"",confirmer:o.confirmer!==false,vendeur_id:o.vendeur||null,paye_vendeur:0})}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("CM-1","« Client divers » à la création : ni nom ni téléphone requis, adresse obligatoire, client masqué des listes, aucun message au client sans téléphone",()=>{__as("admin");const E=[];formCmd();const n0=S.notifs.length,k0=S.clients.length;
  if(![...document.getElementById("f_client").options].some(o=>o.value==="__div"))return"option absente";
  __ch(document.getElementById("f_client"),"__div");if(document.getElementById("newcl").classList.contains("hide")||document.getElementById("newadr").classList.contains("hide"))E.push("blocs masqués");
  __clic(/Créer la commande/);if(!/quartier ou un point de repère/.test(__last()))E.push("adresse non exigée : "+__last());
  document.querySelector('[name="a_q"]').value="Marcory";document.querySelector('[name="a_rep"]').value="Face au marché";__clic(/Créer la commande/);const c=S.commandes[0];
  if(!c||c.adr.quartier!=="Marcory")return"non créée "+__last();const cl=cli(c.client_id);if(!cl.divers||cl.nom!=="Client divers"||cl.tel!=="")E.push("client "+JSON.stringify(cl).slice(0,80));
  if(clientsDe("").some(x=>x.id===cl.id))E.push("visible dans la liste");if(S.notifs.length!==n0)E.push("message envoyé sans téléphone");if(c.statut!=="confirmee")E.push("statut "+c.statut);return E.length?E.join(" ; "):true});
 await t("CM-2","client divers avec un nom provisoire facultatif ; le détail ne plante pas sans téléphone",()=>{__as("admin");formCmd();__ch(document.getElementById("f_client"),"__div");document.querySelector('[name="n_nom"]').value="Sac rouge Mme Koné";document.querySelector('[name="a_q"]').value="Yopougon";document.querySelector('[name="a_rep"]').value="Station";__clic(/Créer la commande/);
  const c=S.commandes[0],cl=cli(c.client_id);const E=[];if(cl.nom!=="Sac rouge Mme Koné"||!cl.divers)E.push("nom "+cl.nom);cmdDetail(c.id);if(!/Modifier la commande/.test(document.body.textContent))E.push("bouton Modifier absent")   /* sous « Plus d'actions » (repliée) : on lit le contenu, pas le texte visible */;if(!/non renseigné/.test(document.body.innerText))E.push("mention téléphone");return E.length?E.join(" ; "):true});
 await t("CM-3","qui peut modifier : staff jusqu'à « prête » (tout) puis client/adresse/observations pendant la livraison ; vendeur seulement sa commande à confirmer ; rien après livraison",()=>{const E=[],c=__div();const set=st=>{c.statut=st};
  __as("commercial");for(const [st,exp] of [["brouillon","full"],["attente","full"],["confirmee","full"],["preparation","full"],["prete","full"],["affectee","leger"],["en_cours","leger"],["livree",null],["annulee",null],["echouee",null]]){set(st);if(cmdNiveau(c)!==exp)E.push(st+":"+cmdNiveau(c))}
  __as("caissier");set("confirmee");if(cmdNiveau(c)!==null)E.push("caissier");
  const v=__V(),vu=S.users.find(u=>u.id===v.user_id);ME=vu;const o=creerCmdVendeur(v,{nom:"",tel:"",zone:__Z(),quartier:"Plateau",repere:"Banque",lignes:[{desig:"Robe",qte:1,pu:5000}],pay:"livraison",obs:""});
  if(cmdNiveau(o)!=="full")E.push("vendeur attente "+cmdNiveau(o));o.statut="confirmee";if(cmdNiveau(o)!==null)E.push("vendeur confirmée");o.statut="attente";if(cmdNiveau(c)!==null)E.push("vendeur sur commande d'ANGEL'S");
  const cl=CL.on;CL.on=true;try{__as("admin");if(cmdNiveau(c)!==null)E.push("mode serveur")}finally{CL.on=cl}return E.length?E.join(" ; "):true});
 await t("CM-4","modifier via l'écran : champs préremplis (client divers, lignes, frais conservés), identification du vrai client, historique tracé, ancien « client divers » supprimé",()=>{const c=__div(),E=[],ancien=c.client_id,real=S.clients.find(x=>!x.divers&&!x.vendeur_id&&x.adresses.length);c.frais=2500;
  __as("commercial");formCmd(c);if(!/Modifier la commande/.test(document.body.innerText))E.push("titre");if(document.getElementById("f_client").value!==ancien)E.push("client non prérempli");if(+document.getElementById("f_frais").value!==2500)E.push("frais écrasés "+document.getElementById("f_frais").value);
  const r=document.querySelector(".lrow");if(!r||+r.querySelector(".l_qte").value!==2)E.push("ligne non préremplie");if(document.getElementById("f_adr").value!==c.adr.id)E.push("adresse non préremplie");
  __ch(document.getElementById("f_client"),real.id);__in(r.querySelector(".l_qte"),"3");__clic(/Enregistrer les modifications/);
  if(c.client_id!==real.id)E.push("client non changé "+__last());if(c.lignes[0].qte!==3)E.push("quantité");if(S.clients.some(x=>x.id===ancien))E.push("client divers conservé");
  const h=c.hist[c.hist.length-1];if(!/Modification : client : Client divers → /.test(h.note)||!/articles/.test(h.note))E.push("historique "+h.note);if(!S.audit.some(a=>a.action==="Modification commande"&&a.detail.includes(c.numero)))E.push("audit");
  if(c.frais!==(zone(c.adr.zone)||{}).frais)E.push("frais selon la nouvelle zone "+c.frais);if(c.total!==3*c.lignes[0].pu+c.frais)E.push("total "+c.total);return E.length?E.join(" ; "):true});
 await t("CM-5","stock : commande prête (stock sorti), changer la quantité ajuste le stock ; stock insuffisant refusé sans rien changer",()=>{const c=__div(),E=[],pr=__prod();__as("admin");setStatut(c,"preparation");marquerPrete(c);const s0=pr.stock;
  modifierCmd(c,{lignes:[{produit_id:pr.id,qte:5,pu:pr.prix}]});if(pr.stock!==s0-3)E.push("stock "+pr.stock+" au lieu de "+(s0-3));
  const avant=JSON.stringify(c.lignes),mv=S.stock_mvts.length;let e="";try{modifierCmd(c,{lignes:[{produit_id:pr.id,qte:pr.stock+10,pu:pr.prix}]})}catch(x){e=x.message}
  if(!/Stock insuffisant/.test(e))E.push("pas de refus : "+e);if(JSON.stringify(c.lignes)!==avant||S.stock_mvts.length!==mv)E.push("état modifié malgré le refus");
  modifierCmd(c,{lignes:[{produit_id:pr.id,qte:1,pu:pr.prix}]});if(pr.stock!==s0+1)E.push("retour stock "+pr.stock);return E.length?E.join(" ; "):true});
 await t("CM-6","livraison en cours : seuls client, adresse et observations (lignes, frais masqués et ignorés) ; changement d'adresse tracé",()=>{const c=__div({confirmer:true}),E=[];c.statut="en_cours";const lg0=JSON.stringify(c.lignes),fr0=c.frais;__as("admin");formCmd(c);
  if(!document.getElementById("f_lourd").classList.contains("hide"))E.push("bloc articles visible");__ch(document.getElementById("f_adr"),"__new");document.querySelector('[name="a_q"]').value="Treichville";document.querySelector('[name="a_rep"]').value="Près du pont";document.querySelector('[name="obs"]').value="Colis sans nom : sac bleu";
  __clic(/Enregistrer les modifications/);if(c.adr.quartier!=="Treichville")E.push("adresse "+c.adr.quartier+" / "+__last());if(c.obs!=="Colis sans nom : sac bleu")E.push("obs");if(JSON.stringify(c.lignes)!==lg0||c.frais!==fr0)E.push("lignes/frais touchés");
  if(!/adresse/.test(c.hist[c.hist.length-1].note))E.push("historique");return E.length?E.join(" ; "):true});
 await t("CM-7","garde-fous : total inférieur au déjà payé refusé ; commande livrée ou annulée non modifiable ; aucun changement = aucune trace",()=>{const c=__div(),E=[],pr=__prod();__as("admin");S.fonds.push({id:uid("f"),type:"acompte",commande_id:c.id,montant:c.total,mode:"Espèces",ts:now(),par:"t"});
  let e="";try{modifierCmd(c,{lignes:[{produit_id:pr.id,qte:1,pu:1}],frais:0})}catch(x){e=x.message}if(!/déjà payé/.test(e))E.push("total < payé accepté : "+e);
  const n=c.hist.length;modifierCmd(c,{client_id:c.client_id,adr:c.adr,obs:c.obs||""});if(c.hist.length!==n)E.push("trace sans changement");
  c.statut="livree";e="";try{modifierCmd(c,{obs:"x"})}catch(x){e=x.message}if(!/ne peut plus être modifiée/.test(e))E.push("livrée modifiable");return E.length?E.join(" ; "):true});
 await t("CM-8","commande déposée par un vendeur sans nom ni téléphone : client divers du vendeur, à confirmer ; le vendeur la corrige (frais selon la zone) ; le bureau la complète puis la confirme",()=>{const E=[],v=__V(),vu=S.users.find(u=>u.id===v.user_id);ME=vu;
  const o=creerCmdVendeur(v,{nom:"",tel:"",zone:__Z(),quartier:"Plateau",repere:"Banque",lignes:[{desig:"Robe",qte:1,pu:5000}],pay:"livraison",obs:""});const cl=cli(o.client_id);
  if(o.statut!=="attente"||!cl.divers||cl.vendeur_id!==v.id||cl.nom!=="Client divers")E.push("dépôt "+o.statut+JSON.stringify(cl).slice(0,70));
  formCmd(o);if(document.getElementById("f_vend")&&document.getElementById("f_vend").tagName==="SELECT")E.push("vendeur peut changer d'origine");if(!document.querySelector(".lrow .l_desig"))E.push("lignes libres");
  const r=document.querySelector(".lrow");__in(r.querySelector(".l_qte"),"2");document.querySelector('[name="obs"]').value="Pour Mme Diallo";__clic(/Enregistrer les modifications/);
  if(o.lignes[0].qte!==2||o.obs!=="Pour Mme Diallo")E.push("modif vendeur "+__last());if(o.frais!==(zone(__Z())||{}).frais)E.push("frais "+o.frais);
  __as("commercial");formCmd(o);__ch(document.getElementById("f_client"),"__new");document.querySelector('[name="n_nom"]').value="Mme Diallo";document.querySelector('[name="n_tel"]').value="0707070707";document.querySelector('[name="a_q"]').value="Plateau";document.querySelector('[name="a_rep"]').value="Banque";
  __clic(/Enregistrer les modifications/);const cl2=cli(o.client_id);if(cl2.nom!=="Mme Diallo"||cl2.vendeur_id!==v.id||cl2.divers)E.push("client réel "+JSON.stringify(cl2).slice(0,80));
  if(!setStatut(o,"confirmee","ok")||o.statut!=="confirmee")E.push("confirmation");return E.length?E.join(" ; "):true});
 await t("CM-9","changer l'origine (ANGEL'S ↔ vendeur partenaire) : permis à confirmer, refusé dès qu'une collecte est planifiée ou qu'un paiement existe",()=>{const c=__div(),E=[],v=__V();__as("admin");c.statut="attente";
  modifierCmd(c,{vendeur_id:v.id,lignes:[{produit_id:null,desig:"Article vendeur",qte:1,pu:4000}]});if(c.vendeur_id!==v.id||c.lignes[0].produit_id!==null)E.push("rattachement");
  modifierCmd(c,{vendeur_id:null,lignes:[{produit_id:__prod().id,qte:1,pu:__prod().prix}]});if(c.vendeur_id)E.push("détachement");
  S.fonds.push({id:uid("f"),type:"acompte",commande_id:c.id,montant:100,mode:"Espèces",ts:now(),par:"t"});let e="";try{modifierCmd(c,{vendeur_id:v.id,lignes:[{produit_id:null,desig:"X",qte:1,pu:4000}]})}catch(x){e=x.message}if(!/ne peut plus être changé/.test(e))E.push("changement malgré paiement : "+e);return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
