/* Mon engin dans l'application Livreur : état de l'engin publié par le bureau (documents, intervention, prochain entretien, contrôle du jour) et affichage sans fuite de coûts */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin")});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 await p.evaluate(()=>{window.__d=n=>ymd(new Date(Date.now()+n*864e5));window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin")});
 const R=await p.evaluate(()=>{const o={};const lv=S.livreurs.find(l=>!l.archive&&l.moto_id),m=moto(lv.moto_id);gm();S.gmao.plans.length=0;gmPlanSave(null,{nom:"Vidange",decl:"km",km:3000,types:[m.type||"moto"]});m.km=99999;S.entretiens=S.entretiens.filter(e=>e.moto_id!==m.id);
  enDocsSave(m,{carte_grise_exp:__d(400),assurance_exp:__d(-2),visite_exp:__d(10),vignette_exp:""});
  const ot=gmOtCreer({moto_id:m.id,type:"curatif",titre:"Freins",priorite:"haute"});gmOtPlanifier(ot,{debut:__d(1),fin:__d(2),technicien:"Secret",presta_id:null});ot.cout_est=987654;
  const a=passPayloadLivreur(lv,Date.now()-1,Date.now()).moto,b=passPayloadLivreur(lv,Date.now()-1,Date.now()).moto;o.stable=JSON.stringify(a)===JSON.stringify(b);o.e=a.engin;o.json=JSON.stringify(a);
  gmOtDemarrer(ot);o.ot2=passPayloadLivreur(lv,Date.now()-1,Date.now()).moto.engin.ot.statut;o.c0=a.engin.ctrl;gmChkSaisir({moto_id:m.id});o.c1=passPayloadLivreur(lv,Date.now()-1,Date.now()).moto.engin.ctrl;
  S.gmao=undefined;const z=passPayloadLivreur(lv,Date.now()-1,Date.now()).moto.engin;o.nog=[z.ot,z.prochain,z.ctrl,z.chk];return o});
 chk("LE-1","l'engin du livreur est publié avec lui : type, documents non conformes (expirée, bientôt, non renseignée), intervention prévue, entretien préventif dépassé, contrôle du jour ; contenu stable",R.stable===true&&R.e.type&&R.e.docs.length===3&&R.e.docs.some(x=>x.etat==="expire")&&R.e.docs.some(x=>x.etat==="bientot"&&x.j===10)&&R.e.docs.some(x=>x.etat==="manque")&&R.e.ot&&R.e.ot.statut==="planifie"&&R.e.ot.titre==="Freins"&&R.e.prochain&&R.e.prochain.etat==="depasse"&&R.e.ctrl===false,JSON.stringify(R.e));
 chk("LE-2","aucun coût ni technicien publié ; l'OT passe « en cours » ; le contrôle du jour est vu ; sans module de maintenance : seulement les documents",!/987654|Secret|cout/.test(R.json)&&R.ot2==="en_cours"&&R.c0===false&&R.c1===true&&R.nog[0]===null&&R.nog[1]===null&&R.nog[2]===false&&R.nog[3]===false,JSON.stringify([R.ot2,R.c1,R.nog]));
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push("LIV "+e.message));await q.goto(base+"/livreur.html");await q.waitForTimeout(300);
 const H=await q.evaluate(()=>{if(typeof enginHtml!=="function")return{err:"fonction absente"};const E={type:"Moto",icone:"🏍️",docs:[{t:"Assurance",etat:"expire",j:-2},{t:"Visite technique",etat:"bientot",j:10},{t:"Vignette",etat:"manque",j:null}],ot:{num:"OT-1",titre:"<b>Freins</b>",statut:"en_cours",debut:"2026-10-24",fin:"2026-10-25"},prochain:{nom:"Vidange",etat:"depasse"},ctrl:false,chk:true};
  return{plein:enginHtml(E),vide:enginHtml(null),ok:enginHtml({type:"Vélo",icone:"🚲",docs:[],ot:null,prochain:null,ctrl:false,chk:false}),fait:enginHtml({type:"Vélo",docs:[],ot:null,prochain:null,ctrl:true,chk:true})}});
 chk("LE-3","affichage livreur : alertes documents, intervention en cours avec dates, entretien à faire, contrôle à faire ; texte du bureau échappé ; rien si pas d'engin ; « à jour » sinon",!H.err&&/Assurance expirée/.test(H.plein)&&/expire dans 10 j/.test(H.plein)&&/Vignette : non renseignée/.test(H.plein)&&/Intervention en cours/.test(H.plein)&&/24\/10\/2026 → 25\/10\/2026/.test(H.plein)&&!/<b>Freins/.test(H.plein)&&/&lt;b&gt;Freins/.test(H.plein)&&/à faire sans attendre/.test(H.plein)&&/Contrôle avant départ/.test(H.plein)&&H.vide===""&&/Contrôle avant départ fait/.test(H.fait)&&/Documents et entretien à jour/.test(H.ok),JSON.stringify(H).slice(0,600));
 chk("LE-4","aucune erreur de script (bureau et livreur)",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
