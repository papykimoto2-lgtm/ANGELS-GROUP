/* Type de colis choisi par le client sur le portail (Programmer ma livraison) : choix, consigne affichée, message, import dans Distributions avec le traitement du type. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));pp.on("dialog",d=>d.accept());
 const pd=await ctx.newPage();pd.on("pageerror",e=>errs.push("distribution: "+e.message));pd.on("dialog",d=>d.accept());await pd.goto(base+"/distribution.html");await pd.waitForTimeout(600);
 await pd.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");S.config.org="ANGEL'S DISTRIBUTION";S.config.whatsapp="0707070707";S.produits.filter(p=>p.actif).slice(0,2).forEach(p=>{p.en_ligne=true});save();majPortail(true)});
 await pp.goto(base+"/portail.html#/livraison");await pp.waitForTimeout(900);
 const s1=await pp.evaluate(()=>{const s=document.getElementById("l_tc");const o=[...s.options].map(x=>x.value);document.getElementById("l_tc").value="fragile";document.getElementById("l_tc").dispatchEvent(new Event("change"));return{o,n:document.getElementById("l_tcn").textContent}});
 chk("TCP-1","portail : liste « Type de colis » (6 types) avec la consigne du type choisi",s1.o.join()==="standard,courrier,fragile,aliment,valeur,lourd"&&/photographié/.test(s1.n),JSON.stringify(s1));
 const send=async tc=>pp.evaluate(async tc=>{const $=id=>document.getElementById(id);$("l_nom").value="Awa Koné";$("l_tel").value="0701020304";$("l_cz").selectedIndex=1;$("l_cq").value="Cocody Angré";$("l_dn").value="Marie Diallo";$("l_dt").value="0505050505";$("l_dz").selectedIndex=1;$("l_dq").value="Marcory";$("l_desc").value="Carton "+tc;$("l_tc").value=tc;$("l_date").value=$("l_date").min;$("l_send").click();await new Promise(r=>setTimeout(r,250));return document.querySelector("#lv textarea").value},tc);
 const m1=await send("aliment");
 chk("TCP-2","le message envoyé mentionne le type de colis et le marqueur contient le choix",/Type de colis : 🍲 Aliments/.test(m1)&&/\[LIVRAISON:/.test(m1),m1.slice(0,300));
 const imp=await pd.evaluate(t=>{const r=webImporter(t);const c=S.commandes.find(x=>x.numero===r.ok[0].numero);return{ko:r.ko,tc:c.type_colis,pri:c.priorite,obs:/Aliments/.test(c.obs)}},m1);
 chk("TCP-3","import : type « aliment » appliqué (priorité urgente par le type) et rappelé dans les observations",imp.ko.length===0&&imp.tc==="aliment"&&imp.pri==="urgente"&&imp.obs,JSON.stringify(imp));
 await pp.goto(base+"/portail.html#/livraison");await pp.waitForTimeout(500);await pp.evaluate(()=>{ST.ls="";livraisonRendre()});
 chk("TCP-4","type inconnu ou absent : traité comme « standard » (rien ne casse)",await pd.evaluate(()=>{const d={f:"TCX"+Date.now(),n:"Test",t:"0701020399",z:S.config.zones[0].nom,q:"Q",r:"",cz:S.config.zones[0].nom,cq:"M",cr:"",dn:"D",dt:"0707070707",desc:"x",tc:"inconnu",dat:new Date(Date.now()+864e5).toISOString().slice(0,10),cren:"tot",p:"c"};const r=progCreer(d);const c=S.commandes.find(x=>x.numero===r.numero);const d2=Object.assign({},d,{f:"TCY"+Date.now(),tc:undefined});const n2=progCreer(d2).numero,c2=S.commandes.find(x=>x.numero===n2);return c.type_colis==="standard"&&c2.type_colis==="standard"}),"");
 chk("TCP-5","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
