/* Protection des numéros clients : le livreur ne voit jamais le téléphone du client (étape 1), il passe par le bureau.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/masque-tel.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 const TEL="0707123456";
 const defaut=await p.evaluate(()=>{const l=S.livraisons.find(x=>x.statut==="en_cours"),c=cmd(l.commande_id),cl=cli(c.client_id);cl.tel="0707123456";const u=S.users.find(u=>u.role==="livreur"&&S.livreurs.find(v=>v.user_id===u.id&&v.id===l.livreur_id));ME=u;render();const h=document.getElementById("app").innerHTML;return{opt:S.config.masque_tel,tel:/href="tel:0707123456"/.test(h),bureau:/Joindre le client \(via le bureau\)/.test(h),pont:S.config.appel_pont&&S.config.appel_pont.actif}});
 chk("MQ-0","par défaut (ancien système conservé) : protection et pont désactivés, le livreur appelle le client directement comme avant",defaut.opt===false&&defaut.tel&&!defaut.bureau&&!defaut.pont,JSON.stringify(defaut));
 await p.evaluate(()=>{S.config.masque_tel=true});
 const prep=await p.evaluate(TEL=>{const l=S.livraisons.find(x=>x.statut==="en_cours"),c=cmd(l.commande_id),cl=cli(c.client_id);cl.tel=TEL;c.adr.instructions="Appelez le client au 07 07 12 34 56 à l'arrivée";c.adr.repere="Près du kiosque, tél. +225 07 07 12 34 56";c.obs="Client joignable au 0707123456";
  window.__l=l.id;window.__c=c.id;ME=S.users.find(u=>u.id===livreurOf({id:null,nom:""})?.user_id)||S.users.find(u=>u.role==="livreur"&&S.livreurs.find(v=>v.user_id===u.id&&v.id===l.livreur_id));return{ok:!!ME,role:ME&&ME.role,num:c.numero}},TEL);
 await p.evaluate(()=>{render()});await p.waitForTimeout(300);
 const v=await p.evaluate(()=>({txt:document.getElementById("app").innerText,html:document.getElementById("app").innerHTML}));
 chk("MQ-1","livreur : le numéro du client n'apparaît ni à l'écran ni dans le code de la page (téléphone, instructions, repère, observations)",prep.role==="livreur"&&!/0707123456|07 07 12 34 56|07 07 12/.test(v.txt+v.html)&&!/href="tel:0707/.test(v.html)&&/Joindre le client/.test(v.txt),JSON.stringify(prep)+v.txt.slice(0,300));
 const rq=await p.evaluate(async()=>{ACT.lAppel(window.__l);await new Promise(r=>setTimeout(r,200));const sel=document.querySelector("#modal select[name=motif]");const has=!!sel;document.querySelector("#modal form")&&document.querySelector("#modal form").requestSubmit();await new Promise(r=>setTimeout(r,300));const n1=(S.rappels||[]).length;ACT.lAppel(window.__l);await new Promise(r=>setTimeout(r,200));document.querySelector("#modal form")&&document.querySelector("#modal form").requestSubmit();await new Promise(r=>setTimeout(r,300));return{has,n1,n2:(S.rappels||[]).length,m:(S.rappels||[])[0]&&S.rappels[0].motif}});
 chk("MQ-2","le livreur demande au bureau de joindre le client : une demande enregistrée, la même demande répétée est refusée",rq.has&&rq.n1===1&&rq.n2===1,JSON.stringify(rq));
 const sup=await p.evaluate(async()=>{ME=S.users.find(u=>u.role==="superviseur"||u.role==="admin");view="notifs";render();await new Promise(r=>setTimeout(r,200));const h=document.getElementById("app").innerHTML,t=document.getElementById("app").innerText;const al=alertes?alertes().some(a=>/demandent à joindre/.test(a.m)):null;
  document.querySelector('[data-act="rapOk"]').click();await new Promise(r=>setTimeout(r,200));return{tel:/href="tel:0707123456"/.test(h),titre:/joindre un client/.test(t),al,reste:(S.rappels||[]).filter(r=>r.statut==="ouvert").length}});
 chk("MQ-3","superviseur : voit la demande avec le numéro à appeler, alerte au tableau de bord, « Traité » la clôt",sup.tel&&sup.titre&&sup.al&&sup.reste===0,JSON.stringify(sup));
 const doc=await p.evaluate(()=>{const c=cmd(window.__c),cl=cli(c.client_id);S.config.etiq_tel=true;c.colis=[{n:1,tok:"ABCDE"}];let lab="",bl="";try{lab=labelsHTML(c)}catch(e){lab="EXC "+e.message}
  try{bl=docHTML({type:"bl",numero:"BL-T1",date:new Date().toISOString(),client:{nom:cl.nom,tel:cl.tel},commande_id:c.id,adr:c.adr,lignes:[],total:0,tva:0,ht:0})}catch(e){bl="EXC "+e.message}
  S.config.masque_tel=false;let lab2="",bl2="";try{lab2=labelsHTML(c)}catch(e){}try{bl2=docHTML({type:"bl",numero:"BL-T1",date:new Date().toISOString(),client:{nom:cl.nom,tel:cl.tel},commande_id:c.id,adr:c.adr,lignes:[],total:0,tva:0,ht:0})}catch(e){}S.config.masque_tel=true;
  return{blrep:/07 07 12 34 56|0707123456/.test(bl.replace(/.*Destination/s,"Destination").slice(0,300)),lab:/0707123456/.test(lab),bl:/0707123456/.test(bl),lab2:/0707123456/.test(lab2),bl2:/0707123456/.test(bl2),e:(lab+bl).startsWith("EXC")?(lab+bl).slice(0,120):""}});
 chk("MQ-4","étiquette colis et bon de livraison : sans téléphone du client quand la protection est active ; protection désactivable (paramètre)",!doc.lab&&!doc.bl&&!doc.blrep&&doc.lab2&&doc.bl2,JSON.stringify(doc));
 const off=await p.evaluate(async()=>{S.config.masque_tel=false;ME=S.users.find(u=>u.role==="livreur"&&S.livreurs.find(v=>v.user_id===u.id&&v.id===S.livraisons.find(x=>x.id===window.__l).livreur_id));render();await new Promise(r=>setTimeout(r,200));const h=document.getElementById("app").innerHTML;S.config.masque_tel=true;return/href="tel:0707123456"/.test(h)});
 chk("MQ-5","option désactivée dans les paramètres : l'appel direct du livreur revient",off===true,off);
 const gl=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="livreur"&&S.livreurs.find(v=>v.user_id===u.id&&v.id===S.livraisons.find(x=>x.id===window.__l).livreur_id));const c=cmd(window.__c);geoLinkModal(c.client_id,c.adr.id,c.numero);const h=document.getElementById("modal").innerHTML;return{wa:/wa\.me/.test(h),btn:/lAskBureau/.test(h),num:/0707123456/.test(h)}});
 chk("MQ-6","lien de partage de position : le livreur ne reçoit ni lien WhatsApp ni numéro, il demande au bureau",!gl.wa&&gl.btn&&!gl.num,JSON.stringify(gl));
 /* Étape 2 : pont téléphonique (serveur simulé) */
 const pont=await p.evaluate(async TEL=>{const calls=[];window.fetch=async(u,o)=>{calls.push({u:String(u),h:o&&o.headers||{},b:o&&o.body?JSON.parse(o.body):null});return{ok:true,status:200,json:async()=>({ok:true,message:"Votre téléphone va sonner"})}};
  S.config.appel_pont={actif:true,url:"https://fn.example/functions/v1/",cle_admin:"ADM-KEY"};const l=S.livraisons.find(x=>x.id===window.__l),c=cmd(l.commande_id),lv=liv(l.livreur_id);delete l.pont_ts;
  ME=S.users.find(u=>u.role==="admin");_pontLast=0;await pontSync();const tk=calls.filter(x=>/appel-ticket$/.test(x.u)&&x.b&&x.b.commande===c.numero)[0];
  const sync={url:tk&&tk.u,adm:tk&&tk.h["x-admin-key"],ct:tk&&tk.b.client_tel,lt:tk&&tk.b.livreur_tel,cle:tk&&tk.b.cle&&tk.b.cle.length,pushed:!!l.pont_ts};
  calls.length=0;ME=S.users.find(u=>u.id===lv.user_id);render();ACT.lAppel(l.id);await new Promise(r=>setTimeout(r,200));const btn=!!document.querySelector('#modal [data-act="pontAppeler"]');
  await ACT.pontAppeler(l.id);const ap=calls[calls.length-1];
  const call={btn,u:ap&&ap.u,body:ap&&JSON.stringify(ap.b),adm:ap&&ap.h["x-admin-key"]};
  calls.length=0;ME=S.users.find(u=>u.role==="admin");l.statut="livree";_pontLast=0;await pontSync();const cl=calls.filter(x=>x.b&&x.b.action==="clore"&&x.b.commande===c.numero)[0];
  const clos={ok:!!cl,flag:!!l.pont_clos};
  S.config.appel_pont={actif:false,url:"",cle_admin:""};calls.length=0;_pontLast=0;await pontSync();return{sync,call,clos,off:calls.length}},TEL);
 chk("MQ-7","pont : le bureau enregistre le ticket (clé d'administration, numéro du client) ; le livreur n'envoie jamais le numéro ni la clé d'administration",pont.sync.url==="https://fn.example/functions/v1/appel-ticket"&&pont.sync.adm==="ADM-KEY"&&pont.sync.ct===TEL&&pont.sync.cle===32&&pont.sync.pushed&&pont.call.btn&&pont.call.u==="https://fn.example/functions/v1/appel-pont"&&!pont.call.body.includes("0707")&&!pont.call.adm&&/"cle":/.test(pont.call.body),JSON.stringify(pont));
 chk("MQ-8","pont : l'autorisation est fermée dès que la livraison est terminée ; pont désactivé = aucun appel réseau",pont.clos.ok&&pont.clos.flag&&pont.off===0,JSON.stringify(pont));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.join(" | "):""));process.exit(ko||errs.length?1:0);
})();
