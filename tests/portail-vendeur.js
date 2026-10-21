/* Demandes de clients relevées par le vendeur partenaire (clé de relève) : logique serveur (base en mémoire) et appareil du vendeur (serveur simulé par les vraies fonctions).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-vendeur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":(typeof o==="string"?o:info||""));o===true?ok++:ko++};
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const msg=(o)=>"Commande vendeur — test\n[BOUTIQUE:"+b64(o)+"]";
(async()=>{
 const P=await import("../supabase/functions/_shared/portail-demandes.js");
 const mem=()=>{const D={rows:[],n:0,cles:{}};return{D,
  compterRecentes:async()=>0,enAttente:async()=>D.rows.filter(r=>!r.traite).length,existe:async ref=>D.rows.some(r=>r.ref===ref),inserer:async row=>{D.rows.push(Object.assign({id:++D.n,traite:false,cree_le:"2026-10-21T10:00:00Z"},row))},
  enAttenteListe:async n=>D.rows.filter(r=>!r.traite&&!(r.vendeur&&D.cles[r.vendeur])).slice(0,n).map(({id,ref,type,message,cree_le})=>({id,ref,type,message,cree_le})),acquitter:async ids=>{D.rows.forEach(r=>{if(ids.includes(r.id))r.traite=true})},
  ecrireCleVendeur:async(v,h)=>{D.cles[v]=h},empreinteVendeur:async v=>D.cles[v]||null,
  enAttenteVendeur:async(v,n)=>D.rows.filter(r=>!r.traite&&r.vendeur===v).slice(0,n).map(({id,ref,type,message,cree_le})=>({id,ref,type,message,cree_le})),acquitterVendeur:async(v,ids)=>{D.rows.forEach(r=>{if(r.vendeur===v&&ids.includes(r.id))r.traite=true})}}};
 const cfg={adminKey:"ADMIN-SECRET-123",sel:"s",limiteHeure:50,fileMax:100},db=mem(),NOW=Date.parse("2026-10-21T10:00:00Z");
 const rec=(o,ip)=>P.recevoir(db,cfg,{message:msg(o)},ip||"1.1.1.1",NOW),bur=(req,k)=>P.traiterBureau(db,cfg,req,k===undefined?"ADMIN-SECRET-123":k),ven=req=>P.traiterVendeur(db,req);
 await rec({f:"AAA111",n:"Ruth",t:"0700000001",v:"v_aya"});await rec({f:"BBB222",n:"Koffi",t:"0700000002",v:"v_bob"});await rec({f:"CCC333",n:"Sans",t:"0700000003"});
 chk("PV-1","chaque demande garde l'identifiant du vendeur visé (nettoyé) ; sans vendeur, aucun",db.D.rows.map(r=>r.vendeur||"").join()==="v_aya,v_bob,",JSON.stringify(db.D.rows.map(r=>r.vendeur)));
 const k0=await bur({action:"cle_vendeur",vendeur:"v_aya"},"mauvaise"),k1=await bur({action:"cle_vendeur",vendeur:""}),k2=await bur({action:"cle_vendeur",vendeur:"v_aya"});
 chk("PV-2","clé de relève : réservée à la clé d'administration, vendeur obligatoire ; la clé (20 caractères en 4 groupes) est rendue une fois, seule son empreinte est stockée",k0.status===401&&k1.status===400&&/^([A-Z2-9]{5}-){3}[A-Z2-9]{5}$/.test(k2.body.cle)&&db.D.cles.v_aya&&!JSON.stringify(db.D.cles).includes(k2.body.cle),JSON.stringify([k0.status,k1.status,k2.body]));
 const cleA=k2.body.cle;
 const b1=await ven({vendeur:"v_aya",cle:"FAUSSE",action:"lister"}),b2=await ven({vendeur:"v_bob",cle:cleA,action:"lister"}),b3=await ven({vendeur:"",cle:cleA,action:"lister"}),b4=await ven({vendeur:"v_aya",cle:"",action:"lister"});
 chk("PV-3","sans la bonne clé (fausse, clé d'un autre vendeur, vendeur ou clé vides, vendeur sans clé) : refus 401, aucune demande rendue",[b1,b2,b3,b4].every(x=>x.status===401&&!JSON.stringify(x.body).includes("Koffi")&&!JSON.stringify(x.body).includes("Ruth")),JSON.stringify([b1,b2,b3,b4]));
 const l1=await ven({vendeur:"v_aya",cle:cleA.toLowerCase(),action:"lister"});
 chk("PV-4","avec sa clé, le vendeur ne reçoit QUE ses demandes (ni celles d'un autre vendeur, ni celles sans vendeur)",l1.status===200&&l1.body.demandes.length===1&&/Ruth|AAA111/.test(JSON.stringify(l1.body.demandes[0]))&&!JSON.stringify(l1.body).includes("BBB222")&&!JSON.stringify(l1.body).includes("CCC333"),JSON.stringify(l1));
 const lb=await bur({action:"lister"});
 chk("PV-5","le bureau ne relève plus la demande d'un vendeur qui a une clé (pas de vol de la file) mais garde celles des autres",lb.body.demandes.map(x=>x.ref).join()==="BBB222,CCC333",JSON.stringify(lb.body.demandes.map(x=>x.ref)));
 const idB=db.D.rows.find(r=>r.ref==="BBB222").id,idA=db.D.rows.find(r=>r.ref==="AAA111").id;
 const ac=await ven({vendeur:"v_aya",cle:cleA,action:"acquitter",ids:[idA,idB,"x",-1]});
 chk("PV-6","acquitter : seules ses propres demandes sont marquées (l'identifiant d'un autre vendeur est ignoré), puis elles ne sont plus relevées",ac.status===200&&db.D.rows.find(r=>r.id===idA).traite&&!db.D.rows.find(r=>r.id===idB).traite&&(await ven({vendeur:"v_aya",cle:cleA,action:"lister"})).body.demandes.length===0,JSON.stringify(ac));
 const ren=await bur({action:"cle_vendeur",vendeur:"v_aya"}),ancien=await ven({vendeur:"v_aya",cle:cleA,action:"lister"}),nouv=await ven({vendeur:"v_aya",cle:ren.body.cle,action:"lister"}),inc=await ven({vendeur:"v_aya",cle:ren.body.cle,action:"zzz"});
 chk("PV-7","renouveler la clé annule l'ancienne ; action inconnue refusée",ancien.status===401&&nouv.status===200&&inc.status===400,JSON.stringify([ancien.status,nouv.status,inc.status]));
 const mig=fs.readFileSync(path.join(root,"supabase/migrations/012_portail_vendeurs.sql"),"utf8"),fn=fs.readFileSync(path.join(root,"supabase/functions/portail-vendeur/index.js"),"utf8");
 chk("PV-8","base et fonction : table des clés protégée (RLS, aucun droit anon / authenticated), clé jamais stockée en clair ; la fonction n'expose que traiterVendeur",/pd_vendeurs[\s\S]*enable row level security/.test(mig)&&/revoke all on public\.pd_vendeurs from anon, authenticated/.test(mig)&&/cle_hash/.test(mig)&&/traiterVendeur/.test(fn)&&!/traiterBureau|ADMIN_KEY/.test(fn));
 /* ---------- Appareil du vendeur ---------- */
 await new Promise(r=>srv.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:390,height:800}}),errs=[];
 const dbv=mem();let vid="";
 await ctx.route("**/functions/v1/**",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}"),nom=rq.url().split("/functions/v1/")[1].split("?")[0];
  let r;if(nom==="portail-vendeur")r=await P.traiterVendeur(dbv,body);else r={status:404,body:{ok:false}};
  await rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"},body:JSON.stringify(r.body)})});
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html?app=vendeur");await p.waitForTimeout(300);
 vid=await p.evaluate(()=>{window.__T=[];toast=(m)=>{__T.push(m)};ME=S.users.find(u=>u.role==="vendeur"&&u.actif);view="vHome";render();return vend().id});
 const cle=(await P.traiterBureau(dbv,cfg,{action:"cle_vendeur",vendeur:vid},"ADMIN-SECRET-123")).body.cle;
 await P.recevoir(dbv,cfg,{message:msg({f:"RUTH01",n:"Ruth",t:"0707000001",z:"Cocody",q:"Riviera",l:[["Robe",1,5000]],v:vid,vn:"x"})},"2.2.2.2",NOW);
 const pg=(await p.evaluate(()=>window.ANGELS_PASSERELLE&&window.ANGELS_PASSERELLE.url))||"";chk("PV-9","la passerelle publique est configurée (adresse https)",/^https:\/\//.test(pg),pg);
 let r=await p.evaluate(()=>{const n=S.demandes.length;vendeurCleForm();return{n,tuile:document.body.innerText.includes("Demandes clients"),modale:/clé de relève/i.test(document.getElementById("modal").innerText)}});
 chk("PV-10","sans clé : la tuile « Demandes clients » est là et la fenêtre de saisie de la clé s'ouvre",r.tuile&&r.modale,JSON.stringify(r));
 r=await p.evaluate(async()=>{const f=document.getElementById("mf");f.cle.value="MAUVAISE-CLE";f.requestSubmit();await new Promise(r=>setTimeout(r,600));return{cle:S.config.portail_vendeur_cle,t:__T.slice(-1)[0]}});
 chk("PV-11","clé refusée par le serveur : non enregistrée, message d'erreur",!r.cle&&/invalide/i.test(r.t||""),JSON.stringify(r));
 r=await p.evaluate(async c=>{vendeurCleForm();const f=document.getElementById("mf"),n0=S.demandes.length;f.cle.value=c;f.requestSubmit();await new Promise(r=>setTimeout(r,800));return{n0,n1:S.demandes.length,cle:S.config.portail_vendeur_cle,d:S.demandes.slice(-1)[0],att:demandesOf(vend()).length}},cle);
 chk("PV-12","bonne clé : la demande de Ruth est relevée sur le serveur, importée dans « Demandes clients » du vendeur (statut nouvelle) et acquittée",r.cle===cle&&r.n1===r.n0+1&&r.d&&r.d.nom==="Ruth"&&r.d.statut==="nouvelle"&&r.att>=1&&dbv.D.rows.every(x=>x.traite),JSON.stringify(r));
 r=await p.evaluate(async()=>{const n=S.demandes.length;_pvLast=0;await vendeurRelever(true);return S.demandes.length===n});chk("PV-13","une relève sans nouvelle demande n'importe rien (pas de doublon)",r===true);
 r=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);_pvLast=0;return vendeurRelever(true)});chk("PV-14","un autre rôle que vendeur ne relève jamais",r===null);
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
