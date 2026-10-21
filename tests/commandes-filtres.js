/* Page Commandes : filtres combinés (statut, période, livreur, origine, zone, paiement, urgence), recherche élargie, compteur, réinitialisation.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/commandes-filtres.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:900}});await ctx.addInitScript(()=>{try{localStorage.setItem("angels_demo","1")}catch(e){}});
 const errs=[];let ok=0,ko=0;const chk=(id,label,o)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+o);o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));D.on("dialog",x=>x.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);window.__n=()=>cmdRows().length;view="commandes";render()});
 const tot=await D.evaluate(()=>({n:S.commandes.length,bar:!!document.querySelector('[data-f="cp"]')&&!!document.querySelector('[data-f="cl"]')&&!!document.querySelector('[data-f="cz"]')&&!!document.querySelector('[data-f="cpay"]')&&!!document.querySelector('[data-f="cu"]'),cnt:/commande\(s\)/.test(document.getElementById("app").textContent)}));
 chk("CF-1","barre de filtres complète (période, livreur, origine, zone, paiement, urgence) et compteur",tot.bar&&tot.cnt,JSON.stringify(tot));
 const r=await D.evaluate(()=>{
  const out={};const all=__n();out.all=all===S.commandes.length;
  const c=S.commandes[0];
  ui.fs=c.statut;out.fs=cmdRows().every(x=>x.statut===c.statut)&&__n()>0;ui.fs="";
  ui.cz=c.adr.zone;out.cz=cmdRows().every(x=>x.adr.zone===c.adr.zone)&&__n()>0;ui.cz="";
  ui.cp="0";const aj=cmdRows();out.cp=aj.every(x=>cxJour(new Date(x.date))===cxJour());ui.cp="";
  ui.co="own";out.own=cmdRows().every(x=>!x.vendeur_id);ui.co="";
  ui.cpay="solde";out.solde=cmdRows().every(x=>soldeCmd(x)<=0);ui.cpay="du";out.du=cmdRows().every(x=>soldeCmd(x)>0);ui.cpay="";
  ui.cu="1";out.urg=cmdRows().every(x=>x.priorite==="urgente");ui.cu="";
  const q=c.adr.quartier;if(q){ui.q=q;out.quartier=cmdRows().some(x=>x.id===c.id)}else out.quartier=true;ui.q="";
  const cl=S.livraisons[0];if(cl){ui.cl=cl.livreur_id;out.liv=cmdRows().every(x=>livsOf(x.id).some(l=>l.livreur_id===cl.livreur_id))&&__n()>0;ui.cl=""}else out.liv=true;
  ui.cl="none";out.sans=cmdRows().every(x=>!activeLiv(x.id));ui.cl="";
  ui.fs=c.statut;ui.cz=c.adr.zone;const both=cmdRows();out.combine=both.every(x=>x.statut===c.statut&&x.adr.zone===c.adr.zone)&&both.length<=all;ui.fs="";ui.cz="";
  return out});
 Object.entries(r).forEach(([k,v])=>{});
 chk("CF-2","chaque filtre isolé est exact (statut, zone, période, origine, paiement, urgence, quartier, livreur, sans livreur) et ils se combinent",Object.values(r).every(Boolean)||JSON.stringify(r));
 await D.selectOption('[data-f="cpay"]',"du");await D.waitForTimeout(150);
 const ui1=await D.evaluate(()=>({raz:!!document.querySelector('[data-act="cmdFiltresRaz"]'),cnt:document.getElementById("app").textContent.includes("correspondant aux filtres")}));
 await D.click('[data-act="cmdFiltresRaz"]');await D.waitForTimeout(150);
 const ui2=await D.evaluate(()=>({vide:!cmdFiltreActif(),raz:!document.querySelector('[data-act="cmdFiltresRaz"]'),n:cmdRows().length===S.commandes.length}));
 chk("CF-3","un filtre actif affiche « Réinitialiser » et le compteur ; la réinitialisation remet tout à zéro",ui1.raz&&ui1.cnt&&ui2.vide&&ui2.raz&&ui2.n,JSON.stringify([ui1,ui2]));
 await D.check('[data-f="cu"]');await D.waitForTimeout(150);const cu1=await D.evaluate(()=>ui.cu);await D.uncheck('[data-f="cu"]');await D.waitForTimeout(150);const cu2=await D.evaluate(()=>ui.cu);
 chk("CF-4","case « Urgentes » : cochée = filtre actif, décochée = désactivé",cu1==="1"&&cu2==="",cu1+"|"+cu2);
 const bd=await D.evaluate(()=>{const out={};const eg=()=>{const a=cmdRows().filter(c=>ui.fs||c.statut!=="annulee").map(c=>c.id).sort().join(),b=bordRows().map(c=>c.id).sort().join();return a===b};
  out.base=eg();const c=S.commandes[0];ui.fs=c.statut;out.fs=eg()&&bordRows().every(x=>x.statut===c.statut);ui.fs="";
  ui.cz=c.adr.zone;out.cz=eg()&&bordRows().every(x=>x.adr.zone===c.adr.zone);ui.cz="";
  ui.cp="0";out.cp=eg();ui.cp="m";out.mois=eg();ui.cp="";ui.cpay="du";out.pay=eg()&&bordRows().every(x=>soldeCmd(x)>0);ui.cpay="";
  ui.co="own";out.co=eg()&&bordRows().every(x=>!x.vendeur_id);ui.co="";
  view="commandes";render();const h=document.getElementById("app").innerHTML;out.barre=/bordPrint/.test(h)&&!/data-f="bp"/.test(h)&&!/data-f="bo"/.test(h);
  const sub=bordHtml().html;out.titre=/hors annulées/.test(sub);return out});
 chk("CF-5","le bordereau de commandes suit exactement les filtres du tableau (statut, zone, période, paiement, origine) : mêmes commandes, plus de sélecteurs de période ni d'origine propres",Object.values(bd).every(Boolean)||JSON.stringify(bd));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
