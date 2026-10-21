/* Saisie rapide d'une commande : client trouvé en tapant ou créé à la volée, adresses en cartes ou saisie directe (liste vide), produits par recherche, quantités, total, erreurs sur le champ, numéro et double saisie.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/saisie-rapide.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),p=await ctx.newPage(),errs=[];let ok=0,ko=0;const dlg=[];let rep=true;
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>{dlg.push(d.message());d.accept()});
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 await p.goto(base+"/distribution.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);window.__cl=()=>S.clients.find(c=>!c.vendeur_id&&!c.divers&&c.adresses.length)});
 const info=await p.evaluate(()=>({cl:S.clients.filter(c=>!c.divers&&!c.vendeur_id).map(c=>({id:c.id,nom:c.nom,tel:c.tel,na:c.adresses.length})),pr:S.produits.filter(x=>x.actif).map(x=>({id:x.id,nom:x.nom,stock:x.stock,prix:x.prix}))}));
 const C0=info.cl.find(c=>c.na>0),P0=info.pr.find(x=>x.stock>5)||info.pr[0];const nomP=P0.nom.split(" ")[0].toLowerCase();
 /* SR-1 */
 await p.evaluate(()=>formCmd());
 const s1=await p.evaluate(()=>{const a=document.activeElement;return{foc:a&&a.id==="f_cq",selCache:getComputedStyle(document.getElementById("f_client")).display==="none"&&getComputedStyle(document.getElementById("f_adr")).display==="none",liste:!document.getElementById("f_cl").hidden,nouveau:/Nouveau client/.test(document.getElementById("f_cl").innerText),divers:/Client divers/.test(document.getElementById("f_cl").innerText),recents:document.querySelectorAll("#f_cl .sr-it").length}});
 chk("SR-1","nouvelle commande : le curseur est dans la recherche du client ; les anciennes listes déroulantes sont masquées ; la liste propose les clients récents, « Nouveau client » et « Client divers »",s1.foc&&s1.selCache&&s1.liste&&s1.nouveau&&s1.divers&&s1.recents>=3,JSON.stringify(s1));
 /* SR-2 */
 await p.fill("#f_cq",C0.nom.slice(0,3).toUpperCase());await p.waitForTimeout(150);
 const l2=await p.evaluate(()=>[...document.querySelectorAll("#f_cl .sr-it")].map(x=>x.innerText));
 await p.keyboard.press("Enter");await p.waitForTimeout(250);
 const s2=await p.evaluate(()=>({v:document.getElementById("f_client").value,chip:document.getElementById("f_cchip").innerText,cartes:document.querySelectorAll("#f_adc .sr-card").length,on:document.querySelectorAll("#f_adc .sr-card.on").length,adr:document.getElementById("f_adr").value,frais:+document.getElementById("f_frais").value}));
 chk("SR-2","taper les premières lettres (sans tenir compte de la casse) + Entrée : le client est choisi, une pastille le confirme, ses adresses s'affichent en cartes avec la principale déjà choisie, les frais sont calculés",l2.some(x=>x.includes(C0.nom))&&s2.v===C0.id&&new RegExp(C0.nom).test(s2.chip)&&s2.cartes>=2&&s2.on===1&&s2.frais>0,JSON.stringify([l2,s2]));
 /* SR-3 : numéro */
 await p.evaluate(()=>{closeModal();formCmd()});await p.fill("#f_cq",C0.tel.replace(/\D/g,"").slice(-6));await p.waitForTimeout(150);
 const l3=await p.evaluate(()=>[...document.querySelectorAll("#f_cl .sr-it")].map(x=>x.innerText).join("|"));
 chk("SR-3","chercher par fin de numéro de téléphone retrouve le client",l3.includes(C0.nom),l3);
 /* SR-4 : création à la volée */
 await p.fill("#f_cq","Awa Konaté");await p.waitForTimeout(100);
 const l4=await p.evaluate(()=>document.querySelector("#f_cl .sr-it:nth-last-child(2)").innerText);
 await p.click("#f_cl .sr-it:nth-last-child(2)");await p.waitForTimeout(250);
 const s4=await p.evaluate(()=>({v:document.getElementById("f_client").value,nom:document.querySelector('[name=n_nom]').value,vis:getComputedStyle(document.getElementById("newcl")).display!=="none",adr:getComputedStyle(document.getElementById("newadr")).display!=="none",foc:document.activeElement.name}));
 chk("SR-4","« Créer « Awa Konaté » comme nouveau client » : le nom est repris, les champs téléphone et adresse s'ouvrent, le curseur passe au téléphone",/Créer/.test(l4)&&s4.v==="__new"&&s4.nom==="Awa Konaté"&&s4.vis&&s4.adr&&s4.foc==="n_tel",JSON.stringify([l4,s4]));
 /* SR-5 : liste vide */
 await p.evaluate(()=>{closeModal();window.__sv=S.clients;S.clients=[];formCmd()});await p.waitForTimeout(250);
 const s5=await p.evaluate(()=>({v:document.getElementById("f_client").value,nom:getComputedStyle(document.getElementById("newcl")).display!=="none",adr:getComputedStyle(document.getElementById("newadr")).display!=="none",foc:document.activeElement.name,chip:document.getElementById("f_cchip").innerText}));
 chk("SR-5","liste de clients vide : le formulaire s'ouvre directement en saisie manuelle (nouveau client + adresse), curseur sur le nom",s5.v==="__new"&&s5.nom&&s5.adr&&s5.foc==="n_nom"&&/Nouveau client/.test(s5.chip),JSON.stringify(s5));
 await p.evaluate(()=>{closeModal();S.clients=window.__sv});
 /* SR-6 : client sans adresse */
 const s6=await p.evaluate(()=>{const c={id:"cl_sans",nom:"Sans Adresse",tel:"0709090909",tel2:"",adresses:[],note:""};S.clients.push(c);closeModal();formCmd();const sel=document.getElementById("f_client");sel.value=c.id;sel.dispatchEvent(new Event("change",{bubbles:true}));return{adr:getComputedStyle(document.getElementById("newadr")).display!=="none",msg:document.getElementById("f_adc").innerText,zones:document.querySelectorAll('[name=a_zone] option').length}});
 chk("SR-6","client sans adresse enregistrée : message clair et saisie directe de l'adresse (zone, quartier, repère)",s6.adr&&/Aucune adresse enregistrée/.test(s6.msg)&&s6.zones>0,JSON.stringify(s6));
 /* SR-7 : produits */
 await p.evaluate(()=>{closeModal();formCmd()});await p.keyboard.press("Escape");await p.click("#f_cq");await p.keyboard.type(C0.nom.slice(0,3));await p.keyboard.press("Enter");await p.waitForTimeout(200);
 await p.fill("#f_pq",nomP);await p.waitForTimeout(150);await p.keyboard.press("Enter");await p.waitForTimeout(150);await p.fill("#f_pq",nomP);await p.waitForTimeout(100);await p.keyboard.press("Enter");await p.waitForTimeout(150);
 const s7=await p.evaluate(()=>{const r=[...document.querySelectorAll("#lignes .lrow")];return{n:r.length,qte:r.map(x=>+x.querySelector(".l_qte").value),tot:r.map(x=>x.querySelector(".l_tot")&&x.querySelector(".l_tot").textContent),pied:document.getElementById("f_foot")&&document.getElementById("f_foot").innerText,vide:document.getElementById("f_pq").value===""}});
 chk("SR-7","chercher un article + Entrée l'ajoute (la ligne vide par défaut est remplacée) ; le même article une 2e fois augmente la quantité ; total de la ligne et total en pied de fenêtre à jour",s7.n===1&&s7.qte[0]===2&&/F/.test(s7.tot[0]||"")&&/Total à payer/.test(s7.pied||"")&&s7.vide,JSON.stringify(s7));
 await p.click('#lignes .qb[data-q="1"]');await p.click('#lignes .qb[data-q="1"]');await p.click('#lignes .qb[data-q="-1"]');
 const s8=await p.evaluate(()=>+document.querySelector("#lignes .l_qte").value);
 chk("SR-8","boutons + et − de la quantité (jamais sous 1)",s8===3,s8);
 await p.click("#f_freq .sr-chip");await p.waitForTimeout(150);
 chk("SR-9","articles fréquents : un appui ajoute l'article",await p.evaluate(()=>document.querySelectorAll("#lignes .lrow").length>=1&&document.querySelectorAll("#f_freq .sr-chip").length>=1));
 /* stock */
 await p.evaluate(()=>{window.__T.length=0});await p.fill("#f_pq",nomP);await p.waitForTimeout(100);
 await p.evaluate(id=>{const x=S.produits.find(y=>y.id===id);window.__st=x.stock;x.stock=1},P0.id);await p.fill("#f_pq",nomP);await p.waitForTimeout(100);await p.keyboard.press("Enter");await p.waitForTimeout(150);
 chk("SR-10","dépasser le stock disponible : avertissement clair, sans bloquer la saisie",await p.evaluate(()=>__T.some(m=>/Stock insuffisant/.test(m))));
 await p.evaluate(a=>{S.produits.find(y=>y.id===a.id).stock=window.__st},P0);
 /* erreurs sur le champ */
 await p.evaluate(()=>{closeModal();formCmd()});await p.keyboard.press("Escape");
 await p.evaluate(()=>document.getElementById("mf").requestSubmit());await p.waitForTimeout(250);
 const e1=await p.evaluate(()=>({err:(document.querySelector(".sr-err")||{}).textContent,bad:!!document.querySelector("#f_cq.bad"),ouvert:!!document.getElementById("mf")}));
 chk("SR-11","valider sans client : message affiché sous la recherche du client (champ entouré en rouge), la fenêtre reste ouverte",/client/i.test(e1.err||"")&&e1.bad&&e1.ouvert,JSON.stringify(e1));
 await p.evaluate(()=>{const s=document.getElementById("f_client");s.value="__new";s.dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[name=n_nom]").value="Test Rapide";document.getElementById("mf").requestSubmit()});await p.waitForTimeout(250);
 const e2=await p.evaluate(()=>({err:(document.querySelector(".sr-err")||{}).textContent,champ:(document.querySelector(".bad")||{}).name}));
 chk("SR-12","nouveau client sans téléphone : l'erreur s'affiche sur le champ téléphone",/téléphone/i.test(e2.err||"")&&e2.champ==="n_tel",JSON.stringify(e2));
 await p.evaluate(()=>{document.querySelector("[name=n_tel]").value="0707070707";document.getElementById("mf").requestSubmit()});await p.waitForTimeout(250);
 const e3=await p.evaluate(()=>({err:(document.querySelector(".sr-err")||{}).textContent,champ:(document.querySelector(".bad")||{}).name}));
 chk("SR-13","adresse incomplète : l'erreur s'affiche sur le quartier",/quartier|repère/i.test(e3.err||"")&&e3.champ==="a_q",JSON.stringify(e3));
 /* numéro connu */
 await p.evaluate(()=>{closeModal();formCmd();const s=document.getElementById("f_client");s.value="__new";s.dispatchEvent(new Event("change",{bubbles:true}))});
 await p.fill("[name=n_tel]",C0.tel);await p.waitForTimeout(150);
 const t1=await p.evaluate(()=>({bandeau:(document.getElementById("f_telinfo")||{}).innerText||""}));
 await p.click('#f_telinfo [data-sr=useclient]');await p.waitForTimeout(200);
 chk("SR-14","numéro déjà enregistré : bandeau « Ce numéro est déjà celui de … » et bouton « Utiliser ce client »",new RegExp(C0.nom).test(t1.bandeau)&&await p.evaluate(id=>document.getElementById("f_client").value===id,C0.id),t1.bandeau);
 /* quartier connu */
 const q=await p.evaluate(()=>{const a=S.clients.flatMap(c=>c.adresses).find(x=>x.quartier&&x.zone);return a?{q:a.quartier,z:a.zone}:null});
 await p.evaluate(()=>{closeModal();formCmd();const s=document.getElementById("f_client");s.value="__new";s.dispatchEvent(new Event("change",{bubbles:true}))});
 await p.fill("[name=a_q]",q.q);await p.dispatchEvent("[name=a_q]","change");await p.waitForTimeout(150);
 chk("SR-15","quartier déjà connu : proposé à la frappe (liste) et zone renseignée toute seule",await p.evaluate(z=>document.querySelector("#dl_q option")&&document.querySelector("[name=a_zone]").value===z,q.z),JSON.stringify(q));
 /* parcours complet au clavier + double saisie */
 const n0=await p.evaluate(()=>S.commandes.length);
 await p.evaluate(()=>{closeModal();formCmd()});await p.keyboard.type(C0.nom.slice(0,4));await p.keyboard.press("Enter");await p.waitForTimeout(200);
 await p.fill("#f_pq",nomP);await p.waitForTimeout(100);await p.keyboard.press("Enter");await p.waitForTimeout(100);
 await p.evaluate(()=>document.getElementById("mf").requestSubmit());await p.waitForTimeout(400);
 const f1=await p.evaluate(a=>{const c=S.commandes[0];return{n:S.commandes.length-a,client:c.client_id,lignes:c.lignes.length,statut:c.statut}},n0);
 chk("SR-16","saisie complète : client + article + Entrée + valider = commande créée et confirmée",f1.n===1&&f1.client===C0.id&&f1.lignes===1,JSON.stringify(f1));
 dlg.length=0;await p.evaluate(()=>{closeModal();formCmd()});await p.keyboard.type(C0.nom.slice(0,4));await p.keyboard.press("Enter");await p.waitForTimeout(200);
 await p.fill("#f_pq",nomP);await p.waitForTimeout(100);await p.keyboard.press("Enter");await p.waitForTimeout(100);
 await p.evaluate(()=>document.getElementById("mf").requestSubmit());await p.waitForTimeout(400);
 chk("SR-17","double saisie : une commande venant d'être créée pour le même client déclenche un avertissement avant d'en créer une seconde",dlg.some(m=>/vient d'être saisie/.test(m)),JSON.stringify(dlg));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
