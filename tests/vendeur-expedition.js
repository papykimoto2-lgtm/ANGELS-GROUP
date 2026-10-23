/* Demande d'expédition depuis l'application vendeur : destinations publiées, formulaire (portée, destination, poids), serveur, application au bureau (tarif recalculé, dossier lié). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 const G=await import("../supabase/functions/_shared/passerelle.js");
 const D={mis:{},code:{},colis:{},pre:{},jet:{},ev:[],n:0,cmds:[]};
 const db={livreursConnus:async()=>["LV1"],refsAvecEvenementsEnAttente:async()=>[],ecrireMission:async m=>{D.mis[m.livraison_ref]=m},ecrireCode:async(r,h)=>{D.code[r]={code_hash:h,essais:0}},retirerMissions:async()=>{},
  compteParUtilisateur:async u=>u==="U1"?{livreur_ref:"LV1",actif:true}:null,vendeurParUtilisateur:async u=>u==="V1"?{vendeur_ref:"v1",actif:true,nom:"Awa"}:null,mission:async r=>D.mis[r]||null,code:async r=>D.code[r]||null,majCode:async(r,p)=>Object.assign(D.code[r],p),majMission:async(r,p)=>Object.assign(D.mis[r],p),majPosition:async()=>{},
  ajouterEvenement:async e=>{D.ev.push(Object.assign({id:++D.n},e))},ecrireColis:async()=>{},colis:async()=>[],ecrirePreuve:async(r,p)=>{D.pre[r]=Object.assign(D.pre[r]||{},p)},preuve:async r=>D.pre[r]||null,
  ajouterCmdVendeur:async r=>{D.cmds.push(r)},nbCmdsVendeurEnAttente:async()=>0};
 const cfg={adminKey:"ADM",essaisCodeMax:5},NOW=Date.parse("2026-10-22T10:00:00Z"),jpg="data:image/jpeg;base64,/9j/4AAQ"+"A".repeat(500);
 let r=await G.traiterVendeurEtat(db,{action:"commander",ref:"VD-20261023-AAAA",nom:"K",zone:"Bouaké",lignes:[{desig:"Vase",qte:1,pu:5000}],pay:"livraison",portee:"national",dest:"d1",poids:2.53},"V1");
 chk("VE-1","serveur : la commande du vendeur transporte l'expédition demandée (portée, destination, poids arrondi à 0,1 kg)",r.status===200&&D.cmds[0]&&JSON.stringify(D.cmds[0].donnees.exp)===JSON.stringify({portee:"national",dest:"d1",poids:2.5}),JSON.stringify(D.cmds));
 r=await G.traiterVendeurEtat(db,{action:"commander",ref:"VD-20261023-BBBB",nom:"K",zone:"Bouaké",lignes:[{desig:"Vase",qte:1,pu:5000}],pay:"livraison",portee:"national",poids:2},"V1");
 const r2=await G.traiterVendeurEtat(db,{action:"commander",ref:"VD-20261023-CCCC",nom:"K",zone:"Cocody",lignes:[{desig:"Vase",qte:1,pu:5000}],pay:"livraison",portee:"lune",dest:"d1",poids:2},"V1");
 chk("VE-2","serveur : expédition sans destination ou poids refusée (400) ; portée inconnue ignorée (livraison locale normale)",r.status===400&&/Destination et poids/.test(r.body.erreur)&&r2.status===200&&D.cmds[1].donnees.exp===undefined,JSON.stringify([r,r2]));
 const z=G.nettoyerEtatVendeur({nom:"A",dests:[{id:"d1",nom:"Bouaké",pays:"Côte d'Ivoire",portee:"national",delai_j:2,base:3000,par_kg:500,x:1},{id:"d2",nom:"Lune",portee:"spatial"},{id:"",nom:"vide",portee:"national"}]});
 chk("VE-3","serveur : l'état publié au vendeur garde les destinations valides (portée connue, champs nettoyés) et écarte les autres",z.dests.length===1&&z.dests[0].id==="d1"&&z.dests[0].base===3000&&z.dests[0].x===undefined,JSON.stringify(z.dests));
 /* ---- bureau ---- */
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push("B "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(400);
 await p.evaluate(()=>{window.toast=m=>{(window.__T=window.__T||[]).push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif)});
 const B1=await p.evaluate(async()=>{const v=S.vendeurs[0],e=await vendEtatPub(v),n=destsActives().length;return{n,dests:(e.dests||[]).length,champs:Object.keys((e.dests||[])[0]||{}).sort().join()}});
 chk("VE-4","état publié au vendeur : destinations actives du catalogue du bureau (tarif et délai)",B1.n>0&&B1.dests===B1.n&&B1.champs==="base,delai_j,id,nom,par_kg,pays,portee",JSON.stringify(B1));
 const B2=await p.evaluate(()=>{const v=S.vendeurs[0],d=destsActives("national")[0],zn=(S.config.zones[0]||{}).nom||"Cocody",ex=(ref,e)=>vendCmdImporter({vendeur_ref:v.id,ref,donnees:{nom:"K",zone:d.nom,lignes:[{desig:"Vase",qte:1,pu:5000}],pay:"livraison",exp:e}});
  const e1=ex("X1",{portee:"national",dest:d.id,poids:3}),c1=S.commandes.find(c=>c.app_ref==="X1"),e2=ex("X2",{portee:"national",dest:"inexistante",poids:3}),c2=S.commandes.find(c=>c.app_ref==="X2");
  return{e1,e2,exp:c1&&c1.exp&&c1.exp.dest,frais:c1&&c1.frais,attendu:fraisExp(d,3),dossier:!!(c1&&c1.exp&&S.expeditions.find(x=>x.id===c1.exp.exp_id)),statut:c1&&c1.statut,c2:!!c2,c2exp:c2&&c2.exp,obs:c2&&/non appliquée/.test(c2.obs||"")}});
 chk("VE-5","bureau : commande du vendeur avec expédition → tarif recalculé par le bureau, dossier d'expédition lié, statut « en attente » ; destination inconnue → commande créée sans expédition, avec une note",B2.e1===null&&B2.exp&&B2.frais===B2.attendu&&B2.dossier&&B2.statut==="attente"&&B2.e2===null&&B2.c2&&!B2.c2exp&&B2.obs,JSON.stringify(B2));
 /* ---- application vendeur ---- */
 const pv=await ctx.newPage();pv.on("pageerror",e=>errs.push("V "+e.message));await pv.goto(base+"/vendeur.html");await pv.waitForTimeout(900);
 const V1=await pv.evaluate(async()=>{user={id:"u"};moi={nom:"Awa"};D={zones:[{nom:"Cocody",frais:1000}],dests:[{id:"d1",nom:"Bouaké",pays:"Côte d'Ivoire",portee:"national",delai_j:2,base:3000,par_kg:500},{id:"d2",nom:"Accra",pays:"Ghana",portee:"sous_regional",delai_j:4,base:9000,par_kg:1500}],types:[],commandes:[],demandes:[],reglements:[],solde:0,lien:"https://x.test/p"};PAGE="nouvelle";vue();
  const o={case:!!document.getElementById("hors"),cache:document.getElementById("exbox").classList.contains("hide")};const h=document.getElementById("hors");h.checked=true;h.dispatchEvent(new Event("change",{bubbles:true}));
  o.visible=!document.getElementById("exbox").classList.contains("hide");o.portees=[...document.getElementById("portee").options].map(x=>x.value).join();o.dests=[...document.getElementById("dest").options].map(x=>x.value).join();
  o.zoneCachee=document.getElementById("zlab").classList.contains("hide");o.zoneReq=document.querySelector("#fcmd [name=zone]").required;
  document.getElementById("poids").value="3";document.getElementById("poids").dispatchEvent(new Event("input",{bubbles:true}));o.est=document.getElementById("exinfo").textContent;
  const P=document.getElementById("portee");P.value="sous_regional";P.dispatchEvent(new Event("change",{bubbles:true}));o.dests2=[...document.getElementById("dest").options].map(x=>x.value).join();P.value="national";P.dispatchEvent(new Event("change",{bubbles:true}));
  let pris=null;const D0=D;window.api=async(f,b)=>{if(b&&b.action==="commander")pris=b;return b&&b.action==="etat"?Object.assign({ok:true},D0):{ok:true}};
  const f=document.getElementById("fcmd");f.nom.value="Koné";f.querySelector(".ld").value="Vase";f.querySelector(".lp").value="5000";f.requestSubmit();await new Promise(r=>setTimeout(r,300));o.envoye=pris&&{zone:pris.zone,portee:pris.portee,dest:pris.dest,poids:pris.poids};
  PAGE="nouvelle";vue();o.cocheSeule=true;const f2=document.getElementById("fcmd");f2.zone.value="Cocody";f2.nom.value="K";f2.querySelector(".ld").value="V";f2.querySelector(".lp").value="100";pris=null;f2.requestSubmit();await new Promise(r=>setTimeout(r,300));o.local=pris&&{zone:pris.zone,portee:pris.portee};
  D={zones:[{nom:"Cocody",frais:1000}],types:[],commandes:[],demandes:[],reglements:[],solde:0,lien:"x"};PAGE="nouvelle";vue();o.sansDests=!document.getElementById("hors");return o});
 chk("VE-6","application vendeur : case « Envoi hors Abidjan », portée → destinations du bureau, poids → estimation, zone masquée ; envoi avec portée, destination et poids",V1.case&&V1.cache&&V1.visible&&V1.portees==="national,sous_regional"&&V1.dests==="d1"&&V1.zoneCachee&&V1.zoneReq===false&&/3[   ]?500|4[   ]?000/.test(V1.est.replace(/\s/g," "))&&V1.dests2==="d2"&&V1.envoye&&V1.envoye.zone==="Bouaké"&&V1.envoye.portee==="national"&&V1.envoye.dest==="d1"&&V1.envoye.poids===3,JSON.stringify(V1));
 chk("VE-7","livraison locale inchangée (zone envoyée, pas de portée) ; sans destination publiée, la case n'apparaît pas",V1.local&&V1.local.zone==="Cocody"&&V1.local.portee===undefined&&V1.sansDests===true,JSON.stringify(V1));
 chk("VE-8","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
