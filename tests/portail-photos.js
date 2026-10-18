/* Portail public sans emoji : icônes sobres et photos réelles importées (activités, atouts, produits).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-photos.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}};
  window.__sc=(c,f)=>sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))),l=>(l.debit||0)-(l.credit||0));
  window.__ach=o=>acheterVehicule(Object.assign({date:today(),fournisseur:"Auto Import SARL",marque:"Toyota",modele:"Corolla",annee:2020,vin:"VIN-"+Math.random().toString(36).slice(2,8).toUpperCase(),prix:1180000,paye:1180000,mode:"banque",km:30000},o));
  window.__vente=(vid,o)=>vendreVehicule(Object.assign({vn_id:vid,date:today(),client:"Kouassi Yao",prix:1534000,mode:"banque"},o));
  __as("admin");S.settings.tva_taux=18;S.attachments.push({id:"at_test",nom:"p.pdf",type:"application/pdf",taille:5,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})});
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};

 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP4z8CAFTEMLQkAm4UP8cHGGxoAAAAASUVORK5CYII=","base64");
 const EMO=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;
 const pd=await ctx.newPage();await pd.goto(base+"/distribution.html");await pd.waitForTimeout(400);
 const tok=await pd.evaluate(()=>b64({o:"ANGEL'S",w:"0707000000",z:S.config.zones.slice(0,2).map(z=>[z.nom,z.frais]),p:S.produits.filter(p=>p.actif).slice(0,3).map(p=>[p.code,p.nom,p.prix,p.stock]),m:[],t:1}));
 const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept());await ps.goto(base+"/parametres.html");await ps.waitForTimeout(400);
 await ps.evaluate(t=>{AUTH.dist={id:"x",nom:"t",exp:Date.now()+600000};const C=pLire();C.boutique=t;localStorage.setItem(PKEY,JSON.stringify(C));PCUR=null;uView();pTab("accueil")},tok);await ps.waitForTimeout(150);
 const ed=await ps.evaluate(()=>({ic:document.querySelectorAll('#pform [name^="ic"]').length,at:document.querySelectorAll('#pform [name^="at_t"]').length,txt:[...document.querySelectorAll("#ptl .pp")].filter(p=>p.dataset.pp==="accueil").map(p=>p.textContent).join(" ")}));
 chk("PHO-1","Paramètres : plus de champ « Icône » (emoji) ; trois atouts avec titre, texte et photo",ed.ic===0&&ed.at===3&&/Photo/.test(ed.txt)&&!/Icône/.test(ed.txt),JSON.stringify(ed).slice(0,200));
 await ps.evaluate(()=>{PIMG={k:"atp",i:0}});await ps.setInputFiles("#m_img",[{name:"a.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 await ps.evaluate(()=>{PIMG={k:"abn",i:0}});await ps.setInputFiles("#m_img",[{name:"b.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 await ps.evaluate(()=>pTab("boutique"));
 const pr=await ps.evaluate(()=>({n:document.querySelectorAll('#ptl [data-p="ppp"]').length,codes:[...document.querySelectorAll('#ptl [data-p="ppp"]')].map(b=>b.dataset.c)}));
 chk("PHO-2","onglet Boutique : un bouton photo par produit du catalogue publié",pr.n===3,JSON.stringify(pr));
 await ps.evaluate(c=>{PIMG={k:"ppp",c}},pr.codes[0]);await ps.setInputFiles("#m_img",[{name:"p.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 const sv=await ps.evaluate(()=>{const f=document.getElementById("pform");f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));const c=JSON.parse(localStorage.getItem(PKEY));return{at:c.atouts[0].photo.slice(0,22),ban:c.activites[0].banniere.slice(0,22),pp:Object.keys(c.photosProduits),pp0:Object.values(c.photosProduits)[0].slice(0,22),icones:c.activites.some(a=>"icone" in a)}});
 chk("PHO-3","enregistrement : photo d'atout, bannière de division et photo de produit (JPEG compressé) conservées",sv.at==="data:image/jpeg;base64"&&sv.ban==="data:image/jpeg;base64"&&sv.pp.length===1&&sv.pp0==="data:image/jpeg;base64"&&!sv.icones,JSON.stringify(sv));
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));await pp.goto(base+"/portail.html");await pp.waitForTimeout(600);
 const home=await pp.evaluate(()=>({txt:document.body.innerText,svg:document.querySelectorAll("#parcours svg.i").length,atImg:document.querySelectorAll(".atout .ic img").length,atSvg:document.querySelectorAll(".atout .ic svg").length,ban:document.querySelectorAll(".card .ban img").length,vide:document.querySelectorAll(".card .ban.vide svg").length}));
 chk("PHO-4","accueil : plus aucun emoji ; icônes SVG sobres dans le parcours ; atout avec photo réelle, autres atouts avec icône ; carte de division avec photo, les autres avec un visuel sobre",!EMO.test(home.txt)&&home.svg>=8&&home.atImg===1&&home.atSvg===2&&home.ban===1&&home.vide===2,JSON.stringify({svg:home.svg,atImg:home.atImg,atSvg:home.atSvg,ban:home.ban,vide:home.vide,emo:(home.txt.match(EMO)||[])[0]}));
 const pages=await pp.evaluate(async()=>{const out={};const ids=["boutique","vendeur","societe","faq","contact","espace-client","espace-vendeur","act1","act2"];for(const p of ids){const el=document.querySelector('[data-go="'+p+'"]');if(!el)continue;el.click();await new Promise(r=>setTimeout(r,200));out[p]=document.getElementById("page").innerText}
  document.querySelector('[data-dd="espace-menu"]').click();out.menu=document.getElementById("espace-menu").innerText;return out});
 const bad=Object.entries(pages).filter(([k,v])=>EMO.test(v)).map(([k])=>k);
 chk("PHO-5","toutes les pages du portail (boutique, vendeur, société, FAQ, contact, espaces, activités, menu Mon espace) sans emoji",bad.length===0&&Object.keys(pages).length>=10,JSON.stringify({bad,n:Object.keys(pages)}));
 const sh=await pp.evaluate(async()=>{document.querySelector('[data-go="boutique"]').click();await new Promise(r=>setTimeout(r,250));return{th:document.querySelectorAll(".bp img.th").length,rows:document.querySelectorAll(".bp").length,txt:document.getElementById("shop").innerText}});
 chk("PHO-6","boutique : photo réelle du produit à côté de sa ligne (les autres produits sans photo), sans emoji",sh.rows===3&&sh.th===1&&!EMO.test(sh.txt),JSON.stringify({rows:sh.rows,th:sh.th}));
 await pp.evaluate(()=>{document.querySelector("#b_gpsb")});const msg=await pp.evaluate(async()=>{const e=id=>document.getElementById(id);document.querySelector('.bp [data-b="+"]').click();e("b_nom").value="Awa";e("b_tel").value="0102030405";e("b_zone").value=e("b_zone").options[1].value;e("b_zone").dispatchEvent(new Event("change"));e("b_q").value="Cocody";e("b_send").click();return{m:(document.querySelector("#shop textarea.msg")||{}).value||"",btn:document.getElementById("shop").innerText}});
 chk("PHO-7","message WhatsApp de commande sans emoji (marqueur d'import conservé) ; écran d'envoi sans emoji",/^Commande en ligne/.test(msg.m)&&/\[BOUTIQUE:[A-Za-z0-9_-]+\]/.test(msg.m)&&!EMO.test(msg.m)&&!EMO.test(msg.btn),JSON.stringify(msg).slice(0,300));
 const imp=await pd.evaluate(m=>{ME=S.users.find(u=>u.role==="admin");const r=webImporter(m);return{ok:r.ok.length,ko:r.ko}},msg.m);
 chk("PHO-8","la commande du portail s'importe toujours dans Distributions",imp.ok===1&&imp.ko.length===0,JSON.stringify(imp));
 const lien=await ps.evaluate(()=>{const u=pLien(pLire());const c=JSON.parse(decodeURIComponent(escape(atob(u.split("#p=")[1].replace(/-/g,"+").replace(/_/g,"/")))));return{at:c.atouts[0].photo,pp:Object.keys(c.photosProduits).length,ban:c.activites[0].banniere}});
 chk("PHO-9","lien partagé : photos importées non incluses (lien léger)",lien.at===""&&lien.pp===0&&lien.ban==="",JSON.stringify(lien));
 const pub=await ps.evaluate(async()=>{const D=await pDonnees();return{pp:Object.keys(D.cfg.photosProduits).length,at:!!D.cfg.atouts[0].photo}});
 chk("PHO-10","publication (portail-data.js / autonome) : photos de produits et d'atouts incluses",pub.pp===1&&pub.at,JSON.stringify(pub));
 const evil={nom:"X",atouts:[{titre:"t",texte:"x",photo:"javascript:alert(1)"}],photosProduits:{"P-X":"javascript:alert(1)","P-Y":"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="},activites:[{nom:"A",banniere:"javascript:alert(1)",actif:true}]};
 const h="#p="+Buffer.from(encodeURIComponent(JSON.stringify(evil)).replace(/%([0-9A-F]{2})/g,(m,x)=>String.fromCharCode(parseInt(x,16))),"binary").toString("base64");
 const p3=await (await b.newContext()).newPage();p3.on("pageerror",e=>errs.push("p3: "+e.message));await p3.goto(base+"/portail.html"+h);await p3.waitForTimeout(500);
 const sec=await p3.evaluate(()=>({img:document.querySelectorAll("#page img").length,src:[...document.querySelectorAll("#page [src]")].map(x=>x.getAttribute("src")).filter(x=>/javascript|svg/i.test(x)).length}));
 chk("PHO-11","sécurité : photos hostiles (javascript:, SVG) ignorées",sec.img===0&&sec.src===0,JSON.stringify(sec));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
