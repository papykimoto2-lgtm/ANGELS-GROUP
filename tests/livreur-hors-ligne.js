/* Application livreur « hors ligne d'abord » : missions mémorisées, actions mises en file sans réseau, envoi dans l'ordre au retour du réseau, refus serveur signalé.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-hors-ligne.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const P=(ref,num,statut,extra)=>({livraison_ref:ref,livreur_ref:"lv1",commande_ref:num,statut,maj_le:new Date().toISOString(),position:null,payload:Object.assign({numero:num,priorite:"normale",client_nom:"Client "+num,adr:{zone:"Cocody",quartier:"Angré",repere:"",instructions:"",gps:null},lignes:[{desig:"Robe",qte:1,pu:15000}],obs:"",montant_attendu:15000,paye_vendeur:0,nb_colis:0,collecte_at:null,cle_appel:"c".repeat(32),appel_possible:false,motifs:["Client absent"],modes:["Espèces"]},extra||{})});
 await ctx.addInitScript(()=>{
  window.__off=false;Object.defineProperty(navigator,"onLine",{get:()=>!window.__off});
  window.__missions=null;window.__chg=false;window.__in=false;
  const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:false}}});
  const sb={auth:{signInWithPassword:async()=>{window.__in=true;return{data:{},error:null}},getSession:async()=>({data:{session:window.__in?sess():null}}),updateUser:async()=>({data:{},error:null}),signOut:async()=>{window.__in=false}},
   from:()=>({select:()=>({order:async()=>{if(window.__off)return{data:null,error:{message:"Failed to fetch"}};return{data:window.__missions,error:null}},maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})})})};
  window.supabase={createClient:()=>sb};
 });
 const recus=[];let refuserCode=false;
 await ctx.route("**/functions/v1/**",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");recus.push(body);
  const bad=body.type==="confirmer"&&body.donnees.code!=="4821";rt.fulfill({status:bad?403:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(bad?{ok:false,erreur:"Code de confirmation incorrect"}:{ok:true,statut:"x"})})});
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/livreur.html");await p.waitForTimeout(500);
 await p.evaluate(ms=>{window.__missions=ms},[P("l1","CMD-0001","affectee"),P("l2","CMD-0002","en_cours",{collecte_at:new Date().toISOString(),nb_colis:1})]);
 await p.fill("#li","koffi.yao");await p.fill("#lp","bon");await p.click("#fl button:not(.aa-e)");await p.waitForTimeout(700);
 const cache1=await p.evaluate(()=>JSON.parse(localStorage.getItem("ang_lv_cache")||"null"));
 chk("HL-1","connecté : les missions sont mémorisées sur le téléphone (avec l'heure de mise à jour)",cache1&&cache1.missions.length===2&&cache1.uid==="u1"&&cache1.moi.nom==="Koffi Yao",JSON.stringify(cache1).slice(0,200));
 /* réseau coupé */
 await p.evaluate(()=>{window.__off=true;dispatchEvent(new Event("offline"))});await p.waitForTimeout(200);
 const ban=await p.innerText("#app");
 chk("HL-2","réseau coupé : bandeau « Hors ligne » avec l'heure des missions affichées",/Hors ligne/.test(ban)&&/CMD-0001/.test(ban),ban.slice(0,200));
 const avant=recus.length;
 await p.click('[data-a="accepter"]');await p.waitForTimeout(400);
 const q1=await p.evaluate(()=>({f:JSON.parse(localStorage.getItem("ang_lv_file")),txt:document.getElementById("app").innerText}));
 chk("HL-3","« Accepter » hors ligne : rien n'est envoyé, l'action est gardée (file de 1), la mission apparaît aussitôt « Acceptée » avec « en attente d'envoi »",recus.length===avant&&q1.f.length===1&&q1.f[0].type==="accepter"&&/Acceptée/.test(q1.txt)&&/en attente d'envoi/.test(q1.txt),JSON.stringify(q1).slice(0,300));
 await p.click('[data-a="accepter"]').catch(()=>{});
 /* confirmation hors ligne : en attente, jamais « livrée » localement */
 await p.locator('[data-a="confirmer"]').click();await p.waitForTimeout(200);
 await p.fill('input[name="code"]',"4821");await p.fill('input[name="recu_par"]',"Mme Konan");await p.click(".ov button[type=submit]");await p.waitForTimeout(400);
 const q2=await p.evaluate(()=>({f:JSON.parse(localStorage.getItem("ang_lv_file")).map(x=>x.type),txt:document.getElementById("app").innerText}));
 chk("HL-4","« Confirmer la livraison » hors ligne : mise en file, la carte indique « Confirmation en attente » (la livraison n'est PAS marquée livrée tant que le serveur n'a pas vérifié le code)",q2.f.join()==="accepter,confirmer"&&/Confirmation en attente/.test(q2.txt)&&!/Livrée/.test(q2.txt),JSON.stringify(q2).slice(0,300));
 const incid=await p.evaluate(()=>{mettreEnFile("l1","incident",{nature:"Panne",description:"Crevaison"});mettreEnFile("l1","incident",{nature:"Panne",description:"Crevaison 2"});mettreEnFile("l1","position",{lat:5.3,lng:-4,precision:5});mettreEnFile("l1","position",{lat:5.31,lng:-4,precision:5});return file().map(x=>x.type).join()});
 chk("HL-5","file : doublons d'une même action ignorés, une seule position gardée (la dernière), plusieurs incidents conservés",incid==="accepter,confirmer,incident,incident,position","");
 /* retour du réseau : envoi dans l'ordre */
 recus.length=0;await p.evaluate(()=>{window.__off=false;dispatchEvent(new Event("online"))});await p.waitForTimeout(1200);
 const ordre=recus.map(x=>x.type).join();
 const f2=await p.evaluate(()=>JSON.parse(localStorage.getItem("ang_lv_file")));
 chk("HL-6","retour du réseau : les actions partent automatiquement DANS L'ORDRE saisi, la file se vide",ordre==="accepter,confirmer,incident,incident,position"&&f2.length===0,JSON.stringify({ordre,f2}));
 /* refus serveur d'une action différée */
 await p.evaluate(()=>{window.__off=true;dispatchEvent(new Event("offline"))});
 await p.evaluate(()=>{mettreEnFile("l2","confirmer",{code:"0000",montant:"15000",recu_par:"X"})});
 recus.length=0;await p.evaluate(()=>{window.__off=false;dispatchEvent(new Event("online"))});await p.waitForTimeout(1200);
 const rej=await p.evaluate(()=>({r:JSON.parse(localStorage.getItem("ang_lv_rej")||"[]"),txt:document.getElementById("app").innerText,f:JSON.parse(localStorage.getItem("ang_lv_file")).length}));
 chk("HL-7","action différée refusée par le serveur (mauvais code) : retirée de la file et SIGNALÉE au livreur, qui doit la confirmer (« J'ai compris »)",rej.r.length===1&&/refusée par le serveur/.test(rej.txt)&&/incorrect/.test(rej.txt)&&rej.f===0,JSON.stringify(rej).slice(0,300));
 await p.click('[data-a="rejOk"]');const apres=await p.evaluate(()=>JSON.parse(localStorage.getItem("ang_lv_rej")||"[]").length);
 /* démarrage sans réseau avec mémoire */
 const p2=await ctx.newPage();p2.on("pageerror",e=>errs.push("p2: "+e.message));await p2.addInitScript(()=>{window.__off=true});
 await p2.goto(base+"/livreur.html");await p2.waitForTimeout(800);
 const dem=await p2.evaluate(()=>({txt:document.getElementById("app").innerText,login:!!document.getElementById("fl")}));
 chk("HL-8","ouverture de l'application SANS réseau : pas d'écran de connexion, les dernières missions s'affichent avec le bandeau hors ligne",apres===0&&!dem.login&&/CMD-0001/.test(dem.txt)&&/Hors ligne/.test(dem.txt),JSON.stringify(dem).slice(0,200));
 /* un autre livreur sur le même téléphone : mémoire et file effacées */
 const p3=await ctx.newPage();p3.on("pageerror",e=>errs.push("p3: "+e.message));
 await p3.addInitScript(()=>{window.__changeUser=true});await p3.goto(base+"/livreur.html");await p3.waitForTimeout(500);
 await p3.evaluate(()=>{localStorage.setItem("ang_lv_file",JSON.stringify([{id:"z",ref:"l9",type:"accepter",donnees:{},t:Date.now(),cmd:"X"}]));const c=JSON.parse(localStorage.getItem("ang_lv_cache"));c.uid="autre-livreur";localStorage.setItem("ang_lv_cache",JSON.stringify(c));window.__missions=[];window.__in=false});
 await p3.reload();await p3.waitForTimeout(500);await p3.evaluate(()=>{window.__missions=[]});await p3.fill("#li","koffi.yao");await p3.fill("#lp","bon");await p3.click("#fl button:not(.aa-e)");await p3.waitForTimeout(700);
 const autre=await p3.evaluate(()=>({f:localStorage.getItem("ang_lv_file"),c:JSON.parse(localStorage.getItem("ang_lv_cache")||"null")}));
 chk("HL-9","changement de livreur sur le même téléphone : les actions et missions de l'ancien ne sont ni reprises ni envoyées (mémoire effacée)",(autre.f===null||autre.f==="[]")&&autre.c&&autre.c.uid==="u1"&&autre.c.missions.length===0,JSON.stringify(autre).slice(0,200));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.slice(0,5).join(" | "):""));process.exit(ko||errs.length?1:0);
})();
