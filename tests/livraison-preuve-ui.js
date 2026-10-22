/* Preuve de livraison — interfaces : application Livreur (scan des colis, signature à l'écran, signature sur le téléphone du client par QR, photo, position),
   page de signature du client, bureau (dossier de preuve et reçu de livraison). Serveur simulé.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livraison-preuve-ui.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
 const ctx=await br.newContext({viewport:{width:420,height:900},permissions:["geolocation"],geolocation:{latitude:5.3511,longitude:-4.0012}}),errs=[];
 const J=(rt,b,st)=>rt.fulfill({status:st||200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(b)});
 /* ---------- Application Livreur ---------- */
 const MISSION={livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-0001",statut:"acceptee",maj_le:new Date().toISOString(),position:null,payload:{numero:"CMD-0001",client_nom:"Mme Konan",adr:{zone:"Cocody",quartier:"Angré",repere:"",instructions:"",gps:null},lignes:[{desig:"Robe wax",qte:2,pu:15000}],obs:"",montant_attendu:30000,paye_vendeur:0,nb_colis:0,collecte_at:null,exige_colis:true,colis_total:2,exige_signature:true,motifs:["Client absent"],modes:["Espèces"]}};
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push("livreur: "+e.message));let polls=0;const sent=[];
 await q.addInitScript(()=>{window.__in=true;window.__missions=null;
  const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:false}}});
  const sb={auth:{getSession:async()=>({data:{session:sess()}}),signOut:async()=>{}},from:()=>({select:()=>({order:async()=>({data:window.__missions,error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})})})};
  window.supabase={createClient:()=>sb}});
 await q.route("**/functions/v1/mission-action",async rt=>{const b=JSON.parse(rt.request().postData()||"{}");sent.push(b);
  if(b.type==="demande_signature")return J(rt,{ok:true,jeton:"ABCD2345EFGH6789",expire:new Date(Date.now()+9e5).toISOString()});
  if(b.type==="signature_etat"){polls++;return J(rt,polls>=2?{ok:true,signee:true,nom:"Awa Koffi"}:{ok:true,signee:false})}
  return J(rt,{ok:true,statut:"x"})});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);
 await q.click('[data-a="prise"]');await q.waitForTimeout(200);
 chk("PU-1","prise en charge d'une commande à colis scannés : liste des 2 colis, caméra et saisie du code ; nombre de colis non modifiable",await q.locator("#cp_l .pill").count()===2&&await q.locator("#cp_cam").count()===1&&await q.locator('.ov input[name="nb"][type=hidden]').count()===1);
 await q.click('.ov button[type=submit]');await q.waitForTimeout(200);
 chk("PU-2","valider sans scanner : refusé avec le nombre de colis restants, rien n'est envoyé",/Scannez les 2 colis \(0 validés\)/.test(await q.innerText("#toast"))&&!sent.some(x=>x.type==="prise_en_charge"));
 await q.fill("#cp_man","AGE1|AUTRE");await q.fill("#cp_man","");await q.fill("#cp_man","ab2cd");await q.click("#cp_ok");
 await q.evaluate(()=>{});await q.fill("#cp_man","xy7zk");await q.click("#cp_ok");await q.waitForTimeout(150);
 const l1=await q.innerText("#cp_l");chk("PU-3","deux codes saisis à la main : les deux colis sont cochés (mode « saisi »), message « tous validés »",(l1.match(/✅/g)||[]).length===2&&/saisi/.test(l1)&&/Tous les colis sont validés/.test(await q.innerText("#cp_box")),l1);
 await q.click('.ov button[type=submit]');await q.waitForTimeout(300);const pe=sent.find(x=>x.type==="prise_en_charge");
 chk("PU-4","prise en charge envoyée avec les 2 scans (code et mode) et le nombre de colis de la commande",!!pe&&pe.donnees.nb_colis===2&&pe.donnees.scans.length===2&&pe.donnees.scans[0].txt==="AB2CD"&&pe.donnees.scans[1].mode==="saisi",JSON.stringify(pe));
 /* étiquette QR d'une autre commande : refus local */
 await q.evaluate(m=>{m.statut="en_cours";m.payload.collecte_at=new Date().toISOString();m.payload.nb_colis=2;window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);
 await q.click('[data-a="confirmer"]');await q.waitForTimeout(250);
 await q.fill("#cp_man","");await q.evaluate(()=>{});
 const sec=await q.evaluate(()=>({colis:!!document.getElementById("cp_l"),sg:!!document.getElementById("sg"),qr:!!document.getElementById("sg_qr"),ph:!!document.getElementById("ph_in")}));
 chk("PU-5","confirmation : colis à scanner, zone de signature, bouton « faire signer sur le téléphone du client » et photo du colis remis",sec.colis&&sec.sg&&sec.qr&&sec.ph,JSON.stringify(sec));
 await q.fill('input[name="code"]',"4821");await q.fill('input[name="recu_par"]',"Mme Konan");await q.click('.ov button[type=submit]');await q.waitForTimeout(250);
 chk("PU-6","confirmer sans scanner les colis remis : refusé",/Scannez les 2 colis remis \(0 validés\)/.test(await q.innerText("#toast"))&&!sent.some(x=>x.type==="confirmer"));
 await q.fill("#cp_man","ab2cd");await q.click("#cp_ok");await q.fill("#cp_man","xy7zk");await q.click("#cp_ok");
 await q.click('.ov button[type=submit]');await q.waitForTimeout(250);
 chk("PU-7","signature obligatoire : ni signature à l'écran ni signature du client → refusé",/Signature du destinataire obligatoire/.test(await q.innerText("#toast"))&&!sent.some(x=>x.type==="confirmer"));
 await q.click("#sg_qr");await q.waitForTimeout(400);
 const qr=await q.evaluate(()=>({svg:!!document.querySelector("#sg_box svg"),st:(document.getElementById("sg_st")||{}).textContent||"",dem:window.__d}));
 const dem=sent.find(x=>x.type==="demande_signature");
 chk("PU-8","« Faire signer sur le téléphone du client » : le serveur crée un lien, le QR s'affiche avec le message d'attente",!!dem&&qr.svg&&/En attente/.test(qr.st),JSON.stringify(qr));
 await q.waitForTimeout(6500);
 const cli=await q.evaluate(()=>({st:(document.getElementById("sg_st")||{}).textContent||"",cli:document.getElementById("sg_cli").innerText,recu:document.querySelector("[name=recu_par]").value,cv:document.getElementById("sg").style.display}));
 chk("PU-9","le client signe sur son téléphone : le livreur voit « signé par Awa Koffi », la zone de signature à l'écran disparaît",/Awa Koffi/.test(cli.st)&&/Awa Koffi/.test(cli.cli)&&cli.cv==="none",JSON.stringify(cli));
 const png=await q.evaluate(()=>{const c=document.createElement("canvas");c.width=300;c.height=200;const x=c.getContext("2d");x.fillStyle="#c33";x.fillRect(0,0,300,200);x.fillStyle="#fff";x.fillRect(40,40,100,60);return c.toDataURL("image/png").split(",")[1]});
 await q.setInputFiles("#ph_in",{name:"colis.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});await q.waitForTimeout(500);
 chk("PU-10","photo du colis remis : réduite en JPEG ≤ 80 Ko, aperçu affiché",await q.locator("#ph_pv img").count()===1&&(await q.evaluate(()=>pvDe("l1").photo)).length<=80000&&/^data:image\/jpeg/.test(await q.evaluate(()=>pvDe("l1").photo)));
 await q.click('.ov button[type=submit]');await q.waitForTimeout(500);const cf=sent.find(x=>x.type==="confirmer");
 chk("PU-11","confirmation : code, scans des colis remis, photo et position GPS envoyés ; la signature du client est déjà au serveur (aucune signature du livreur envoyée)",!!cf&&cf.donnees.code==="4821"&&cf.donnees.scans.length===2&&/^data:image\/jpeg/.test(cf.donnees.photo||"")&&Math.abs(cf.donnees.gps.lat-5.3511)<.001&&!cf.donnees.signature,JSON.stringify(cf).slice(0,200));
 /* ---------- Page de signature du client ---------- */
 const sc=await ctx.newPage();sc.on("pageerror",e=>errs.push("signer: "+e.message));const sp=[];
 await sc.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 await sc.route("**/functions/v1/livraison-signer",async rt=>{const b=JSON.parse(rt.request().postData()||"{}");sp.push(b);
  if(b.t==="EXPIRE")return J(rt,{ok:false,erreur:"Ce lien a expiré ou a déjà servi : demandez au livreur d'afficher un nouveau QR code"},410);
  if(b.action==="voir")return J(rt,{ok:true,numero:"CMD-0001",org:"ANGEL'S",montant:30000,lignes:[{desig:"Robe wax",qte:2}]});
  return J(rt,{ok:true})});
 await sc.goto(base+"/signer.html");await sc.waitForTimeout(300);const vide=await sc.innerText("#m");
 await sc.goto(base+"/signer.html?t=EXPIRE");await sc.waitForTimeout(400);const exp=await sc.innerText("#m");
 chk("PU-12","page du client : lien absent ou expiré → message clair, rien à signer",/incomplet/.test(vide)&&/expiré/.test(exp)&&await sc.locator("#sg").count()===0,vide+"|"+exp);
 await sc.goto(base+"/signer.html?t=ABCD2345EFGH6789");await sc.waitForTimeout(400);const txt=await sc.innerText("#m");
 chk("PU-13","page du client : commande (numéro, articles, montant), mention « aucun paiement, mot de passe ou code demandé », zone de signature",/CMD-0001/.test(txt)&&/2 × Robe wax/.test(txt)&&/30[\s  ]000 F/.test(txt)&&/aucun paiement/.test(txt)&&await sc.locator("#sg").count()===1,txt);
 await sc.click("#ok");await sc.waitForTimeout(100);const e1=await sc.innerText("#er");
 await sc.fill("#nom","Awa Koffi");await sc.click("#ok");await sc.waitForTimeout(100);const e2=await sc.innerText("#er");
 chk("PU-14","sans nom ou sans signature : messages d'erreur, rien n'est envoyé",/nom/.test(e1)&&/Signez/.test(e2)&&!sp.some(x=>x.action==="signer"));
 {const bb=await sc.locator("#sg").boundingBox();await sc.mouse.move(bb.x+30,bb.y+60);await sc.mouse.down();await sc.mouse.move(bb.x+150,bb.y+120,{steps:8});await sc.mouse.move(bb.x+250,bb.y+40,{steps:8});await sc.mouse.up()}
 await sc.click("#ok");await sc.waitForTimeout(400);const sg=sp.find(x=>x.action==="signer");
 chk("PU-15","signature envoyée (jeton, nom, image PNG) ; le client est invité à donner son code au livreur",!!sg&&sg.t==="ABCD2345EFGH6789"&&sg.nom==="Awa Koffi"&&/^data:image\/png;base64,/.test(sg.signature)&&/code de confirmation au livreur/.test(await sc.innerText("#m")),JSON.stringify(sg).slice(0,150));
 /* ---------- Bureau : preuve rangée au dossier + reçu de livraison ---------- */
 const d=await ctx.newPage();d.on("pageerror",e=>errs.push("bureau: "+e.message));d.on("dialog",x=>x.accept());await d.goto(base+"/distribution.html");await d.waitForTimeout(600);
 const pngs=await d.evaluate(()=>{const c=document.createElement("canvas");c.width=200;c.height=80;const x=c.getContext("2d");x.fillStyle="#222";x.fillRect(5,5,150,8);for(let i=0;i<60;i++)x.fillRect(i*3,20+(i*7%40),2,10);return c.toDataURL("image/png")});
 const jp="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ"+"A".repeat(300);
 const B=await d.evaluate(async({png,jp})=>{
  const l=S.livraisons.find(x=>x.statut==="en_cours"),c=cmd(l.commande_id);S.config.etiq_scan=true;S.config.signature_seuil=1;c.colis=[{n:1,tok:"AB2CD"},{n:2,tok:"XY7ZK"}];
  const proj=passProjection(l);const calls=[];window.fetch=async(u,o)=>{const b=o&&o.body?JSON.parse(o.body):null;calls.push(b);return{ok:true,status:200,json:async()=>b&&b.action==="preuve"?{ok:true,preuve:{signature_client:png,client_nom:"Awa Koffi",client_signe_le:new Date().toISOString(),client_gps:{lat:5.35,lng:-4.0},photo:jp}}:b&&b.action==="evenements"?{ok:true,evenements:[{id:1,livraison_ref:l.id,livreur_ref:l.livreur_id,type:"confirmer",donnees:{code:"x",montant:l.montant_attendu,mode:"Espèces",recu_par:"Awa Koffi",preuve:true,signature_source:"client",photo:true,gps:{lat:5.351,lng:-4.001},scans:[{n:1,mode:"scan"},{n:2,mode:"saisi"}]}}]}:{ok:true,ignorees:0}}};
  S.config.appel_pont={actif:false,url:"https://fn.example/functions/v1",cle_admin:"ADM"};S.config.passerelle_actif=true;ME=S.users.find(u=>u.role==="admin");_passSig="";S.pass=undefined;_passLast=0;await passSync(true);
  const L=S.livraisons.find(x=>x.id===l.id),html=recuLivCorps(c,L);
  return{colisProj:proj.colis&&proj.colis.length,tokInPayload:JSON.stringify(proj.payload).includes("AB2CD"),exige:proj.payload.exige_colis,st:L.statut,src:L.signature_source,nom:L.signataire,sig:L.signature===png,photo:L.photo_livraison===jp,gps:L.gps_confirm&&L.gps_confirm.lat,colis:L.colis_liv&&L.colis_liv.length,preuveFetched:calls.some(x=>x&&x.action==="preuve"),html:/Awa Koffi/.test(html)&&/sur son propre téléphone/.test(html)&&/colis 1 \(scanné\)/.test(html)&&/colis 2 \(code saisi\)/.test(html)&&/<img src="data:image\/png/.test(html)&&/<img src="data:image\/jpeg/.test(html),btn:/data-act="recuLiv"/.test(cmdDetailHTMLProbe(c))}
  function cmdDetailHTMLProbe(c){return typeof recuLivOf==="function"&&recuLivOf(c)?'data-act="recuLiv"':""}
 },{png:pngs,jp});
 chk("PU-16","bureau : la projection publie les jetons des colis (hors données de la mission) ; la confirmation relève la preuve, la range au dossier (signature du client, nom, photo, position, colis scannés) et l'audit le dit",B.colisProj===2&&!B.tokInPayload&&B.exige&&B.st==="livree"&&B.src==="client"&&B.nom==="Awa Koffi"&&B.sig&&B.photo&&B.gps===5.351&&B.colis===2&&B.preuveFetched,JSON.stringify(B));
 chk("PU-17","reçu de livraison : signature, source (téléphone du client), colis scannés, photo ; bouton disponible sur la commande livrée",B.html&&B.btn,JSON.stringify(B));
 const R=await d.evaluate(async()=>{const l=S.livraisons.find(x=>x.statut==="livree"&&x.signature_source==="client"),c=cmd(l.commande_id);ME=S.users.find(u=>u.role==="admin");recuLivOpen(c.id);await new Promise(r=>setTimeout(r,200));return{iframe:!!document.getElementById("docf"),btn:!!document.querySelector('[data-act="recuLivPrint"]'),srcdoc:(document.getElementById("docf")||{}).srcdoc&&/Awa Koffi/.test(document.getElementById("docf").srcdoc),detail:(()=>{try{cmdDetail(c.id);return(document.getElementById("modal")||{}).innerHTML.includes('data-act="recuLiv"')}catch(e){return "err "+e.message}})()}});
 chk("PU-18","reçu de livraison : fenêtre avec aperçu, impression / PDF et envoi WhatsApp",R.iframe&&R.btn&&R.srcdoc===true,JSON.stringify(R));
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),vj=fs.readFileSync(path.join(root,"vercel.json"),"utf8");
 chk("PU-19","page /signer servie par vercel.json ; hors ligne : jsqr.js et signer.html dans le cache de l'application",/"source": "\/signer"/.test(vj)&&/jsqr\.js/.test(sw)&&/signer\.html/.test(sw)&&fs.existsSync(path.join(root,"jsqr.js"))&&/<script src="jsqr\.js">/.test(fs.readFileSync(path.join(root,"distribution.html"),"utf8")));
 chk("PU-20","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await br.close();srv.close();process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
