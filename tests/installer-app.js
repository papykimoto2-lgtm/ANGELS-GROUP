/* Installation depuis l'interface des applications vendeur et livreur : bouton toujours visible (hors application déjà installée), invite native quand le navigateur la propose, sinon consigne adaptée au navigateur ; entrée « Installer » dans le menu.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/installer-app.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
const UA={android:"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",ios:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",wa:"Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.23",sam:"Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36"};
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const ouvrir=async(page,ua,vue)=>{const ctx=await b.newContext({viewport:{width:400,height:850},userAgent:UA[ua],isMobile:true,hasTouch:true});const p=await ctx.newPage();p.on("pageerror",e=>errs.push(page+" "+e.message));await p.goto(base+"/"+page);await p.waitForTimeout(700);return{ctx,p}};
 const connecter=(p,page)=>p.evaluate(page=>{if(page==="vendeur.html"){user={id:"u"};moi={nom:"Vendeur Test",ident:"v1"};vue()}else{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};PAGE="cours";vueMissions()}},page);
 for(const [page,nom] of [["vendeur.html","Vendeur"],["livreur.html","Livreur"]]){
  const P=page.slice(0,3).toUpperCase();
  // 1. écran de connexion, aucune invite du navigateur : le bouton est quand même là
  let {ctx,p}=await ouvrir(page,"android");
  let r=await p.evaluate(()=>{const e=document.querySelector(".inst");return{vis:!!e&&e.style.display!=="none",txt:e?e.innerText:""}});
  chk(P+"-1","connexion, Chrome Android sans invite native : bouton « Installer l'application "+nom+" » visible",r.vis&&r.txt.includes("Installer l'application "+nom),JSON.stringify(r));
  await p.click('.inst [data-a="installer"]');await p.waitForTimeout(150);
  r=await p.evaluate(()=>document.querySelector(".inst").innerText);
  chk(P+"-2","un clic affiche la consigne Chrome (menu ⋮, Installer l'application)",/Chrome/.test(r)&&/Installer l'application/.test(r)&&/⋮/.test(r),r);
  await p.click('.inst [data-a="installer"]');await p.waitForTimeout(100);
  r=await p.evaluate(()=>document.querySelector(".inst").innerText);
  chk(P+"-3","un second clic referme la consigne",!/menu/.test(r),r);
  // 2. invite native disponible
  r=await p.evaluate(async()=>{window.__p=0;const ev=new Event("beforeinstallprompt");ev.prompt=()=>{window.__p++};ev.userChoice=Promise.resolve({outcome:"accepted"});window.dispatchEvent(ev);await new Promise(r=>setTimeout(r,100));const bt=document.querySelector('.inst [data-a="installer"]');const cl=bt.className;bt.click();await new Promise(r=>setTimeout(r,100));return{cl,appels:window.__p,apres:document.querySelector(".inst").innerText}});
  chk(P+"-4","invite native du navigateur : bouton principal, un clic déclenche l'installation du navigateur (pas de consigne)",/\bbtn\b/.test(r.cl)&&!/ghost/.test(r.cl)&&r.appels===1&&!/menu/.test(r.apres),JSON.stringify(r));
  await ctx.close();
  // 3. iPhone, application intégrée, Samsung
  for(const [ua,motif,id] of [["ios",/Safari/,"5"],["wa",/Chrome/,"6"],["sam",/Samsung Internet/,"7"]]){
   ({ctx,p}=await ouvrir(page,ua));await p.click('.inst [data-a="installer"]');await p.waitForTimeout(150);r=await p.evaluate(()=>document.querySelector(".inst").innerText);
   chk(P+"-"+id,"consigne adaptée ("+ua+")",motif.test(r)&&(ua!=="ios"||/Sur l'écran d'accueil/.test(r))&&(ua!=="wa"||/navigateur d'une autre application/.test(r)),r);await ctx.close()}
  // 4. déjà installée (mode application) : rien
  {const c=await b.newContext({viewport:{width:400,height:850},userAgent:UA.android,isMobile:true});await c.addInitScript(()=>{const m=window.matchMedia.bind(window);window.matchMedia=q=>/standalone/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:m(q)});const pp=await c.newPage();await pp.goto(base+"/"+page);await pp.waitForTimeout(600);
   r=await pp.evaluate(()=>{const e=document.querySelector(".inst");return e?e.style.display+"|"+e.innerText:"absent"});chk(P+"-8","application déjà installée (mode standalone) : aucun bouton d'installation",/^none\|$/.test(r)||r==="absent",r);await c.close()}
  // 5. menu ☰
  ({ctx,p}=await ouvrir(page,"android"));await connecter(p,page);await p.waitForTimeout(200);
  r=await p.evaluate(()=>{const d=document.querySelector(".inst");return d?d.style.display+"|"+d.innerText:"absent"});
  chk(P+"-9","connecté : le bouton d'installation est affiché en haut de l'écran",/Installer l'application/.test(r),r);
  await p.click('[data-a="menu"]');await p.waitForTimeout(150);
  r=await p.evaluate(()=>{const e=[...document.querySelectorAll(".dr .mi")].find(x=>/Installer l'application/.test(x.innerText));return!!e});
  chk(P+"-10","le menu ☰ propose « 📲 Installer l'application »",r===true,r);
  await p.click('.dr [data-a="installer"]');await p.waitForTimeout(250);
  r=await p.evaluate(()=>({menu:!!document.querySelector(".dr"),txt:(document.querySelector(".inst")||{innerText:""}).innerText}));
  chk(P+"-11","le clic ferme le menu et affiche la consigne d'installation",!r.menu&&/Chrome/.test(r.txt),JSON.stringify(r));
  await p.screenshot({path:process.env.SHOT?process.env.SHOT+"/install-"+P+".png":"/tmp/install-"+P+".png"});
  await ctx.close();
 }
 chk("IA-12","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
