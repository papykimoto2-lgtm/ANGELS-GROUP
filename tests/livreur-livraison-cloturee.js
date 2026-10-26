/* Application livreur : une livraison clôturée ou modifiée par le centre ne laisse pas un formulaire de paiement ouvert.
   Usage : PLAYWRIGHT=/chemin/playwright node tests/livreur-livraison-cloturee.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
(async()=>{
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:420,height:900}}),errs=[];
 const J=(rt,b,st)=>rt.fulfill({status:st||200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(b)});
 const MISSION={livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-0001",statut:"en_cours",maj_le:new Date().toISOString(),position:null,payload:{numero:"CMD-0001",client_nom:"Mme Konan",adr:{zone:"Cocody",quartier:"Angré",repere:"",instructions:"",gps:null},lignes:[{desig:"Robe",qte:1,pu:8500}],obs:"",montant_attendu:8500,collecte_at:new Date().toISOString(),nb_colis:1}};
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push(e.message));const sent=[];let refus=false;
 await q.addInitScript(()=>{window.__missions=null;const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:false}}});
  const sb={auth:{getSession:async()=>({data:{session:sess()}}),signOut:async()=>{}},from:()=>({select:()=>({order:async()=>({data:window.__missions,error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})})})};
  window.supabase={createClient:()=>sb}});
 await q.route("**/functions/v1/mission-action",async rt=>{const b=JSON.parse(rt.request().postData()||"{}");sent.push(b);if(refus)return J(rt,{ok:false,erreur:"Cette livraison n'est plus en cours"},409);return J(rt,{ok:true,statut:"x"})});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);
 await q.click('[data-a="confirmer"]');await q.waitForTimeout(250);
 chk("LC-1","livraison en cours : le formulaire de confirmation (montant, paiement) s'ouvre",await q.locator('.ov input[name="montant"]').count()===1);
 // le centre clôture la livraison pendant que le formulaire est ouvert
 await q.evaluate(m=>{window.__missions=[Object.assign({},m,{statut:"echouee"})]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);
 const t=await q.innerText("#toast");
 chk("LC-2","le centre déclare la livraison échouée : le formulaire de paiement se FERME tout seul, avec un message clair",await q.locator(".ov").count()===0&&/échouée/.test(t)&&/formulaire est fermé/.test(t),t);
 chk("LC-3","rien n'a été envoyé au serveur",!sent.some(x=>x.type==="confirmer"));
 // formulaire encore valable : reste ouvert
 await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);await q.click('[data-a="confirmer"]');await q.waitForTimeout(250);
 await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);
 chk("LC-4","livraison toujours en cours : l'actualisation ne ferme pas le formulaire",await q.locator('.ov input[name="montant"]').count()===1);
 // refus 409 du serveur : fermeture + actualisation
 refus=true;await q.fill('input[name="recu_par"]',"Mme Konan");await q.click('.ov button[type=submit]');await q.waitForTimeout(400);
 const t2=await q.innerText("#toast");
 chk("LC-5","refus du serveur « n'est plus en cours » : le formulaire se ferme, la liste est actualisée et le message l'explique",await q.locator(".ov").count()===0&&/plus en cours/.test(t2)&&/liste actualisée/.test(t2),t2);
 // livraison retirée de la liste
 refus=false;await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);await q.click('[data-a="confirmer"]');await q.waitForTimeout(250);
 await q.evaluate(()=>{window.__missions=[]});await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);
 chk("LC-6","livraison retirée de la liste par le centre : le formulaire se ferme aussi",await q.locator(".ov").count()===0&&/retirée/.test(await q.innerText("#toast")));
 chk("LC-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await br.close();srv.close();process.exit(ko?1:0);
})();
