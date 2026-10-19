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

 await t("BD-1","écran Commandes : barre « Bordereau » (période, origine, regroupement, Imprimer, CSV) pour le bureau, période « Aujourd'hui » par défaut ; absente pour un livreur",()=>{__as("admin");ui.bp=undefined;ui.bo="";ui.fs="";ui.q="";const h=VIEWS.commandes(),E=[];
  if(!/Bordereau de commandes/.test(h)||!/bordPrint/.test(h)||!/bordCsv/.test(h)||!/data-f="bp"/.test(h))E.push("barre");if(perRange("b").k!=="0")E.push("période par défaut "+perRange("b").k);
  __as("caissier");if(!/bordPrint/.test(VIEWS.commandes()))E.push("caissier");__as("livreur");if(/bordPrint/.test(VIEWS.commandes()))E.push("livreur");return E.length?E.join(" ; "):true});
 await t("BD-2","bordereau d'une date : seules les commandes de cette date (date de la commande, antériorité comprise), annulées exclues, totaux exacts, sans téléphone",()=>{const E=[];const a=__mk(-3),b2=__mk(-3,{urg:true}),c=__mk(-1),d=__mk(0);const x=__mk(-3);__as("admin");annuler(x,"test");
  ui.bp="c";ui.bdu=__j(-3);ui.bau=__j(-3);ui.fs="";ui.bo="";ui.q="";const L=bordRows();const ids=L.map(o=>o.id);
  if(!ids.includes(a.id)||!ids.includes(b2.id)||ids.includes(c.id)||ids.includes(d.id)||ids.includes(x.id))E.push("sélection "+L.length);
  const out=bordHtml();if(!/Bordereau de commandes/.test(out.html)||!out.html.includes(a.numero)||!out.html.includes("URGENT"))E.push("contenu");
  const tot=a.total+b2.total;if(!out.html.includes(fcfa(tot)))E.push("total "+fcfa(tot));if(/\b0[157]\d{8}\b|\+225/.test(out.html))E.push("téléphone imprimé");
  if(!/Du jour|TOTAL/.test(out.html))E.push("totaux");return E.length?E.join(" ; "):true});
 await t("BD-3","bordereau d'une période : regroupé par jour avec total du jour et total de la période ; liste unique possible",()=>{const E=[];ui.bp="c";ui.bdu=__j(-3);ui.bau=__j(0);ui.bg="1";const g=bordHtml().html,n=bordRows();
  if(!/Total du jour/.test(g)||!/TOTAL DE LA PÉRIODE/.test(g))E.push("regroupement");const jours=new Set(n.map(c=>cxJour(new Date(c.date)))).size;if((g.match(/Total du jour/g)||[]).length!==jours)E.push("jours "+(g.match(/Total du jour/g)||[]).length+"/"+jours);
  ui.bg="0";const u=bordHtml().html;if(/Total du jour/.test(u)||!/TOTAL —/.test(u))E.push("liste unique");return E.length?E.join(" ; "):true});
 await t("BD-4","filtres : statut, origine (vente propre / vendeur), recherche ; vendeur partenaire affiché dans la colonne Origine",()=>{const E=[],v=S.vendeurs[0];const vc=__mk(0,{vendeur:v.id,lignes:[{produit_id:null,desig:"Robe wax",qte:1,pu:9000}],cl:(()=>{const ad={id:uid("a"),libelle:"L",zone:S.config.zones[0].nom,quartier:"Q",repere:"R",gps:null,instructions:"",defaut:true};const cl={id:uid("cl"),nom:"Cliente Vendeur",tel:"",tel2:"",adresses:[ad],note:"",vendeur_id:v.id};S.clients.push(cl);return cl})()});
  ui.bp="0";ui.bo=v.id;ui.fs="";ui.q="";let L=bordRows();if(!L.length||!L.every(c=>c.vendeur_id===v.id)||!L.some(c=>c.id===vc.id))E.push("vendeur "+L.length);if(!bordHtml().html.includes(v.nom))E.push("nom vendeur");
  ui.bo="own";L=bordRows();if(L.some(c=>c.vendeur_id)||!L.length)E.push("vente propre");ui.bo="";ui.fs="annulee";L=bordRows();if(!L.every(c=>c.statut==="annulee"))E.push("statut annulée");
  ui.fs="confirmee";L=bordRows();if(!L.every(c=>c.statut==="confirmee"))E.push("statut");ui.fs="";ui.q="Cliente Vendeur";L=bordRows();if(L.length!==1)E.push("recherche "+L.length);ui.q="";return E.length?E.join(" ; "):true});
 await t("BD-5","impression et CSV : l'action ouvre l'aperçu imprimable (paysage) et le CSV contient une ligne par commande avec la date",()=>{const E=[];ui.bp="0";ui.bo="";ui.fs="";ui.q="";__as("admin");const n=bordRows().length;
  let h="";const old=window.rapport;window.rapport=(t,x)=>{h=x};try{ACT.bordPrint()}finally{window.rapport=old}if(!/landscape/.test(h)||!h.includes("Vérifié par"))E.push("aperçu");
  let csv=null;const od=window.csvDown;window.csvDown=(nm,hd,rows)=>{csv={nm,hd,rows}};try{ACT.bordCsv()}finally{window.csvDown=od}
  if(!csv||csv.rows.length!==n||csv.hd[0]!=="Date"||!/^bordereau_commandes_/.test(csv.nm)||csv.rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r[0])))E.push("csv "+JSON.stringify(csv&&csv.nm));
  __as("livreur");let h2="";window.rapport=(t,x)=>{h2=x};try{ACT.bordPrint()}finally{window.rapport=old}if(h2)E.push("livreur a imprimé");return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
