/* Réservation d'un véhicule avec chauffeur depuis le portail : offres et plages publiées par Transport (même appareil), formulaire, estimation, créneau complet signalé, message [RESERVATION:…], import dans Transport.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/mad-portail.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const pt=await ctx.newPage();pt.on("pageerror",e=>errs.push("transport: "+e.message));pt.on("dialog",d=>d.accept());await pt.goto(base+"/transport.html");await pt.waitForTimeout(600);
 const D=await pt.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);const d=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
  const v=Object.assign({id:uid("v"),immat:"TEST 1",marque:"Toyota",modele:"Camry",annee:2020,places:4,statut:"actif",km:1000,mad:"1",categorie:"berline"});S.vehicles.push(v);const c={id:uid("d"),nom:"TEST Chauffeur",tel:"0700000000",mad:"1",permis_fin:d(400)};S.drivers.push(c);
  const r=madCreer({nom:"Client privé SECRET",tel:"0700112233",type_vehicule:"berline",date_debut:d(2),date_fin:d(2),h_debut:"06:00",h_fin:"22:00",depart:"Cocody"},"bureau");madConfirmer(r,{vehicle_id:v.id,driver_id:c.id});
  const ok=await madPublier(true);return{ok,jour:d(2),libre:d(3)}});
 chk("MP-1","Transport publie les offres et plages complètes pour le portail du même appareil",D.ok===true);
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));await pp.goto(base+"/portail.html#/chauffeur");await pp.waitForTimeout(900);
 const R=await pp.evaluate(async d=>{const o={};o.mad=!!MAD&&MAD.offres.length;o.json=JSON.stringify(MAD||{});o.menu=document.body.innerText;o.form=!!document.getElementById("r_cat");
  if(!o.form)return o;const $r=id=>document.getElementById(id),ch=(id,v)=>{$r(id).value=v;$r(id).dispatchEvent(new Event("change"))};
  ch("r_cat","berline");o.offres=[...$r("r_off").options].map(x=>x.textContent);ch("r_d1",d.jour);ch("r_d2",d.jour);ch("r_tr","journee");o.pris=$r("r_dispo").innerText;o.est1=$r("r_est").innerText;
  ch("r_d1",d.libre);ch("r_d2",d.libre);o.libre=$r("r_dispo").innerText;o.est2=$r("r_est").innerText;ch("r_d2",d.libre);
  $r("r_send").click();o.err1=$r("r_err").innerText;$r("r_nom").value="Koffi Yao";$r("r_tel").value="0102030405";$r("r_dep").value="Aéroport";$r("r_dst").value="Grand-Bassam";$r("r_soc").value="Entreprise X";ch("r_nu","1");ch("r_pax","3");
  $r("r_send").click();o.fin=ST.rs;o.msg=ST.rmsg;o.ref=ST.rref;o.ecran=document.getElementById("rs").innerText;return o},D);
 chk("MP-2","le portail lit l'offre publiée : catégories, formules, tranches ; la page est dans le menu ; aucune donnée personnelle reçue",R.mad>0&&R.form&&R.offres.length>=3&&/Berline avec chauffeur — journée/.test(R.offres.join())&&/RÉSERVER UN CHAUFFEUR|VÉHICULE AVEC CHAUFFEUR/i.test(R.menu)&&!/SECRET|0700112233/.test(R.json),JSON.stringify([R.mad,R.form,R.offres]));
 chk("MP-3","créneau déjà complet signalé (sans bloquer), créneau libre sans alerte ; estimation de prix mise à jour",/déjà pris/.test(R.pris)&&!/déjà pris/.test(R.libre)&&/Estimation : 45 000 F/.test(R.est1.replace(/\s/g," ").replace(/ /g," "))||/Estimation : 45[  ]000 F/.test(R.est1),R.pris+" || "+R.est1+" || "+R.libre);
 chk("MP-4","contrôles avant envoi (nom, téléphone, lieu) ; message prêt à envoyer avec référence RS-…, estimation et marqueur [RESERVATION:…]",/nom|Nom/.test(R.err1)&&R.fin==="fin"&&/^RS-[A-Z0-9]{6}$/.test(R.ref)&&/\[RESERVATION:[A-Za-z0-9_-]+\]/.test(R.msg)&&/estimation/.test(R.msg)&&/Dernière étape/.test(R.ecran),R.err1+" | "+R.msg);
 const imp=await pt.evaluate(msg=>{const o={};const n0=S.mad_resas.length;document.querySelectorAll(".md").forEach(m=>m.remove());A["mad.import"]();document.getElementById("mad_txt").value="Bonjour\n"+msg+"\nMerci";A["mad.import.go"]();const r=S.mad_resas.find(x=>x.client.nom==="Koffi Yao");o.r=r&&{statut:r.statut,src:r.source,ref:r.ref_portail,soc:r.client.societe,dep:r.depart,dst:r.destination,pax:r.passagers,nu:r.nuitees,total:r.total,off:madOffre(r.offre_id).nom,jours:r.date_debut===r.date_fin};o.n=S.mad_resas.length-n0;
  document.querySelectorAll(".md").forEach(m=>m.remove());A["mad.import"]();document.getElementById("mad_txt").value=msg;A["mad.import.go"]();o.dbl=S.mad_resas.length-n0;return o},R.msg);
 chk("MP-5","import dans Transport : demande créée « à traiter » avec société, trajet, passagers, nuitée et formule choisie ; prix = estimation du portail ; second import ignoré",imp.n===1&&imp.r&&imp.r.statut==="demande"&&imp.r.src==="portail"&&imp.r.soc==="Entreprise X"&&imp.r.dep==="Aéroport"&&imp.r.dst==="Grand-Bassam"&&imp.r.pax===3&&imp.r.nu===1&&imp.r.total===55000&&/journée/.test(imp.r.off)&&imp.dbl===1,JSON.stringify(imp));
 const st=await pt.evaluate(()=>{const o=document.querySelector(".md");return[!!document.querySelector("#mad_txt"),S.mad_resas.filter(x=>x.statut==="demande").length]});
 chk("MP-6","aucune erreur de script (Transport et portail)",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
