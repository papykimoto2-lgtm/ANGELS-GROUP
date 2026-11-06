/* Transport : Utilisateurs et droits → bouton « Modifier » (nom, rôle) avec garde-fous. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200);r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[],D=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>{D.push(d.message());d.accept()});
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const r=await p.evaluate(async()=>{const o={};
  const adm=S.users.find(u=>u.role==="admin"&&u.actif);ME=adm;
  S.users.push({id:"u_t1",nom:"Compta Test",role:"caissier",actif:true,chg:false},{id:"u_t2",nom:"Autre Test",role:"caissier",actif:true,chg:false});
  view="users";render();o.bouton=document.body.innerHTML.includes('data-a="us.edit"');
  const sub=async(nom,role)=>{const f=document.querySelector("form");if(!f)return"noform";f.elements.nom.value=nom;if(role)f.elements.role.value=role;f.requestSubmit();await new Promise(r=>setTimeout(r,60));return document.querySelector("form")?"ouvert":"ferme"};
  A["us.edit"]("u_t1");o.val=document.querySelector("form").elements.nom.value;
  o.ok=await sub("Compta Renommé","comptable");const u=S.users.find(x=>x.id==="u_t1");o.maj=u.nom==="Compta Renommé"&&u.role==="comptable";
  o.audit=S.audit.some(a=>a.a==="Utilisateur modifié"&&/Compta Renommé/.test(a.d));
  A["us.edit"]("u_t1");o.dup=await sub("Autre Test","comptable");document.querySelectorAll("form [data-x]")[0]&&document.querySelector(".fm")&&document.querySelector(".fm").remove();
  const nomU=S.users.find(x=>x.id==="u_t1").nom;o.dupOk=nomU==="Compta Renommé";
  A["us.edit"](adm.id);o.moi=await sub(adm.nom,"caissier");const a2=S.users.find(x=>x.id===adm.id);o.moiRole=a2.role==="admin";
  return o});
 chk("MU-1","bouton Modifier présent sur chaque ligne",r.bouton===true,JSON.stringify(r));
 chk("MU-2","formulaire prérempli, nom et rôle modifiés, action tracée",r.val==="Compta Test"&&r.ok==="ferme"&&r.maj&&r.audit,JSON.stringify(r));
 chk("MU-3","nom déjà utilisé refusé",r.dupOk===true&&D.some(m=>/déjà ce nom/.test(m)),JSON.stringify([r,D]));
 chk("MU-4","son propre rôle reste inchangé",r.moiRole===true,JSON.stringify(r));
 chk("MU-5","aucune erreur JS",E.length===0,E.join("|"));
 console.log(ok+" PASS / "+ko+" FAIL");await b.close();srv.close();process.exit(ko?1:0)})();
