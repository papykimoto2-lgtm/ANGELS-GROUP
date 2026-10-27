/* Système livreurs, lot 4 : signature « client » faite depuis la même connexion que le livreur signalée, reliquat des tournées précédentes affiché.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/livreurs-lot4.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
(async()=>{
 const P=await import("file://"+path.resolve(__dirname,"../supabase/functions/_shared/passerelle.js"));
 const mk=(pr)=>{const evs=[];return{evs,db:{compteParUtilisateur:async()=>({livreur_ref:"lv1",actif:true}),mission:async()=>({statut:"en_cours",livreur_ref:"lv1",commande_ref:"C",payload:{montant_attendu:5000}}),code:async()=>null,preuve:async()=>pr,colis:async()=>[],ecrirePreuve:async()=>{},majMission:async()=>{},majCode:async()=>{},ajouterEvenement:async e=>{evs.push(e)}}}};
 const conf=(ip)=>({livraison_ref:"l1",type:"confirmer",ip_hash:ip,donnees:{montant:5000,recu_par:"Mme X",mode:"Espèces"}});
 const h=await P.empreinteIp("sel","41.202.1.2"),h2=await P.empreinteIp("sel","196.1.1.9");
 let a=mk({signature_client:"data:image/png;base64,x",client_ip:h});await P.traiterAction(a.db,{},conf(h),"u");
 let b=mk({signature_client:"data:image/png;base64,x",client_ip:h});await P.traiterAction(b.db,{},conf(h2),"u");
 let c=mk({});await P.traiterAction(c.db,{},conf(h),"u");
 chk("L4-1","signature « client » provenant de la même connexion Internet que la confirmation du livreur : marquée suspecte ; autre connexion ou pas de signature client : rien",a.evs[0].donnees.signature_suspecte===true&&!b.evs[0].donnees.signature_suspecte&&!c.evs[0].donnees.signature_suspecte,JSON.stringify([a.evs[0].donnees.signature_suspecte,b.evs[0].donnees.signature_suspecte]));
 chk("L4-2","l'empreinte de connexion utilise le même calcul que la signature du client (comparable)",h===await (async()=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("signature|sel|41.202.1.2"));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")})());
 const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":path.extname(f)===".html"?"text/html; charset=utf-8":path.extname(f)===".js"?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base=`http://127.0.0.1:${srv.address().port}`;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:1300,height:1000}}),p=await ctx.newPage();
 await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.signature_seuil=99999999});
 let r=await p.evaluate(()=>{const lv=S.livreurs.find(l=>!l.archive);lv.user_id=lv.user_id||"u_test";const c0=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(c0));c.id="l4c";c.numero="CMD-L4";c.statut="prete";c.colis=null;c.date=new Date(Date.now()-5*864e5).toISOString();c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];S.commandes.push(c);
  CEN_DIRECT=true;let l;try{l=affecter(c,lv.id,"");accepter(l);priseEnCharge(l,1);demarrer(l)}finally{CEN_DIRECT=false}
  const e=passAppliquer({id:941,type:"confirmer",cree_le:new Date().toISOString(),livraison_ref:l.id,livreur_ref:lv.id,preuve:{signature_client:"data:image/png;base64,iVBORw0KGgo"+"A".repeat(400),client_nom:"Mme Konan",client_signe_le:new Date().toISOString()},donnees:{montant:soldeCmd(c),mode:"Espèces",recu_par:"X",code_etat:"absent",signature_suspecte:true,preuve:true}});
  return{e,s:!!l.signature_suspecte,src:l.signature_source,al:alertes().some(x=>/signature\(s\) client à vérifier/.test(x.m))}});
 chk("L4-3","bureau : la signature suspecte est marquée sur la livraison, tracée au journal et signalée dans les alertes",r.e===""&&r.s&&r.src==="client"&&r.al,JSON.stringify(r));
 r=await p.evaluate(()=>{const lv=S.livreurs.find(l=>!l.archive);lv.ident_serveur="lv.test";const M=passStatsMissions();const js=JSON.stringify(M);return{net:/"net":/.test(js)}});
 chk("L4-4","le bureau publie le montant net de la tournée au livreur (pour calculer le reliquat)",r.net,JSON.stringify(r));
 await br.close();
 /* application livreur : reliquat */
 const br2=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const q=await (await br2.newContext({viewport:{width:400,height:800}})).newPage();
 await q.addInitScript(()=>{const sb={auth:{getSession:async()=>({data:{session:{access_token:"J",user:{id:"u1",user_metadata:{chg:false}}}}}),signOut:async()=>{}},from:()=>({select:()=>({order:async()=>({data:[],error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"K"},error:null})})})};window.supabase={createClient:()=>sb}});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 const h4=await q.evaluate(()=>{STATS={payload:{argent:{solde:8000,cloture:{nb:1,collecte:5000,produits:5000,frais:0,net:5000,du:8000,attente:0}}}};return cloturePanel()});
 chk("L4-5","application livreur : « À remettre au caissier » détaille « dont 3 000 F de reliquat des tournées précédentes »",/8\s?000 F/.test(h4)&&/dont[^<]*<b>3\s?000 F<\/b>[^<]*reliquat/.test(h4),h4.replace(/<[^>]+>/g," ").slice(0,300));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await br2.close();srv.close();process.exit(ko?1:0);
})();
