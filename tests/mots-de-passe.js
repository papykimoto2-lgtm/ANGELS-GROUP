/* Mots de passe à la place des codes PIN : moteur, connexion, migration, création et réinitialisation de comptes, Hub.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/mots-de-passe.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const open=async(file)=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(file+": "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+file);await p.waitForTimeout(600);return p};
 const FORT="Plouf-Tigre-82!";
 /* ---- moteur ---- */
 const pe=await open("transport.html");
 const m=await pe.evaluate(async()=>{const A=ANGELS_AUTH,g=A.generer(),r=await A.creer("Plouf-Tigre-82!"),leg={id:"u1",h:A.legacy("u1","1234")};
  return{faible:A.valider("abc"),courant:A.valider("password1234!A"),nom:A.valider("Kouamé2026!x",{nom:"Kouamé Yao"}),bon:A.valider("Plouf-Tigre-82!"),court:A.valider("Ab1!ab",{}),g:g.length,gok:A.valider(g)===null,ver:await A.verifier("Plouf-Tigre-82!",r),mauv:await A.verifier("plouf-tigre-82!",r),sel:r.s!==(await A.creer("Plouf-Tigre-82!")).s,it:r.it,leg:(await A.connecter(leg,"1234")),leg2:(await A.connecter(leg,"0000")),demo:(await A.connecter({id:"x",pwd:A.DEMO},A.DEMO_MDP)).ok}});
 chk("MP-1","moteur : politique (longueur, 3 types, mots courants, nom), générateur conforme, PBKDF2 salé (deux hachages différents), ancien PIN reconnu seulement pour migration",m.faible&&m.courant&&m.nom&&m.bon===null&&m.court&&m.g===14&&m.gok&&m.ver&&!m.mauv&&m.sel&&m.it>=100000&&m.leg.ok&&m.leg.legacy&&!m.leg2.ok&&m.demo,JSON.stringify(m));
 /* ---- Transport : connexion ---- */
 const login=async(p,uidv,pwd,sel)=>{await p.evaluate(({u,pw,sel})=>{const f=document.querySelector("#lf");const d=f.closest("details");if(d)d.open=true;f.u.value=u;(f[sel||"p"]).value=pw},{u:uidv,pw:pwd,sel});await p.click("#lf button");await p.waitForTimeout(1300)};
 const ov=async p=>p.evaluate(()=>{const o=document.getElementById("aa-ov");return o?{t:o.innerText.slice(0,200),n:!!o.querySelector("#aa-n"),m:o.querySelector("#aa-m")&&o.querySelector("#aa-m").textContent}:null});
 const fillOv=async(p,n,c,o)=>{if(o!==undefined)await p.fill("#aa-o",o);await p.fill("#aa-n",n);await p.fill("#aa-c",c);await p.click("#aa-ok");await p.waitForTimeout(1500)};
 const tp=await open("transport.html");const adm=await tp.evaluate(()=>S.users.find(u=>u.role==="admin").id);
 await login(tp,adm,"mauvais");const l1=await tp.evaluate(()=>({me:!!ME,msg:document.getElementById("le").textContent}));
 await login(tp,adm,"Demo@Angels2026");const l2=await tp.evaluate(()=>!!ME&&ME.role);
 chk("MP-2","Transport : mauvais mot de passe refusé avec un message générique ; mot de passe de démonstration accepté (PBKDF2)",!l1.me&&/incorrect/.test(l1.msg)&&l2==="admin",JSON.stringify([l1,l2]));
 /* blocage */
 const tb=await open("transport.html");const adm2=await tb.evaluate(()=>{S.settings.tentatives_max=3;return S.users.find(u=>u.role==="comptable").id});
 for(let i=0;i<3;i++)await login(tb,adm2,"mauvais"+i);await login(tb,adm2,"Demo@Angels2026");const bl=await tb.evaluate(()=>({me:!!ME,msg:document.getElementById("le").textContent}));
 chk("MP-3","Transport : trop d'essais = compte bloqué, même avec le bon mot de passe",!bl.me&&/bloqué/.test(bl.msg),JSON.stringify(bl));
 /* migration PIN */
 const tm=await open("transport.html");const cid=await tm.evaluate(()=>{const u=S.users.find(u=>u.role==="caissier");delete u.pwd;u.h=ANGELS_AUTH.legacy(u.id,"2222");save();return u.id});
 await login(tm,cid,"2222");const o1=await ov(tm);
 await fillOv(tm,"abc","abc");const e1=await tm.evaluate(()=>document.getElementById("aa-e").textContent);
 await fillOv(tm,FORT,"autre-chose");const e2=await tm.evaluate(()=>document.getElementById("aa-e").textContent);
 await fillOv(tm,FORT,FORT);const o2=await ov(tm);const st=await tm.evaluate(id=>{const u=S.users.find(x=>x.id===id);return{me:!!ME&&ME.id===id,pwd:!!u.pwd,h:u.h,chg:u.chg}},cid);
 chk("MP-4","migration : le dernier PIN ouvre un écran de création de mot de passe obligatoire (faible et confirmation fausse refusés) ; ensuite le PIN est effacé et connecté",o1&&o1.n&&/Créez votre mot de passe/.test(o1.t)&&/au moins 10/.test(e1)&&/confirmation/.test(e2)&&!o2&&st.me&&st.pwd&&st.h===undefined&&!st.chg,JSON.stringify({o1,e1,e2,o2,st}));
 const tm2=await open("transport.html");const cid2=await tm2.evaluate(()=>S.users.find(u=>u.role==="caissier").id);
 await tm2.evaluate(()=>{});await login(tm2,cid2,"2222");const rf=await tm2.evaluate(()=>!!ME);
 chk("MP-5","après migration : l'ancien PIN est refusé (comptes d'une autre session de test restent indépendants)",!rf,String(rf));
 /* création de compte, mot de passe temporaire, première connexion */
 const ta=await open("transport.html");await ta.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="users";render()});
 await ta.evaluate(()=>A["us.add"]());await ta.waitForTimeout(200);
 await ta.evaluate(()=>{const f=document.querySelector(".fm form")||document.querySelector("form");f.elements.nom.value="Aminata Test";f.elements.role.value="caissier";f.requestSubmit()});await ta.waitForTimeout(1500);
 const tmp=await ov(ta);const mdp=tmp&&tmp.m;
 const cr=await ta.evaluate(()=>{const u=S.users.find(x=>x.nom==="Aminata Test");return{pwd:!!(u&&u.pwd),chg:u&&u.chg,pin:!!document.querySelector('.fm input[name=pin]')}});
 chk("MP-6","création d'utilisateur : aucun champ PIN ni mot de passe saisi par l'administrateur ; mot de passe temporaire (14 caractères) montré une fois, compte marqué « à changer »",tmp&&mdp&&mdp.length===14&&cr.pwd&&cr.chg===true&&!cr.pin&&/une fois|plus affiché/i.test(tmp.t),JSON.stringify({tmp,cr}));
 await ta.click("#aa-ok");await ta.waitForTimeout(300);
 const nid=await ta.evaluate(()=>S.users.find(x=>x.nom==="Aminata Test").id);
 const tn=await open("transport.html");
 /* reporte le compte dans la 2e page : même origine => même localStorage */
 await tn.evaluate(()=>{});const idn=await tn.evaluate(()=>{const u=S.users.find(x=>x.nom==="Aminata Test");return u&&u.id});
 await login(tn,idn,mdp);const o3=await ov(tn);await fillOv(tn,"Autre-Mot-45!x","Autre-Mot-45!x");
 const f3=await tn.evaluate(()=>({me:!!ME&&ME.nom==="Aminata Test",chg:S.users.find(x=>x.nom==="Aminata Test").chg}));
 chk("MP-7","première connexion avec le mot de passe temporaire : changement obligatoire, puis session ouverte",o3&&/temporaire/.test(o3.t)&&f3.me&&!f3.chg,JSON.stringify({o3,f3}));
 /* changer mon mot de passe */
 await tn.evaluate(()=>A["mdp.me"]());await tn.waitForTimeout(300);
 await fillOv(tn,"Nouveau-Mdp-77!z","Nouveau-Mdp-77!z","faux");const ce=await tn.evaluate(()=>document.getElementById("aa-e").textContent);
 await fillOv(tn,"Nouveau-Mdp-77!z","Nouveau-Mdp-77!z","Autre-Mot-45!x");const ch=await ov(tn);
 chk("MP-8","changer mon mot de passe : l'ancien est exigé (faux refusé), le nouveau est enregistré",/actuel incorrect/.test(ce)&&!ch,JSON.stringify({ce,ch}));
 const tl=await open("transport.html");await login(tl,idn,"Autre-Mot-45!x");const old=await tl.evaluate(()=>!!ME);await login(tl,idn,"Nouveau-Mdp-77!z");const nw=await tl.evaluate(()=>!!ME);
 chk("MP-9","après changement : l'ancien mot de passe est refusé, le nouveau accepté",!old&&nw,JSON.stringify({old,nw}));
 /* réinitialisation */
 const tr=await open("transport.html");await tr.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="users";render()});
 const rid=await tr.evaluate(()=>S.users.find(x=>x.nom==="Aminata Test").id);
 await tr.evaluate(id=>A["us.pin"](id),rid);await tr.waitForTimeout(1500);const rt=await ov(tr);
 const rs=await tr.evaluate(id=>{const u=S.users.find(x=>x.id===id);return{chg:u.chg,pwd:!!u.pwd}},rid);await tr.click("#aa-ok");
 const tl2=await open("transport.html");await login(tl2,rid,"Nouveau-Mdp-77!z");const old2=await tl2.evaluate(()=>!!ME);await login(tl2,rid,rt&&rt.m);const ov2=await ov(tl2);
 chk("MP-10","réinitialisation : mot de passe temporaire généré et montré une fois, l'ancien est refusé, changement exigé à la connexion",rt&&rt.m&&rt.m.length===14&&rs.chg&&rs.pwd&&!old2&&ov2&&/temporaire/.test(ov2.t),JSON.stringify({rt,rs,old2,ov2}));
 /* Agro */
 const ag=await open("agro.html");const aadm=await ag.evaluate(()=>S.users.find(u=>u.role==="admin").id);
 await login(ag,aadm,"mauvais");const a1=await ag.evaluate(()=>!!ME);await login(ag,aadm,"Demo@Angels2026");const a2=await ag.evaluate(()=>!!ME&&ME.role);
 const ag2=await open("agro.html");const sid=await ag2.evaluate(()=>{const u=S.users.find(u=>u.role==="soigneur");delete u.pwd;u.h=ANGELS_AUTH.legacy(u.id,"2222");save();return u.id});await login(ag2,sid,"2222");const ao=await ov(ag2);
 chk("MP-11","Agro : connexion par mot de passe, migration d'un ancien PIN avec création obligatoire",!a1&&a2==="admin"&&ao&&/Créez votre mot de passe/.test(ao.t),JSON.stringify({a1,a2,ao}));
 const ag3=await open("agro.html");await ag3.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="admin";render()});await ag3.evaluate(()=>A["us.add"]());await ag3.waitForTimeout(200);
 await ag3.evaluate(()=>{const f=document.querySelector(".fm form")||document.querySelector("form");f.elements.nom.value="Moussa Agro";f.elements.role.value="soigneur";f.requestSubmit()});await ag3.waitForTimeout(1500);const at=await ov(ag3);
 chk("MP-12","Agro : création d'utilisateur avec mot de passe temporaire",at&&at.m&&at.m.length===14,JSON.stringify(at));
 /* Distributions */
 const di=await open("distribution.html");const dadm=await di.evaluate(()=>S.users.find(u=>u.role==="admin").id);
 await login(di,dadm,"mauvais","pin");const d1=await di.evaluate(()=>!!ME);await login(di,dadm,"Demo@Angels2026","pin");const d2=await di.evaluate(()=>!!ME&&ME.role);
 chk("MP-13","Distributions : connexion par mot de passe (mauvais refusé, démonstration accepté)",!d1&&d2==="admin",JSON.stringify({d1,d2}));
 const dl=await di.evaluate(async()=>{ACT.newLiv?ACT.newLiv():null;return null});
 const dc=await di.evaluate(async()=>{const forms=[];livForm(null);await new Promise(r=>setTimeout(r,200));const h=document.getElementById("modal").innerHTML;const pinField=/name="pin"/.test(h);const f=document.querySelector("#modal form");f.querySelector("[name=nom]").value="Livreur Test";f.querySelector("[name=tel]").value="0701020399";const z=f.querySelector("[name=zone]");if(z&&z.options.length)z.value=z.options[0].value;f.requestSubmit();await new Promise(r=>setTimeout(r,1800));const o=document.getElementById("aa-ov");const u=S.users.find(x=>x.nom==="Livreur Test");return{pinField,temp:o&&o.querySelector("#aa-m")&&o.querySelector("#aa-m").textContent.length,chg:u&&u.chg,pwd:!!(u&&u.pwd),legacy:u&&u.pin_h}});
 chk("MP-14","Distributions : création de livreur sans PIN, mot de passe temporaire généré",!dc.pinField&&dc.temp===14&&dc.chg===true&&dc.pwd&&dc.legacy===undefined,JSON.stringify(dc));
 const dd=await open("distribution.html");const dm=await dd.evaluate(async()=>{const u=S.users.find(x=>x.role==="vendeur");delete u.pwd;u.pin_h=ANGELS_AUTH.legacy(u.id,"5555");save();return u.id});
 await login(dd,dm,"5555","pin");const dov=await ov(dd);
 chk("MP-15","Distributions : migration d'un ancien PIN (vendeur) avec création obligatoire de mot de passe",dov&&/Créez votre mot de passe/.test(dov.t),JSON.stringify(dov));
 /* Hub / Paramètres */
 const hp=await open("parametres.html");
 const hubOpen=await hp.evaluate(()=>{document.querySelector('[data-um="trans"]')&&document.querySelector('[data-um="trans"]').click();return!!document.getElementById("ugate")});
 await hp.evaluate(()=>{const f=document.getElementById("ugate");f.pwd.value="Demo@Angels2026";f.requestSubmit()});await hp.waitForTimeout(1500);const un=await hp.evaluate(()=>({form:!!document.getElementById("uadd"),pinf:!!document.querySelector('#uadd input[name=pin]'),txt:document.getElementById("usr").innerText.slice(0,120)}));
 await hp.evaluate(()=>{const f=document.getElementById("uadd");f.nom.value="Hub User";f.role.value="caissier";f.requestSubmit()});await hp.waitForTimeout(1500);const ht=await ov(hp);await hp.click("#aa-ok");
 chk("MP-16","Hub : déverrouillage par le mot de passe d'un administrateur ; création d'un compte sans PIN, mot de passe temporaire montré une fois",hubOpen&&un.form&&!un.pinf&&ht&&ht.m&&ht.m.length===14,JSON.stringify({hubOpen,un,ht}));
 const hr=await hp.evaluate(async()=>{const G=JSON.parse(localStorage.getItem("angels_transport_v3"));const u=G.users.find(x=>x.nom==="Hub User");return{pwd:!!u.pwd,chg:u.chg,h:u.h}});
 chk("MP-17","Hub : le compte créé est enregistré dans l'application avec un mot de passe haché à changer",hr.pwd&&hr.chg===true&&hr.h===undefined,JSON.stringify(hr));
 const hl=await open("parametres.html");await hl.evaluate(()=>{const G=JSON.parse(localStorage.getItem("angels_transport_v3"));const u=G.users.find(x=>x.role==="admin");delete u.pwd;u.h=ANGELS_AUTH.legacy(u.id,"1234");localStorage.setItem("angels_transport_v3",JSON.stringify(G));document.querySelector('[data-um="trans"]').click()});await hl.waitForTimeout(300);
 await hl.evaluate(()=>{const f=document.getElementById("ugate");f.pwd.value="1234";f.requestSubmit()});await hl.waitForTimeout(1500);const lg=await hl.evaluate(()=>document.getElementById("usr").innerText);
 chk("MP-18","Hub : un ancien PIN n'ouvre plus la gestion des comptes (invitation à créer son mot de passe dans l'application)",/PIN ne sont plus acceptés/.test(lg),lg.slice(0,200));
 /* plus aucune trace de saisie de PIN */
 const fs2=require("fs");const reste=["transport.html","agro.html","distribution.html","parametres.html"].map(f=>[f,(fs2.readFileSync(path.join(root,f),"utf8").match(/Code PIN|Réinitialiser (le )?PIN|Nouveau PIN|PIN de connexion|PIN actuel|Changer mon PIN|PIN oublié|PIN \(\$\{/g)||[])]).filter(x=>x[1].length);
 chk("MP-19","plus aucun champ ni libellé de saisie de code PIN dans les trois applications et le Hub",!reste.length,JSON.stringify(reste));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.join(" | "):""));process.exit(ko||errs.length?1:0);
})();
