/* Bordereau de commandes imprimable par date ou par période.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/bordereau-commandes.js */
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
  window.__mk=(n,o)=>{o=o||{};__as("admin");const cl=o.cl||S.clients.find(c=>!c.vendeur_id&&!c.divers&&c.adresses.length);const pr=S.produits.find(x=>x.actif&&x.stock>=50);
   const c=creerCmd({client_id:cl.id,adr:Object.assign({},cl.adresses[0]),lignes:o.lignes||[{produit_id:pr.id,qte:2,pu:pr.prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",priorite:o.urg?"urgente":"normale",canal:"T",obs:"",confirmer:true,date:__j(n),vendeur_id:o.vendeur||null});return c}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("BD-1","écran Commandes : barre « Bordereau » (période, origine, regroupement, Imprimer, CSV) pour le bureau, mêmes filtres que le tableau (pas de période propre) ; absente pour un livreur",()=>{__as("admin");ui.cp=undefined;ui.co="";ui.fs="";ui.q="";const h=VIEWS.commandes(),E=[];
  if(!/Bordereau de commandes/.test(h)||!/bordPrint/.test(h)||!/bordCsv/.test(h)||!/data-f="cp"/.test(h)||/data-f="bp"/.test(h)||/data-f="bo"/.test(h))E.push("barre");
  __as("caissier");if(!/bordPrint/.test(VIEWS.commandes()))E.push("caissier");__as("livreur");if(/bordPrint/.test(VIEWS.commandes()))E.push("livreur");return E.length?E.join(" ; "):true});
 await t("BD-2","bordereau d'une date : seules les commandes de cette date (date de la commande, antériorité comprise), annulées exclues, totaux exacts, sans téléphone",()=>{const E=[];const a=__mk(-3),b2=__mk(-3,{urg:true}),c=__mk(-1),d=__mk(0);const x=__mk(-3);__as("admin");annuler(x,"test");
  ui.cp="c";ui.cdu=__j(-3);ui.cau=__j(-3);ui.fs="";ui.co="";ui.q="";const L=bordRows();const ids=L.map(o=>o.id);
  if(!ids.includes(a.id)||!ids.includes(b2.id)||ids.includes(c.id)||ids.includes(d.id)||ids.includes(x.id))E.push("sélection "+L.length);
  const out=bordHtml();if(!/Bordereau de commandes/.test(out.html)||!out.html.includes(a.numero)||!out.html.includes("URGENT"))E.push("contenu");
  const tot=a.total+b2.total;if(!out.html.includes(fcfa(tot)))E.push("total "+fcfa(tot));if(/\b0[157]\d{8}\b|\+225/.test(out.html))E.push("téléphone imprimé");
  if(!/Du jour|TOTAL/.test(out.html))E.push("totaux");return E.length?E.join(" ; "):true});
 await t("BD-3","bordereau d'une période : regroupé par jour avec total du jour et total de la période ; liste unique possible",()=>{const E=[];ui.cp="c";ui.cdu=__j(-3);ui.cau=__j(0);ui.bg="1";const g=bordHtml().html,n=bordRows();
  if(!/Total du jour/.test(g)||!/TOTAL DE LA PÉRIODE/.test(g))E.push("regroupement");const jours=new Set(n.map(c=>cxJour(new Date(c.date)))).size;if((g.match(/Total du jour/g)||[]).length!==jours)E.push("jours "+(g.match(/Total du jour/g)||[]).length+"/"+jours);
  ui.bg="0";const u=bordHtml().html;if(/Total du jour/.test(u)||!/TOTAL —/.test(u))E.push("liste unique");return E.length?E.join(" ; "):true});
 await t("BD-4","filtres : statut, origine (vente propre / vendeur), recherche ; vendeur partenaire affiché dans la colonne Origine",()=>{const E=[],v=S.vendeurs[0];const vc=__mk(0,{vendeur:v.id,lignes:[{produit_id:null,desig:"Robe wax",qte:1,pu:9000}],cl:(()=>{const ad={id:uid("a"),libelle:"L",zone:S.config.zones[0].nom,quartier:"Q",repere:"R",gps:null,instructions:"",defaut:true};const cl={id:uid("cl"),nom:"Cliente Vendeur",tel:"",tel2:"",adresses:[ad],note:"",vendeur_id:v.id};S.clients.push(cl);return cl})()});
  ui.cp="0";ui.co=v.id;ui.fs="";ui.q="";let L=bordRows();if(!L.length||!L.every(c=>c.vendeur_id===v.id)||!L.some(c=>c.id===vc.id))E.push("vendeur "+L.length);if(!bordHtml().html.includes(v.nom))E.push("nom vendeur");
  ui.co="own";L=bordRows();if(L.some(c=>c.vendeur_id)||!L.length)E.push("vente propre");ui.co="";ui.fs="annulee";L=bordRows();if(!L.every(c=>c.statut==="annulee"))E.push("statut annulée");
  ui.fs="confirmee";L=bordRows();if(!L.every(c=>c.statut==="confirmee"))E.push("statut");ui.fs="";ui.q="Cliente Vendeur";L=bordRows();if(L.length!==1)E.push("recherche "+L.length);ui.q="";return E.length?E.join(" ; "):true});
 await t("BD-5","impression et CSV : l'action ouvre l'aperçu imprimable (paysage) et le CSV contient une ligne par commande avec la date",()=>{const E=[];ui.cp="0";ui.co="";ui.fs="";ui.q="";__as("admin");const n=bordRows().length;
  let h="",opt=null;const old=window.rapport;window.rapport=(t,x,o)=>{h=x;opt=o};try{ACT.bordPrint()}finally{window.rapport=old}if(!h.includes("Vérifié par"))E.push("aperçu");
  let csv=null;const od=window.csvDown;window.csvDown=(nm,hd,rows)=>{csv={nm,hd,rows}};try{ACT.bordCsv()}finally{window.csvDown=od}
  if(!csv||csv.rows.length!==n||csv.hd[0]!=="Date"||!csv.hd.includes("Frais de livraison")||csv.hd.length!==csv.rows[0].length||!/^bordereau_commandes_/.test(csv.nm)||csv.rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r[0])))E.push("csv "+JSON.stringify(csv&&csv.nm));
  __as("livreur");let h2="";window.rapport=(t,x)=>{h2=x};try{ACT.bordPrint()}finally{window.rapport=old}if(h2)E.push("livreur a imprimé");return E.length?E.join(" ; "):true});
 await t("BD-6","frais de livraison : colonne par commande, total du jour et de la période, récapitulatif par zone ; CSV avec zone et frais",()=>{const E=[];__as("admin");ui.cp="c";ui.cdu=__j(-3);ui.cau=__j(0);ui.bg="1";ui.co="";ui.fs="";ui.q="";const out=bordHtml(),L=bordRows();
  if(!/Livraison<\/th>/.test(out.html)||!/Montant des articles/.test(out.html)||!/Frais de livraison<\/div>/.test(out.html))E.push("colonnes");const fr=L.reduce((a,c)=>a+(+c.frais||0),0);if(!(fr>0))E.push("pas de frais de test");if(!out.html.includes(fcfa(fr)))E.push("total des frais "+fcfa(fr));
  if(!/Frais de livraison par zone/.test(out.html))E.push("récapitulatif zones");const zones=[...new Set(L.map(c=>c.adr.zone))];for(const z of zones)if(!out.html.includes("<td>"+z+"</td>"))E.push("zone "+z);
  const un=L[0],bl=bordLigne(un);if(bl.frais!==(+un.frais||0)||bl.prod!==(un.montant_produits||0)||bl.zone!==un.adr.zone)E.push("ligne");
  let csv=null;const od=window.csvDown;window.csvDown=(nm,hd,rows)=>{csv={hd,rows}};try{ACT.bordCsv()}finally{window.csvDown=od}const iF=csv.hd.indexOf("Frais de livraison"),iZ=csv.hd.indexOf("Zone");if(iF<0||iZ<0||csv.rows.reduce((a,r)=>a+(+r[iF]||0),0)!==fr)E.push("csv frais");return E.length?E.join(" ; "):true});
 await t("BD-7","orientation : portrait par défaut (suit la boîte d'impression du navigateur), choix « paysage » transmis à l'impression, bouton d'impression marqué paysage",()=>{const E=[];__as("admin");ui.cp="0";ui.bor=undefined;let opt=null,h="";const old=window.rapport;window.rapport=(t,x,o)=>{h=x;opt=o};try{ACT.bordPrint()}finally{window.rapport=old}
  if(!opt||opt.paysage!==false)E.push("portrait par défaut "+JSON.stringify(opt));const bar=VIEWS.commandes();if(!/data-f="bor"/.test(bar)||!/Page en paysage/.test(bar)||!/Page en portrait/.test(bar))E.push("sélecteur");
  ui.bor="l";window.rapport=(t,x,o)=>{opt=o};try{ACT.bordPrint()}finally{window.rapport=old}if(opt.paysage!==true)E.push("paysage "+JSON.stringify(opt));ui.bor=undefined;
  rapport("t","<p>x</p>",{paysage:true});const b2=document.querySelector('[data-act="printDoc"]');if(!b2||b2.dataset.paysage!=="1")E.push("bouton paysage");let o2=null;const oo=ANGELS_PRINT.depuisFrame;ANGELS_PRINT.depuisFrame=(f,o)=>{o2=o;return true};try{ACT.printDoc("x",b2)}finally{ANGELS_PRINT.depuisFrame=oo}
  if(!o2||o2.paysage!==true)E.push("orientation non transmise au moteur d'impression "+JSON.stringify(o2&&o2.paysage));return E.length?E.join(" ; "):true});
 await t("BD-8","impression optimisée : pas de pied « fixe » qui chevauche les lignes (boîte de pied de page avec n° de page), titre non dupliqué, montants alignés à droite sur une ligne, en-tête du tableau répété, aperçu à la largeur réelle de la page, mise en page compacte et résumé",async()=>{const E=[];__as("admin");ui.cp="0";ui.bor="p";ui.bg="1";ACT.bordPrint();await new Promise(r=>setTimeout(r,700));
  const fr=document.querySelector("#docf");await ANGELS_PRINT.depuisFrame(fr,{division:"distribution",titre:"Bordereau de commandes",paysage:false,emetteur:"T",fallback:{nom:"ANGEL'S GROUP",siege:"Abidjan"}});await new Promise(r=>setTimeout(r,1200));
  const f=document.getElementById("ap-f"),h=f.srcdoc;if(!h)return"aperçu absent";if(/position:fixed/.test(h))E.push("pied fixe");if(!/@bottom-center/.test(h)||!/counter\(page\)/.test(h)||!/counter\(pages\)/.test(h))E.push("pied de page numéroté");
  if((h.match(/<h1/g)||[]).length!==1)E.push("titre dupliqué ("+(h.match(/<h1/g)||[]).length+")");if(!/td\.n,th\.n\{text-align:right;white-space:nowrap\}/.test(h))E.push("montants");if(!/<thead>/.test(h)||!/thead\{display:table-header-group\}/.test(h))E.push("en-tête répété");
  if(!/class="kpi"/.test(h)||!/Montant des articles/.test(h))E.push("résumé");if(f.style.width!=="794px")E.push("largeur portrait "+f.style.width);
  const sel=document.getElementById("ap-o");sel.value="l";sel.dispatchEvent(new Event("change"));await new Promise(r=>setTimeout(r,900));if(f.style.width!=="1123px")E.push("largeur paysage "+f.style.width);if(!/A4 landscape/.test(f.srcdoc))E.push("page paysage");if(!/Paysage : choisissez aussi/.test(document.getElementById("ap-i").textContent))E.push("conseil d'orientation");
  ANGELS_PRINT.fermer();return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
