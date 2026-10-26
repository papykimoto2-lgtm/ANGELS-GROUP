/* Le code donné par le client est un contrôle, pas un verrou : la confirmation de livraison passe sans code ou avec un code non conforme, l'écart est tracé
   (journal d'audit, dossier de preuve, clôture du jour du centre).
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/code-non-bloquant.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));
 await p.goto(base+"/distribution.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);
  window.__prep=()=>{const l=S.livraisons.find(x=>x.statut==="en_cours"&&cmd(x.commande_id));const c=cmd(l.commande_id);c.colis=null;l.statut="en_cours";return l};
  window.__autre=()=>{const l=S.livraisons.find(x=>isActive(x)&&cmd(x.commande_id));const c=cmd(l.commande_id);c.colis=null;c.statut="en_cours";l.statut="en_cours";return l};
  window.__conf=(l,code)=>confirmer(l,{code,montant:String(l.montant_attendu||0),mode:"Espèces",recu_par:"M. Test",obs:"",ecart_note:"",colis_ok:"",signature:""})});
 let r=await p.evaluate(()=>{const l=__prep();const ok=__conf(l,"");return{ok,st:l.statut,etat:l.code_etat,a:S.audit.slice(-3).some(x=>/sans code client valide/.test(x.action)&&/non saisi/.test(x.detail||"")),t:__T.join("|")}});
 chk("CNB-1","bureau : confirmation SANS code → livraison validée, marquée « code absent », tracée dans le journal d'audit",r.ok===true&&r.st==="livree"&&r.etat==="absent"&&r.a&&!/incorrect/.test(r.t),JSON.stringify(r));
 r=await p.evaluate(()=>{const l=__autre();const ok=__conf(l,"0000");return{ok,etat:l.code_etat,st:l.statut,vrai:l.code}});
 chk("CNB-2","code NON conforme → livraison validée quand même, marquée « code non conforme »",r.ok===true&&r.st==="livree"&&r.etat==="non_conforme"&&r.vrai!=="0000",JSON.stringify(r));
 r=await p.evaluate(()=>{const l=__autre();const ok=__conf(l,l.code);return{ok,etat:l.code_etat===undefined?"ok":l.code_etat,st:l.statut}});
 chk("CNB-3","bon code → validée sans marque d'écart",r.ok===true&&r.st==="livree"&&r.etat==="ok",JSON.stringify(r));
 r=await p.evaluate(()=>{const l=__autre();const ok=confirmer(l,{code:l.code,code_etat:"absent",pg:true,montant:String(l.montant_attendu||0),mode:"Espèces",recu_par:"M. Test",obs:"",ecart_note:"",colis_ok:"",signature:""});return{ok,etat:l.code_etat}});
 chk("CNB-3b","livraison reçue du serveur (passerelle) avec « code absent » : l'écart est conservé sur la livraison",r.ok===true&&r.etat==="absent",JSON.stringify(r));
 r=await p.evaluate(()=>{const l=S.livraisons.find(x=>x.statut==="livree"&&x.code_etat==="absent");const c=cmd(l.commande_id);const h=cenPreuveHtml(c);return{h:/non saisi/.test(h)}});
 chk("CNB-4","dossier de preuve : « Code client : ⚠ non saisi » apparaît pour la livraison sans code",r.h===true,JSON.stringify(r));
 r=await p.evaluate(()=>{const D=cenCloture();return{n:D.sansCode.length}});
 chk("CNB-5","clôture du jour du centre : liste « Livrées sans code client valide » (sans bloquer la clôture)",r.n>=3,JSON.stringify(r));
 const src=fs.readFileSync(path.join(root,"distribution.html"),"utf8"),liv=fs.readFileSync(path.join(root,"livreur.html"),"utf8");
 chk("CNB-6","formulaires de confirmation (bureau et application livreur) : le champ code est « facultatif » et n'est plus obligatoire",/Code de confirmation \(donné par le client — facultatif\)<input name="code"[^>]*(?<!required)>/.test(src)&&!/name="code"[^>]*required/.test(src.split("Confirmer la livraison — ")[1].slice(0,900))&&/Code donné par le client <span class="mu">\(facultatif\)<\/span><input name="code" inputmode="numeric" autocomplete="off" value/.test(liv));
 chk("CNB-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
