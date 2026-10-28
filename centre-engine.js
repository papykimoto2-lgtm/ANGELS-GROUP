/* Centre de livraison : conduite active de la journée.
   Tour de contrôle, affectation guidée, groupage en tournées, alertes, créneaux promis, confirmation client, échecs, dossier de preuve,
   contrôle des colis au départ, planning des collectes, performance, clôture de journée, sons et écran allumé.
   Chargé avant le script principal de distribution.html, qui appelle centreInit() quand S, VIEWS et ACT existent. S'appuie sur ses fonctions (cmd, liv, affecter, creerTournee, colPlanLocal…). */
let CEN_DIRECT=false;   /* vrai pendant la saisie d'une livraison par le centre (circuit direct) : pas de contrôle d'aptitude du livreur, pas de notification de mission ni de message client intermédiaire */
const CEN_DEF={max_tournee:8,cout_unit:1800,cout_groupe:1000,immobile_min:15,offre_min:3,pret_min:20,collecte_retard_min:15,rayon_km:3,auto_col:true,veille:true};
const CEN_SLOTS=[["08:00","10:00"],["10:00","12:00"],["12:00","14:00"],["14:00","16:00"],["16:00","18:00"]];
const CEN_JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const cenCfg=()=>Object.assign({},CEN_DEF,(S&&S.config&&S.config.cen)||{});
const cenDev=()=>{try{return Object.assign({son:true,wake:false},JSON.parse(localStorage.getItem("angels_cen_dev")||"{}"))}catch(e){return{son:true,wake:false}}};
const cenMin=ts=>(Date.now()-new Date(ts).getTime())/60000;
const cenGps=c=>c&&c.adr&&c.adr.gps&&isFinite(+c.adr.gps.lat)&&isFinite(+c.adr.gps.lng)?{lat:+c.adr.gps.lat,lng:+c.adr.gps.lng}:null;
function cenKm(a,b){const R=6371,r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dg=r(b.lng-a.lng),h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const cenPos=l=>{const p=S.pos&&S.pos[l.id];return p&&isFinite(+p.lat)&&isFinite(+p.lng)&&cenMin(p.ts)<=(+S.config.gps_stale_warn||30)?{lat:+p.lat,lng:+p.lng}:null};
const cenCharge=l=>S.livraisons.filter(x=>x.livreur_id===l.id&&isActive(x)).length;
const cenColEnCours=l=>(S.collectes||[]).filter(c=>c.livreur_id===l.id&&["acceptee","en_route","collectee"].includes(c.statut)).length;
function cenEtat(l){const n=cenCharge(l),nc=cenColEnCours(l);
 if(l.statut!=="disponible"||lvPause(l))return{k:"indispo",t:"Indisponible",c:"er",n,nc};
 if(nc)return{k:"collecte",t:"En collecte",c:"wa",n,nc};if(n)return{k:"course",t:"En course",c:"wa",n,nc};return{k:"libre",t:"Libre",c:"ok",n,nc}}
const cenReussite=l=>{const s=statLiv(l,Date.now()-30*864e5,Date.now());return s.livrees+s.echecs>=3?s.taux:null};
/* Score d'un livreur pour une commande : plus petit = meilleur ; ≥ 1000 = à écarter */
function cenScore(c,l,old){
 const mo=l.moto_id&&moto(l.moto_id),bloq=mo&&!["disponible","affectee"].includes(mo.statut);let sc=0;
 if(l.statut!=="disponible"||lvPause(l))sc+=1000;if(bloq)sc+=1000;if(old&&old.livreur_id===l.id)sc+=2000;try{if(risqueDetenu(l).bloque)sc+=1000}catch(e){}
 sc+=cenCharge(l)*12+cenColEnCours(l)*6;if(l.zone&&c.adr&&l.zone===c.adr.zone)sc-=10;
 const g=cenGps(c),p=cenPos(l);sc+=g&&p?Math.min(30,cenKm(p,g)*2):4;
 const r=cenReussite(l);if(r!=null)sc+=(100-r)*.2;return Math.round(sc*10)/10}
function cenWhy(c,l){const w=[],g=cenGps(c),p=cenPos(l),r=cenReussite(l),n=cenCharge(l);
 if(l.zone&&c.adr&&l.zone===c.adr.zone)w.push("même zone");w.push(n?n+" course(s)":"libre");if(g&&p)w.push("à "+cenKm(p,g).toFixed(1).replace(".",",")+" km");if(r!=null)w.push("réussite "+Math.round(r)+" %");return w.join(" · ")}
function cenRank(c){const old=activeLiv(c.id);return lvActifs().map(l=>({l,sc:cenScore(c,l,old),why:cenWhy(c,l)})).sort((a,b)=>a.sc-b.sc)}
const cenBest=c=>{const r=cenRank(c)[0];return r&&r.sc<1000?r:null};
function cenAffAuto(cid){const c=cmd(cid),b=c&&cenBest(c);if(!b)return toast("Aucun livreur disponible pour "+(c?c.numero:"cette commande"),"err");
 if(CL.on)return CL.affecter(c,{lid:b.l.id,motif:""},b.l);const l=affecter(c,b.l.id,"");if(!l)return;save();toast(c.numero+" → "+b.l.nom+" ("+b.why+")","ok");render()}
function cenSug(c){const b=cenBest(c);return b?`<div class="sm" style="margin-top:4px">⭐ <b>${esc(b.l.nom)}</b> <span class="mu">${esc(b.why)}</span> <button class="btn sm ok" data-act="cenAffAuto" data-id="${c.id}">⚡ Affecter</button></div>`:`<div class="sm mu" style="margin-top:4px">Aucun livreur disponible</div>`}

/* ---------- Contacts ---------- */
function cenBtns(tel,msg){const t=String(tel||"").replace(/\D/g,"");if(!t)return"";return`<a class="btn sm ghost" href="tel:${esc(t)}" title="Appeler">📞</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(waLink(tel,msg||""))}" title="WhatsApp">💬</a>`}
const cenCli=c=>cli(c.client_id)||{};

/* ---------- Créneaux promis ---------- */
function cenCreTxt(c){if(!c||!c.creneau)return"";const d=new Date(c.creneau.de),a=new Date(c.creneau.a),j=ymd(d)===ymd(new Date())?"aujourd'hui":ymd(d)===ymd(new Date(Date.now()+864e5))?"demain":d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
 const h=x=>String(x.getHours()).padStart(2,"0")+"h"+(x.getMinutes()?String(x.getMinutes()).padStart(2,"0"):"");return j+" "+h(d)+"–"+h(a)}
function cenCreneauForm(cid){const c=cmd(cid);if(!c)return;const today=ymd(new Date());
 modal("Créneau de livraison — "+c.numero,`<div class="pill">Annoncez au client une fenêtre de 2 à 4 h : il sait quand être présent, vous réduisez les échecs par absence.</div>
 <label>Jour<input type="date" name="j" min="${today}" value="${c.creneau?ymd(c.creneau.de):today}" required></label>
 <label>Créneau<select name="s">${CEN_SLOTS.map((s,i)=>`<option value="${i}">${s[0].replace(":","h")} – ${s[1].replace(":","h")}</option>`).join("")}</select></label>
 ${c.creneau?`<div class="sm mu">Créneau actuel : <b>${esc(cenCreTxt(c))}</b></div>`:""}`,
 {label:"Enregistrer",onSubmit:d=>{const s=CEN_SLOTS[+d.s];c.creneau={de:new Date(d.j+"T"+s[0]+":00").toISOString(),a:new Date(d.j+"T"+s[1]+":00").toISOString()};c.conf_client=null;audit("Créneau de livraison",c.numero+" — "+cenCreTxt(c));save();toast("Créneau enregistré","ok");render()}})}
function cenCreneauOff(cid){const c=cmd(cid);if(!c)return;c.creneau=null;c.conf_client=null;save();render()}

/* ---------- Confirmation du client avant le départ ---------- */
function cenConfMsg(c){const cl=cenCli(c);return`Bonjour ${cl.nom||""}, ${S.config.org||"votre livreur"} : votre commande ${c.numero} sera livrée ${cenCreTxt(c)}. Merci d'être joignable. Répondez 1 pour CONFIRMER, 2 pour REPORTER.`}
function cenConfEnvoyer(cid){const c=cmd(cid);if(!c)return;if(!c.creneau)return cenCreneauForm(cid);const cl=cenCli(c);if(!cl.tel)return toast("Pas de téléphone pour ce client","err");
 window.open(waLink(cl.tel,cenConfMsg(c)),"_blank","noopener");c.conf_client={statut:"envoye",ts:now(),par:who()};audit("Confirmation client demandée",c.numero);save();render()}
function cenConfRep(cid,rep){const c=cmd(cid);if(!c)return;c.conf_client={statut:rep==="oui"?"ok":"report",ts:now(),par:who()};audit("Réponse client",c.numero+" — "+(rep==="oui"?"confirmé":"report demandé"));save();if(rep==="report")cenCreneauForm(cid);else{toast("Livraison confirmée par le client","ok");render()}}
const cenConfLabel=c=>{const s=c.conf_client&&c.conf_client.statut;return s==="ok"?badge("✔ confirmé","ok"):s==="report"?badge("report demandé","wa"):s==="envoye"?badge("message envoyé","wa"):badge("à confirmer","er")};

/* ---------- Alertes ---------- */
function cenAlertes(){
 const A=[],C=cenCfg(),add=(k,ic,txt,act,id,cle)=>A.push({k,ic,txt,act,id,cle});
 S.livraisons.filter(isActive).forEach(l=>{const c=cmd(l.commande_id);if(!c)return;const lv=liv(l.livreur_id)||{nom:"?"},z=zone(c.adr&&c.adr.zone),lim=z&&z.delai_min?z.delai_min:60,min=cenMin(l.affectee_at);
  if(l.statut==="affectee"&&min>C.offre_min)add("wa","⏳",`${c.numero} : ${lv.nom} n'a pas accepté depuis ${Math.round(min)} min — réaffecter ?`,"assign",c.id,"of"+l.id);
  else if(min>lim)add("er","🐢",`${c.numero} en retard de ${Math.round(min-lim)} min (${lv.nom})`,"cenFiche",c.id,"re"+l.id);
  if(l.statut==="en_cours"){const p=S.pos&&S.pos[l.livreur_id];if(!p||cenMin(p.ts)>C.immobile_min)add("wa","📡",`${lv.nom} : aucune position depuis ${p?Math.round(cenMin(p.ts)):"le départ"}${p?" min":""} (${c.numero})`,"cenFiche",c.id,"po"+l.id)}});
 S.commandes.filter(c=>c.statut==="prete"&&!expOuverte(c)).forEach(c=>{const h=[...c.hist].reverse().find(x=>x.a==="prete"),min=h?cenMin(h.ts):0;if(min>C.pret_min)add("wa","📦",`${c.numero} attend un livreur depuis ${Math.round(min)} min`,"assign",c.id,"pr"+c.id)});
 (S.collectes||[]).filter(c=>["planifiee","acceptee"].includes(c.statut)&&c.creneau&&cenMin(c.creneau)>C.collecte_retard_min).forEach(c=>add("er","🧺",`Collecte ${c.numero} chez ${colVend(c)} : créneau dépassé de ${Math.round(cenMin(c.creneau))} min, livreur pas parti`,"centreGo","collectes|","co"+c.id));
 S.commandes.filter(c=>c.creneau&&["prete","affectee","en_cours"].includes(c.statut)&&Date.now()>new Date(c.creneau.a).getTime()).forEach(c=>add("er","🕒",`${c.numero} : créneau annoncé au client dépassé (${cenCreTxt(c)})`,"cenFiche",c.id,"cr"+c.id));
 S.commandes.filter(c=>c.creneau&&["prete","affectee"].includes(c.statut)&&new Date(c.creneau.de).getTime()-Date.now()<4*36e5&&new Date(c.creneau.de).getTime()>Date.now()&&!(c.conf_client&&c.conf_client.statut==="ok")).forEach(c=>add("wa","📲",`${c.numero} : créneau ${cenCreTxt(c)} non confirmé par le client`,"cenConfEnvoyer",c.id,"cf"+c.id));
 return A.sort((a,b)=>(a.k==="er"?0:1)-(b.k==="er"?0:1))}
function cenAlHtml(n){const A=cenAlertes();if(!A.length)return`<div class="rien" style="margin:10px 0">✅ Aucune alerte : la journée se déroule normalement.</div>`;
 return`<section class="card" style="border-left:4px solid var(--er)"><h2 style="margin:0 0 6px">🚨 Alertes (${A.length})</h2>${A.slice(0,n||8).map(a=>`<div class="between" style="gap:8px;margin:6px 0"><span class="sm">${a.ic} ${esc(a.txt)}</span><button class="btn sm ${a.k==="er"?"er":"ghost"}" data-act="${a.act}" data-id="${esc(a.id)}">Traiter</button></div>`).join("")}${A.length>(n||8)?`<div class="sm mu">… et ${A.length-(n||8)} autre(s) dans la Tour de contrôle</div>`:""}</section>`}
function cenFiche(cid){const c=cmd(cid);if(!c)return;const l=activeLiv(cid)||livsOf(cid).slice(-1)[0],cl=cenCli(c),lv=l&&liv(l.livreur_id);
 modal("Commande "+c.numero,`<div class="pill"><b>${esc(cl.nom||"")}</b> · ${esc(c.adr.zone||"")} ${esc(c.adr.quartier||"")} ${esc(c.adr.repere||"")}<br>Statut : <b>${esc(ST[c.statut]||c.statut)}</b>${c.creneau?" · Créneau : <b>"+esc(cenCreTxt(c))+"</b>":""}</div>
 <div class="flex" style="flex-wrap:wrap;gap:6px"><span class="sm">Client :</span>${cenBtns(cl.tel,"Bonjour "+(cl.nom||"")+", au sujet de votre commande "+c.numero)}${lv?`<span class="sm" style="margin-left:10px">Livreur ${esc(lv.nom)} :</span>${cenBtns(lv.tel,"Centre de livraison : point sur la commande "+c.numero)}`:""}</div>
 <div class="flex" style="flex-wrap:wrap;gap:6px;margin-top:10px"><button type="button" class="btn sm" data-act="cmdDetail" data-id="${c.id}">📋 Ouvrir la commande</button><button type="button" class="btn sm ghost" data-act="cenCreneauForm" data-id="${c.id}">🕒 Créneau</button>${["prete","affectee","en_cours"].includes(c.statut)?`<button type="button" class="btn sm ghost" data-act="assign" data-id="${c.id}">🏍 ${activeLiv(c.id)?"Réaffecter":"Affecter"}</button>`:""}<button type="button" class="btn sm ghost" data-act="cenPreuve" data-id="${c.id}">🧾 Dossier</button></div>`,{focus:false})}

/* ---------- Groupage en tournées ---------- */
function cenGroupes(){
 const C=cenCfg(),P=S.commandes.filter(c=>c.statut==="prete"&&!expOuverte(c)).sort((a,b)=>(b.priorite==="urgente")-(a.priorite==="urgente")||new Date(a.date)-new Date(b.date)),zones={};
 P.forEach(c=>{(zones[(c.adr&&c.adr.zone)||"—"]=zones[(c.adr&&c.adr.zone)||"—"]||[]).push(c)});
 const G=[],isol=[],pris={};
 Object.entries(zones).forEach(([z,L])=>{let rest=L.slice();
  while(rest.length){const seed=rest.shift(),g=[seed],gs=cenGps(seed);
   const proches=rest.map(c=>{const p=cenGps(c);const d=gs&&p?cenKm(gs,p):(normTxt(c.adr.quartier||"")&&normTxt(c.adr.quartier||"")===normTxt(seed.adr.quartier||"")?0:(gs||p?99:C.rayon_km-.1));return{c,d}}).filter(x=>x.d<=C.rayon_km).sort((a,b)=>a.d-b.d).slice(0,C.max_tournee-1);
   proches.forEach(x=>{g.push(x.c)});rest=rest.filter(c=>!g.includes(c));
   if(g.length>=2)G.push({zone:z,cmds:g});else isol.push(seed)}});
 G.forEach(g=>{const rk=cenRank(g.cmds[0]).filter(x=>x.sc<1000);const dispo=rk.find(x=>!pris[x.l.id])||rk[0];g.l=dispo?dispo.l:null;if(g.l)pris[g.l.id]=(pris[g.l.id]||0)+1;g.eco=g.cmds.length*(C.cout_unit-C.cout_groupe)});
 return{G,isol}}
function cenTourModal(){
 if(CL.on)return toast("Les tournées automatiques ne sont pas disponibles en mode serveur","err");
 const{G,isol}=cenGroupes(),C=cenCfg(),lvs=lvActifs();
 if(!G.length)return modal("Tournées proposées",`<div class="pill">Aucun groupe possible : il faut au moins 2 commandes prêtes proches l'une de l'autre (même zone, à moins de ${C.rayon_km} km).${isol.length?` ${isol.length} commande(s) isolée(s) : affectez-les une par une.`:""}</div>`,{focus:false});
 const tot=G.reduce((t,g)=>t+g.eco,0);
 modal("Tournées proposées",`<div class="pill">${G.length} tournée(s) · <b>${G.reduce((t,g)=>t+g.cmds.length,0)}</b> commandes groupées. Économie estimée : <b>${fcfa(tot)}</b> (course seule ${fcfa(C.cout_unit)} contre ${fcfa(C.cout_groupe)} en tournée — réglable dans « Réglages du centre »).</div>
 ${G.map((g,i)=>`<div class="card" style="margin:8px 0"><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="g${i}" checked style="width:auto;margin-top:4px"><span style="flex:1"><b>Zone ${esc(g.zone)}</b> · ${g.cmds.length} commandes · <span class="mu">économie ${fcfa(g.eco)}</span><br><span class="sm">${g.cmds.map(c=>esc(c.numero)+" ("+esc(c.adr.quartier||"—")+")").join(" · ")}</span></span></label>
 <label>Livreur<select name="l${i}">${opts(lvs.map(l=>({v:l.id,t:l.nom+" — "+cenWhy(g.cmds[0],l)})),g.l?g.l.id:"")}</select></label></div>`).join("")}
 ${isol.length?`<div class="sm mu">Isolées (à affecter une par une) : ${isol.map(c=>esc(c.numero)).join(", ")}</div>`:""}`,
 {wide:true,label:"Créer les tournées",onSubmit:d=>{let n=0;G.forEach((g,i)=>{if(!d["g"+i]||!d["l"+i])return;const t=creerTournee(d["l"+i],g.cmds.map(c=>c.id));if(t)n++});save();if(n)toast(n+" tournée(s) créée(s)","ok");render()}})}

/* ---------- Tour de contrôle ---------- */
function cenLivCard(l){const e=cenEtat(l),L=S.livraisons.filter(x=>x.livreur_id===l.id&&isActive(x)),p=S.pos&&S.pos[l.id],fr=fraicheur(p),col=(S.collectes||[]).filter(c=>c.livreur_id===l.id&&["planifiee","acceptee","en_route","collectee"].includes(c.statut));
 return`<div class="card" style="margin:0;border-left:5px solid var(--${e.c==="ok"?"ok":e.c==="er"?"er":"wa"})"><div class="between"><b>${esc(l.nom)}</b>${badge(e.t,e.c)}</div>
 <div class="sm mu">${L.length} course(s) · ${col.length} collecte(s) · position : ${esc(fr.t)}${l.zone?" · zone "+esc(l.zone):""}</div>
 ${L.map(x=>{const c=cmd(x.commande_id);return`<div class="sm" style="margin-top:3px"><a href="#" data-act="cenFiche" data-id="${c.id}"><b>${esc(c.numero)}</b></a> ${lb(x)} <span class="mu">${esc(c.adr.zone||"")}</span></div>`}).join("")}${col.map(c=>`<div class="sm" style="margin-top:3px">🧺 ${esc(c.numero)} ${colBadge(c)} <span class="mu">${esc(colVend(c))}</span></div>`).join("")}
 <div class="flex" style="flex-wrap:wrap;gap:6px;margin-top:8px">${cenBtns(l.tel,"Centre de livraison : ")}<button type="button" class="btn sm ghost" data-act="cenControle" data-id="${l.id}">📦 Colis au départ</button>${p?`<button type="button" class="btn sm ghost" data-act="cenCarteLiv" data-id="${l.id}">📍 Position</button>`:""}</div></div>`}
const cenV_tour=()=>{
 const E=lvActifs().map(l=>({l,e:cenEtat(l)})),n=k=>E.filter(x=>x.e.k===k).length,P=S.commandes.filter(c=>c.statut==="prete"&&!expOuverte(c)),
  conf=S.commandes.filter(c=>c.creneau&&["prete","affectee","en_cours"].includes(c.statut)&&ymd(c.creneau.de)<=ymd(new Date(Date.now()+864e5))&&ymd(c.creneau.de)>=ymd(new Date()));
 return`<div class="cdl"><div class="ban"><h1>Tour de contrôle</h1><p>Qui fait quoi, où, et ce qui demande votre attention</p></div>
 <div class="kp"><button type="button"><span class="ic">🟢</span><b>${n("libre")}</b><span class="l">Libres</span></button><button type="button"><span class="ic">🏍</span><b>${n("course")}</b><span class="l">En course</span></button><button type="button"><span class="ic">🧺</span><b>${n("collecte")}</b><span class="l">En collecte</span></button><button type="button" class="${n("indispo")?"w":""}"><span class="ic">⛔</span><b>${n("indispo")}</b><span class="l">Indisponibles</span></button></div>
 ${cenAlHtml(12)}
 <div class="between" style="margin:12px 0 6px"><h2 style="margin:0">📦 À affecter (${P.length})</h2>${P.length>1?`<button class="btn sm" data-act="cenTour">🔁 Proposer des tournées</button>`:""}</div>
 ${P.length?P.map(c=>`<div class="rpk"><div class="between"><span><b>${esc(c.numero)}</b> ${c.priorite==="urgente"?badge("URGENT","er"):""} <span class="mu sm">${esc(zoneDe(c))} · ${esc(c.adr.quartier||"")}</span></span><span>${c.creneau?`<span class="sm">🕒 ${esc(cenCreTxt(c))}</span>`:`<button class="btn sm ghost" data-act="cenCreneauForm" data-id="${c.id}">🕒 Créneau</button>`}</span></div>${cenSug(c)}</div>`).join(""):`<div class="mu sm">Aucune commande en attente d'un livreur.</div>`}
 <h2 style="margin:14px 0 6px">🏍 Livreurs (${E.length})</h2><div class="cgrid">${E.sort((a,b)=>["libre","course","collecte","indispo"].indexOf(a.e.k)-["libre","course","collecte","indispo"].indexOf(b.e.k)).map(x=>cenLivCard(x.l)).join("")||'<div class="mu">Aucun livreur.</div>'}</div>
 <h2 style="margin:14px 0 6px">📲 Confirmations clients (aujourd'hui et demain)</h2>
 ${conf.length?tbl(["Commande","Client","Créneau","État",""],conf.map(c=>{const cl=cenCli(c);return`<tr><td><b>${esc(c.numero)}</b></td><td>${esc(cl.nom||"")}</td><td>${esc(cenCreTxt(c))}</td><td>${cenConfLabel(c)}</td><td class="flex" style="gap:4px;flex-wrap:wrap"><button class="btn sm" data-act="cenConfEnvoyer" data-id="${c.id}">💬 Demander</button><button class="btn sm ok" data-act="cenConfOui" data-id="${c.id}">✔ Confirmé</button><button class="btn sm ghost" data-act="cenConfNon" data-id="${c.id}">↻ Reporter</button></td></tr>`})):`<div class="mu sm">Aucune livraison avec créneau pour aujourd'hui ou demain. Donnez un créneau aux commandes (bouton 🕒) pour que le client confirme avant le départ.</div>`}</div>`};

/* ---------- Échecs et retours ---------- */
const cenV_echecs=()=>{
 const E=S.commandes.filter(c=>c.statut==="echouee"),R=S.commandes.filter(c=>c.statut==="retour_cours"),nb=c=>livsOf(c.id).filter(l=>l.statut==="echouee").length;
 const row=c=>{const l=livsOf(c.id).filter(x=>x.statut==="echouee").slice(-1)[0]||{},cl=cenCli(c),n=nb(c);return`<tr><td><b>${esc(c.numero)}</b><div class="sm mu">${esc(zoneDe(c))} ${esc(c.adr.quartier||"")}</div></td><td>${esc(cl.nom||"")}<div class="flex" style="gap:4px">${cenBtns(cl.tel,"Bonjour "+(cl.nom||"")+", votre commande "+c.numero+" n'a pas pu être livrée. Quand êtes-vous disponible ?")}</div></td><td class="sm">${esc(l.motif_echec||"—")}${l.obs?'<div class="mu">'+esc(l.obs)+"</div>":""}</td><td>${n>=2?badge(n+" tentatives","er"):badge(n+" tentative","wa")}</td>
 <td class="flex" style="gap:4px;flex-wrap:wrap">${n<2?`<button class="btn sm" data-act="reprog" data-id="${c.id}">🔁 Nouvelle tentative</button>`:`<span class="sm" style="color:var(--er)">⚠ Proposer le retour au vendeur</span>`}<button class="btn sm ghost" data-act="cenCreneauForm" data-id="${c.id}">🕒 Créneau</button><button class="btn sm ghost" data-act="cenPreuve" data-id="${c.id}">🧾</button></td></tr>`};
 return`<div class="cdl"><div class="ban"><h1>Échecs & retours</h1><p>Rappelez le client, reprogrammez avec un créneau, ou réceptionnez le colis qui revient</p></div>
 <h2>Livraisons échouées (${E.length})</h2>${tbl(["Commande","Client","Motif","Tentatives",""],E.map(row),"Aucune livraison échouée à traiter 🎉")}
 <h2>Colis en retour (${R.length})</h2>${tbl(["Commande","Zone","Retour",""],R.map(c=>`<tr><td><b>${esc(c.numero)}</b></td><td>${esc(zoneDe(c))}</td><td class="sm">${esc((c.hist.slice(-1)[0]||{}).note||"")}</td><td><button class="btn sm ok" data-act="recepRetour" data-id="${c.id}">📥 Réceptionner</button></td></tr>`),"Aucun colis en retour")}</div>`};

/* ---------- Dossier de preuve ---------- */
function cenPreuveHtml(c){const L=livsOf(c.id).filter(l=>l.statut!=="reaffectee"||true),cl=cenCli(c),fin=L.slice().reverse().find(l=>l.statut==="livree");
 const ph=(c.colis||[]).filter(k=>k.photo);
 return`<h2 style="margin:0">Dossier de preuve — ${esc(c.numero)}</h2><div>${esc(S.config.org||"")}</div><p><b>Client :</b> ${esc(cl.nom||"")} · ${esc(c.adr.zone||"")} ${esc(c.adr.quartier||"")} ${esc(c.adr.repere||"")}<br><b>Statut :</b> ${esc(ST[c.statut]||c.statut)}${c.creneau?" · <b>Créneau annoncé :</b> "+esc(cenCreTxt(c)):""}</p>
 ${fin?`<p><b>Remise :</b> ${fdt(fin.fin_at)} par ${esc((liv(fin.livreur_id)||{}).nom||"")} · reçu par <b>${esc(fin.recu_par||"")}</b> · encaissé ${fcfa(fin.montant_encaisse||0)} (${esc(fin.mode||"")})${fin.gps_confirm?` · position : <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${fin.gps_confirm.lat},${fin.gps_confirm.lng}">📍 ${(+fin.gps_confirm.lat).toFixed(5)}, ${(+fin.gps_confirm.lng).toFixed(5)}</a>`:""}<br><b>Code client :</b> ${fin.circuit==="direct"?"circuit direct : validée par le centre"+(fin.saisie_par?" ("+esc(fin.saisie_par)+")":"")+(fin.bon_papier?" · bon papier n° "+esc(fin.bon_papier):""):fin.code_etat==="absent"?"⚠ non saisi":fin.code_etat==="non_conforme"?"⚠ non conforme":"saisi et validé"} ${fin.scan_etat?" · ⚠ colis "+(fin.scan_etat==="absent"?"non scannés":"scannés en partie")+" à la remise":(fin.colis_liv?" · colis scannés à la remise":"")}${fin.scan_prise?" · ⚠ prise en charge "+(fin.scan_prise==="absent"?"sans scan":"scannée en partie"):""}</p>${fin.signature?`<p><b>Signature :</b><br><img alt="Signature" src="${fin.signature}" style="max-width:260px;border:1px solid #ccc"></p>`:""}`:`<p><i>Pas encore livrée.</i></p>`}
 ${ph.length?`<p><b>Photos des colis au départ :</b><br>${ph.map(k=>`<img alt="Colis ${k.n}" src="${k.photo}" style="height:90px;margin:2px;border:1px solid #ccc">`).join("")}</p>`:""}
 <h3>Historique</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${c.hist.map(h=>`<tr><td style="border-bottom:1px solid #eee;padding:2px 6px;white-space:nowrap">${fdt(h.ts)}</td><td style="border-bottom:1px solid #eee;padding:2px 6px">${esc(ST[h.a]||h.a)}</td><td style="border-bottom:1px solid #eee;padding:2px 6px">${esc(h.par||"")}</td><td style="border-bottom:1px solid #eee;padding:2px 6px">${esc(h.note||"")}</td></tr>`).join("")}</table>
 ${L.length?`<h3>Courses</h3>${L.map(l=>`<div class="sm">${esc((liv(l.livreur_id)||{}).nom||"")} — ${esc(LST[l.statut]||l.statut)} — affectée ${fdt(l.affectee_at)}${l.fin_at?" — fin "+fdt(l.fin_at):""}${l.motif_echec?" — "+esc(l.motif_echec):""}</div>`).join("")}`:""}`}
function cenPreuve(cid){const c=cmd(cid);if(!c)return;modal("🧾 Dossier de preuve",`<div id="cen_preuve">${cenPreuveHtml(c)}</div><div class="flex noprint" style="margin-top:10px"><button type="button" class="btn" data-act="cenPreuvePrint" data-id="${c.id}">🖨 Imprimer / PDF</button></div>`,{wide:true,focus:false})}
function cenPreuvePrint(cid){const c=cmd(cid);if(!c)return;const w=window.open("","_blank");if(!w)return toast("Autorisez les fenêtres pour imprimer","err");w.document.write(`<!doctype html><meta charset="utf-8"><title>Dossier ${esc(c.numero)}</title><body style="font:14px system-ui;margin:24px">${cenPreuveHtml(c)}<script>setTimeout(function(){print()},300)<\/script></body>`);w.document.close()}

/* ---------- Contrôle des colis au départ et au retour ---------- */
function cenControle(lid){const lv=liv(lid);if(!lv)return;
 const sortie=S.livraisons.filter(l=>l.livreur_id===lid&&["affectee","acceptee","en_cours"].includes(l.statut)),retour=S.livraisons.filter(l=>l.livreur_id===lid&&l.statut==="echouee"&&cenMin(l.fin_at)<48*60);
 const bloc=(l,mode)=>{const c=cmd(l.commande_id),K=c.colis||[];return`<div class="card" style="margin:6px 0"><b>${esc(c.numero)}</b> <span class="mu sm">${esc(cenCli(c).nom||"")} · ${esc(zoneDe(c))}</span>
  ${K.length?K.map(k=>{const fait=mode==="s"?k.sortie_at:k.retour_at;return`<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="${mode}_${c.id}_${k.n}" data-tok="${esc(k.tok)}" style="width:auto" ${fait?"checked disabled":""}> <span>Colis ${k.n}/${K.length} <code>${esc(k.tok)}</code> ${fait?'<span class="mu sm">✔ '+fdt(fait)+"</span>":""}</span></label>`}).join(""):`<div class="sm mu">Aucun colis défini. <button type="button" class="btn sm" data-act="cenColisNb" data-id="${c.id}|${lid}">Créer les colis</button></div>`}</div>`};
 modal("📦 Colis — "+lv.nom,`<div class="pill">Cochez (ou scannez le code de l'étiquette) chaque colis qui sort du dépôt avec le livreur, puis ceux qui reviennent après un échec. Rien ne se perd.</div>
 <label>Scanner ou saisir un code colis<input id="cen_scan" placeholder="Code de l'étiquette puis Entrée" autocomplete="off"></label>
 <h3>À la sortie (${sortie.length})</h3>${sortie.map(l=>bloc(l,"s")).join("")||'<div class="mu sm">Aucune course en attente de départ.</div>'}
 <h3>Au retour (${retour.length})</h3>${retour.map(l=>bloc(l,"r")).join("")||'<div class="mu sm">Aucun retour attendu.</div>'}`,
 {wide:true,label:"Enregistrer",onSubmit:d=>{let n=0;Object.keys(d).forEach(k=>{const[m,cid,nn]=k.split("_"),c=cmd(cid),kk=c&&(c.colis||[]).find(x=>x.n===+nn);if(!kk)return;if(m==="s"&&!kk.sortie_at){kk.sortie_at=now();n++}if(m==="r"&&!kk.retour_at){kk.retour_at=now();n++}});
  const manque=sortie.reduce((t,l)=>t+(cmd(l.commande_id).colis||[]).filter(k=>!k.sortie_at).length,0);audit("Contrôle des colis — "+lv.nom,n+" colis enregistrés");save();toast(n+" colis enregistrés"+(manque?" — ⚠ "+manque+" colis non encore sortis":""),manque?"err":"ok");render()}})}
function cenScanOk(v){v=String(v||"").trim().toUpperCase();if(!v)return;const k=[...document.querySelectorAll('#mf input[type=checkbox][data-tok]')].find(x=>x.dataset.tok.toUpperCase()===v&&!x.disabled);if(k){k.checked=true;k.closest("label").style.background="var(--okbg)";toast("Colis "+v+" ✔","ok")}else toast("Code "+v+" inconnu ou déjà enregistré","err")}

/* ---------- Planning des collectes ---------- */
const cenColJour=c=>c.creneau?ymd(c.creneau):"";
function cenPlanHtml(){
 const days=Array.from({length:7},(_,i)=>new Date(Date.now()+i*864e5)),C=cenCfg();S.col_rec=S.col_rec||[];
 const dayCard=d=>{const j=ymd(d),cols=(S.collectes||[]).filter(c=>cenColJour(c)===j&&c.statut!=="annulee"),recs=S.col_rec.filter(r=>r.actif&&r.jour===d.getDay()&&!cols.some(c=>c.vendeur_id===r.vendeur_id));
  return`<div class="card" style="margin:0"><b>${j===ymd(new Date())?"Aujourd'hui":esc(CEN_JOURS[d.getDay()])} ${d.getDate()}/${d.getMonth()+1}</b>
  ${cols.map(c=>`<div class="sm" style="margin-top:4px">🧺 <b>${esc(colVend(c))}</b> ${colBadge(c)}<br><span class="mu">${fdt(c.creneau).slice(-5)} · ${esc(colLiv(c))}</span> ${cenBtns(c.vendeur_tel,"Bonjour "+colVend(c)+", le livreur de "+(S.config.org||"")+" passera chercher vos colis "+(j===ymd(new Date())?"aujourd'hui":"le "+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))+" vers "+fdt(c.creneau).slice(-5)+". Merci de préparer vos colis et de garder votre code à 4 chiffres.")}</div>`).join("")}
  ${recs.map(r=>`<div class="sm mu" style="margin-top:4px">🔁 ${esc((vendOf(r.vendeur_id)||{}).nom||"?")} (récurrente ${esc(r.heure)})</div>`).join("")}${!cols.length&&!recs.length?'<div class="sm mu">—</div>':""}</div>`};
 return`<div class="between"><h2 style="margin:0">📅 Les 7 prochains jours</h2><div class="flex"><button class="btn sm" data-act="cenRecForm">➕ Collecte récurrente</button><button class="btn sm ghost" data-act="cenColGen">⚙ Générer les collectes dues</button></div></div>
 <div class="cgrid" style="margin-top:8px">${days.map(dayCard).join("")}</div>
 <h2 style="margin-top:14px">🔁 Collectes récurrentes</h2>${tbl(["Vendeur","Jour","Heure","Livreur",""],S.col_rec.map(r=>`<tr><td><b>${esc((vendOf(r.vendeur_id)||{}).nom||"?")}</b></td><td>${esc(CEN_JOURS[r.jour])}</td><td>${esc(r.heure)}</td><td>${esc((liv(r.livreur_id)||{}).nom||"—")}</td><td><button class="btn sm ghost" data-act="cenRecDel" data-id="${r.id}">Supprimer</button></td></tr>`),"Aucune collecte récurrente : ajoutez « tous les mardis chez ce vendeur ».")}
 <p class="sm mu">Une collecte récurrente est planifiée automatiquement ${C.auto_col?"(le jour même, dès qu'il y a des commandes confirmées à récupérer)":"(automatique désactivée dans les réglages)"}.</p>`}
function cenRecForm(){modal("Collecte récurrente",`<label>Vendeur<select name="v">${opts(S.vendeurs.map(v=>({v:v.id,t:v.nom})),"")}</select></label><div class="g2"><label>Jour<select name="j">${CEN_JOURS.map((j,i)=>`<option value="${i}" ${i===2?"selected":""}>${j}</option>`).join("")}</select></label><label>Heure<input type="time" name="h" value="09:00" required></label></div><label>Livreur habituel<select name="l">${opts(lvActifs().map(l=>({v:l.id,t:l.nom})),"")}</select></label>`,
 {label:"Enregistrer",onSubmit:d=>{S.col_rec=S.col_rec||[];S.col_rec.push({id:uid("cr"),vendeur_id:d.v,jour:+d.j,heure:d.h,livreur_id:d.l,actif:true});audit("Collecte récurrente",(vendOf(d.v)||{}).nom+" — "+CEN_JOURS[+d.j]+" "+d.h);save();render()}})}
function cenColGen(silent){if(CL.on||!ME||!can("admin","superviseur"))return 0;let n=0;const today=new Date(),j=ymd(today);
 (S.col_rec||[]).filter(r=>r.actif&&r.jour===today.getDay()).forEach(r=>{const v=vendOf(r.vendeur_id),L=v?aCollecter(v.id):[];if(!v||!L.length)return;if((S.collectes||[]).some(c=>c.vendeur_id===v.id&&cenColJour(c)===j&&c.statut!=="annulee"))return;
  try{colPlanLocal({vendeur_id:v.id,commandes:L.map(c=>c.id),livreur:r.livreur_id,creneau:new Date(j+"T"+r.heure+":00").toISOString(),note:"Collecte récurrente"});n++}catch(e){if(!silent)toast(v.nom+" : "+e.message,"err")}});
 if(n){save();if(!silent)toast(n+" collecte(s) planifiée(s)","ok")}else if(!silent)toast("Aucune collecte due pour le moment","ok");if(!silent)render();return n}

/* ---------- Performance ---------- */
function cenPerf(t0,t1){
 const L=S.livraisons.filter(l=>["livree","echouee"].includes(l.statut)&&l.fin_at&&new Date(l.fin_at)>=t0&&new Date(l.fin_at)<=t1),ok=L.filter(l=>l.statut==="livree"),ko=L.filter(l=>l.statut==="echouee");
 const prem=ok.filter(l=>livsOf(l.commande_id).filter(x=>!["reaffectee","refusee","annulee"].includes(x.statut)).length===1).length;
 const delai=ok.filter(l=>{const c=cmd(l.commande_id),z=c&&zone(c.adr.zone);return(new Date(l.fin_at)-new Date(l.affectee_at))/60000<=(z&&z.delai_min?z.delai_min:60)}).length;
 const cr=ok.filter(l=>{const c=cmd(l.commande_id);return c&&c.creneau}),crOk=cr.filter(l=>new Date(l.fin_at)<=new Date(cmd(l.commande_id).creneau.a)).length;
 const cout=ok.reduce((t,l)=>t+coutLiv(l),0),colis=ok.reduce((t,l)=>t+Math.max(1,((cmd(l.commande_id)||{}).colis||[]).length),0),tour=ok.filter(l=>l.tournee_id).length;
 const zones={},motifs={},parL={};L.forEach(l=>{const c=cmd(l.commande_id),z=(c&&c.adr.zone)||"—";const o=zones[z]=zones[z]||{ok:0,ko:0};l.statut==="livree"?o.ok++:o.ko++;if(l.statut==="echouee"){const m=l.motif_echec||"Autre";motifs[m]=(motifs[m]||0)+1}});
 lvActifs().forEach(lv=>{const s=statLiv(lv,t0.getTime(),t1.getTime());if(s.livrees+s.echecs)parL[lv.id]=s});
 return{n:L.length,ok:ok.length,ko:ko.length,prem,delai,cr:cr.length,crOk,cout,colis,tour,zones,motifs,parL}}
const cenV_perf=()=>{
 const p=ui.pf||"7",j=new Date();j.setHours(0,0,0,0);const t0=new Date(j.getTime()-(p==="1"?0:(+p-1))*864e5),t1=new Date(),P=cenPerf(t0,t1),pc=(a,b)=>b?Math.round(a/b*100)+" %":"—";
 return`<div class="cdl"><div class="ban"><h1>Performance du centre</h1><p>La qualité de service et ce que coûte chaque livraison</p></div>
 <div class="flex noprint" style="gap:8px;margin:36px 0 8px;position:relative;z-index:1"><select data-f="pf" style="width:auto">${opts([{v:"1",t:"Aujourd'hui"},{v:"7",t:"7 derniers jours"},{v:"30",t:"30 derniers jours"}],p)}</select><button class="btn sm ghost" data-act="cenPerfCsv">⬇ Exporter (CSV)</button></div>
 <div class="grid">${kpi("Livrées",P.ok,"o")}${kpi("Échecs",P.ko,P.ko?"e":"")}${kpi("Livrées à la 1re tentative",pc(P.prem,P.ok))}${kpi("Dans les délais de la zone",pc(P.delai,P.ok))}${kpi("Créneau respecté",P.cr?pc(P.crOk,P.cr):"—")}${kpi("Coût moyen par colis",P.colis?fcfa(P.cout/P.colis):"—")}${kpi("Livrées en tournée",pc(P.tour,P.ok))}</div>
 <h2>Par livreur</h2>${tbl(["Livreur","Livrées","Échecs","Réussite","Dans les délais","Durée moy."],Object.entries(P.parL).map(([id,s])=>`<tr><td><b>${esc(liv(id).nom)}</b></td><td>${s.livrees}</td><td>${s.echecs}</td><td>${Math.round(s.taux)} %</td><td>${s.livrees?Math.round(s.delais)+" %":"—"}</td><td>${s.duree?Math.round(s.duree)+" min":"—"}</td></tr>`),"Aucune course terminée sur la période")}
 <div class="g2"><div><h2>Par zone</h2>${tbl(["Zone","Livrées","Échecs","Échec"],Object.entries(P.zones).sort((a,b)=>b[1].ok+b[1].ko-a[1].ok-a[1].ko).map(([z,o])=>`<tr><td>${esc(z)}</td><td>${o.ok}</td><td>${o.ko}</td><td>${pc(o.ko,o.ok+o.ko)}</td></tr>`),"—")}</div><div><h2>Motifs d'échec</h2>${tbl(["Motif","Nombre"],Object.entries(P.motifs).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`<tr><td>${esc(m)}</td><td>${n}</td></tr>`),"Aucun échec 🎉")}</div></div></div>`};
function cenPerfCsv(){const p=ui.pf||"7",j=new Date();j.setHours(0,0,0,0);const P=cenPerf(new Date(j.getTime()-(p==="1"?0:(+p-1))*864e5),new Date());
 csvDown("performance_centre",["Livreur","Livrées","Échecs","Taux de réussite (%)","Dans les délais (%)"],Object.entries(P.parL).map(([id,s])=>[liv(id).nom,s.livrees,s.echecs,Math.round(s.taux),Math.round(s.delais)]))}

/* ---------- Clôture de la journée ---------- */
function cenCloture(){const j=ymd(new Date()),deb=new Date(j+"T00:00:00"),act=S.livraisons.filter(isActive),ech=S.commandes.filter(c=>c.statut==="echouee"),ret=S.commandes.filter(c=>c.statut==="retour_cours"),
  col=(S.collectes||[]).filter(colOpen),ecarts=S.livraisons.filter(l=>l.ecart_statut==="a_valider"),dets=lvActifs().map(l=>({l,s:soldeLiv(l.id)})).filter(x=>x.s>0),
  nonRev=[];S.livraisons.filter(l=>l.statut==="echouee"&&cenMin(l.fin_at)<72*60).forEach(l=>{const c=cmd(l.commande_id);(c.colis||[]).forEach(k=>{if(k.sortie_at&&!k.retour_at&&c.statut==="echouee")nonRev.push(c.numero+" colis "+k.n)})});
 const sansCode=S.livraisons.filter(l=>l.statut==="livree"&&((l.code_etat&&l.code_etat!=="ok")||l.scan_etat||l.scan_prise)&&l.fin_at&&new Date(l.fin_at)>=deb),P=cenPerf(deb,new Date()),fait=(S.clotures_j||[]).find(x=>x.jour===j);return{j,act,ech,ret,col,ecarts,dets,nonRev,sansCode,P,fait,ouverts:act.length+ech.length+ret.length+col.length+ecarts.length+nonRev.length}}
const cenV_cloture=()=>{const D=cenCloture(),ligne=(ic,t,n,det,btn)=>`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--bd)"><span>${n?"⚠":"✅"} ${ic} <b>${t}</b>${n?` <span class="mu">(${n})</span>`:""}${det?`<div class="sm mu">${det}</div>`:""}</span>${n&&btn?btn:""}</div>`;
 return`<div class="cdl"><div class="ban"><h1>Clôture de la journée</h1><p>Rien ne reste en suspens avant de fermer le centre</p></div>
 ${D.fait?`<div class="al ok">🔒 Journée clôturée à ${fdt(D.fait.ts).slice(-5)} par ${esc(D.fait.par)} ${D.fait.ouverts?"("+D.fait.ouverts+" point(s) restés ouverts)":""}</div>`:""}
 <div class="grid">${kpi("Livrées aujourd'hui",D.P.ok,"o")}${kpi("Échecs",D.P.ko,D.P.ko?"e":"")}${kpi("Courses encore actives",D.act.length,D.act.length?"e":"")}${kpi("Points ouverts",D.ouverts,D.ouverts?"e":"o")}</div>
 <section class="card">${ligne("🏍","Courses non terminées",D.act.length,D.act.map(l=>esc((cmd(l.commande_id)||{}).numero)+" ("+esc((liv(l.livreur_id)||{}).nom)+")").join(", "),`<button class="btn sm" data-act="centreGo" data-id="tour|">Tour de contrôle</button>`)}
 ${ligne("↩️","Échecs à traiter",D.ech.length,D.ech.map(c=>esc(c.numero)).join(", "),`<button class="btn sm" data-act="centreGo" data-id="echecs|">Traiter</button>`)}
 ${ligne("📥","Colis en retour à réceptionner",D.ret.length,D.ret.map(c=>esc(c.numero)).join(", "),`<button class="btn sm" data-act="centreGo" data-id="echecs|">Réceptionner</button>`)}
 ${ligne("🧺","Collectes ouvertes",D.col.length,D.col.map(c=>esc(c.numero)+" "+esc(colVend(c))).join(", "),`<button class="btn sm" data-act="centreGo" data-id="collectes|">Collectes</button>`)}
 ${ligne("📦","Colis sortis non revenus",D.nonRev.length,esc(D.nonRev.join(", ")),`<button class="btn sm" data-act="centreGo" data-id="tour|">Contrôler</button>`)}
 ${D.sansCode.length?`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--bd)"><span>ℹ️ 🔑 <b>Livrées sans code client ou sans scan complet des colis</b> <span class="mu">(${D.sansCode.length})</span><div class="sm mu">${D.sansCode.map(l=>esc((cmd(l.commande_id)||{}).numero)+" ("+[l.code_etat&&l.code_etat!=="ok"?(l.code_etat==="direct"?"circuit direct":"code "+(l.code_etat==="absent"?"non saisi":"non conforme")):"",l.scan_etat||l.scan_prise?"colis non scannés":""].filter(Boolean).join(", ")+")").join(", ")} — à contrôler auprès du livreur, sans bloquer la clôture</div></span></div>`:""}
 ${ligne("⚖️","Écarts de caisse à valider",D.ecarts.length,"",`<button class="btn sm" data-act="centreGo" data-id="livraisons|trt">Valider</button>`)}</section>
 <section class="card"><h2 style="margin-top:0">💵 Argent détenu par les livreurs</h2>${D.dets.length?tbl(["Livreur","À reverser à la caisse"],D.dets.map(x=>`<tr><td><b>${esc(x.l.nom)}</b></td><td>${fcfa(x.s)}</td></tr>`))+'<div class="sm mu">À reverser au caissier avant la fermeture de la caisse (Trésorerie, dans l\'application complète).</div>':'<div class="mu sm">Tous les livreurs ont reversé. ✅</div>'}</section>
 <div class="flex noprint" style="gap:8px;margin-top:10px"><button class="btn ${D.ouverts?"wa":"ok"}" data-act="cenClore">🔒 Clôturer la journée</button><button class="btn ghost" data-act="cenCloturePrint">🖨 Imprimer le résumé</button></div>
 ${(S.clotures_j||[]).length?`<h3>Dernières clôtures</h3>${tbl(["Jour","Par","Livrées","Échecs","Ouverts"],(S.clotures_j||[]).slice(-7).reverse().map(x=>`<tr><td>${esc(x.jour)}</td><td>${esc(x.par)}</td><td>${x.livrees}</td><td>${x.echecs}</td><td>${x.ouverts}</td></tr>`))}`:""}</div>`};
function cenClore(){const D=cenCloture();const go=()=>{S.clotures_j=S.clotures_j||[];S.clotures_j=S.clotures_j.filter(x=>x.jour!==D.j);S.clotures_j.push({id:uid("cj"),jour:D.j,par:ME.nom,ts:now(),livrees:D.P.ok,echecs:D.P.ko,ouverts:D.ouverts});audit("Clôture de la journée du centre",D.j+" — "+D.P.ok+" livrées, "+D.P.ko+" échecs, "+D.ouverts+" point(s) ouvert(s)");save();toast("Journée clôturée","ok");render()};
 if(D.ouverts&&!confirm(D.ouverts+" point(s) restent ouverts. Clôturer quand même ?"))return;go()}
function cenCloturePrint(){const D=cenCloture(),w=window.open("","_blank");if(!w)return;w.document.write(`<!doctype html><meta charset="utf-8"><title>Clôture ${D.j}</title><body style="font:14px system-ui;margin:24px"><h2>${esc(S.config.org||"")} — Clôture du ${D.j}</h2><p>Livrées : <b>${D.P.ok}</b> · Échecs : <b>${D.P.ko}</b> · Points ouverts : <b>${D.ouverts}</b></p><ul><li>Courses actives : ${D.act.length}</li><li>Échecs à traiter : ${D.ech.length}</li><li>Retours à réceptionner : ${D.ret.length}</li><li>Collectes ouvertes : ${D.col.length}</li><li>Colis non revenus : ${D.nonRev.length}</li><li>Écarts à valider : ${D.ecarts.length}</li></ul><h3>Argent détenu</h3>${D.dets.map(x=>esc(x.l.nom)+" : "+fcfa(x.s)).join("<br>")||"Aucun"}<script>setTimeout(function(){print()},300)<\/script></body>`);w.document.close()}


/* ---------- Circuit direct : le centre valide lui-même des livraisons faites hors application (ancien système manuel) ---------- */
const CEN_ST_DIRECT=["prete","affectee","en_cours"];
const cenDirectListe=()=>S.commandes.filter(c=>CEN_ST_DIRECT.includes(c.statut)&&!expOuverte(c)).sort((a,b)=>new Date(a.date)-new Date(b.date));
function cenDirectExec(c,o){
 if(CL.on)return"Le circuit direct n'est pas disponible en mode serveur";
 const lv=liv(o.lid);if(!lv)return"Choisissez le livreur qui a livré";if(!CEN_ST_DIRECT.includes(c.statut))return"La commande doit être prête, affectée ou en cours";
 const t0=Date.now(),quand=o.quand||now();let l,msg="";
 const qd=new Date(quand);if(isNaN(qd))return"Date de livraison invalide";if(qd.getTime()>t0+60000)return"La date de livraison ne peut pas être dans le futur";
 if(c.date&&qd<new Date(String(c.date).slice(0,10)+"T00:00:00"))return"La livraison ne peut pas précéder la date de la commande ("+String(c.date).slice(0,10)+")";
 if((S.clotures_j||[]).some(x=>x.jour===ymd(qd)))return"La journée du "+ymd(qd)+" est déjà clôturée : saisissez la livraison à une date ouverte";
 /* photo de l'état avant : si une étape échoue, tout est remis comme avant (aucune réaffectation à moitié faite) */
 const snap={c:JSON.parse(JSON.stringify(c)),livs:S.livraisons.filter(x=>x.commande_id===c.id).map(x=>JSON.parse(JSON.stringify(x))),len:{}};
 Object.keys(S).forEach(k=>{if(Array.isArray(S[k]))snap.len[k]=S[k].length});
 const annuler=()=>{Object.keys(snap.len).forEach(k=>{if(Array.isArray(S[k])&&S[k].length>snap.len[k])S[k].length=snap.len[k]});
  Object.keys(c).forEach(k=>{if(!(k in snap.c))delete c[k]});Object.assign(c,snap.c);
  snap.livs.forEach(o=>{const x=S.livraisons.find(y=>y.id===o.id);if(x){Object.keys(x).forEach(k=>{if(!(k in o))delete x[k]});Object.assign(x,o)}})};
 let echecEtape="";
 const garde_toast=toast;toast=m=>{msg=m};   /* les contrôles métier parlent par toast : on récupère leur message */
 CEN_DIRECT=true;const fin=m=>{annuler();return m};
 try{
  l=activeLiv(c.id);
  if(l&&l.livreur_id!==lv.id){l=affecter(c,lv.id,"Circuit direct : livreur ayant réellement livré");if(!l)return fin(msg||"Réaffectation impossible")}
  else if(!l){l=affecter(c,lv.id,"");if(!l)return fin(msg||"Affectation impossible")}
  if(l.statut==="affectee"&&!accepter(l))return fin(msg||"Acceptation impossible");
  if(l.statut==="acceptee"&&!l.collecte_at&&!priseEnCharge(l,(c.colis&&c.colis.length)||1))return fin(msg||"Prise en charge impossible");
  if(l.statut==="acceptee"&&!demarrer(l))return fin(msg||"Départ impossible");
  if(l.statut!=="en_cours")return fin("La livraison n'est pas en cours");
  if(o.resultat==="echec"){if(!echec(l,o.motif||"Client absent",o.obs||"",{pg:true}))return fin(msg||"Échec non enregistré")}
  else{const att=l.montant_attendu||0,mt=o.montant===""||o.montant==null?att:Math.round(+o.montant);
   if(!confirmer(l,{centre:true,code:"",montant:String(mt),mode:o.mode||"Espèces",ref:o.ref||"",recu_par:o.recu_par,obs:o.obs||"",ecart_note:o.ecart_note||"",colis_ok:"",signature:"",at:quand}))return fin(msg||"Confirmation refusée")}
 }catch(e){annuler();return e&&e.message||"Erreur inattendue"}finally{CEN_DIRECT=false;toast=garde_toast}
 /* dates réelles de la livraison (saisie après coup) ; l'heure de saisie reste dans le journal d'audit */
 const recale=a=>{(a||[]).forEach(h=>{if(h.ts&&new Date(h.ts).getTime()>=t0-1000)h.ts=quand})};
 recale(c.hist);recale(l.hist);["affectee_at","accept_at","collecte_at","depart_at","fin_at"].forEach(k=>{if(l[k]&&new Date(l[k]).getTime()>=t0-1000)l[k]=quand});   /* seules les étapes saisies maintenant sont datées à la livraison réelle ; les horaires déjà réels sont conservés */
 S.fonds.forEach(f=>{if(f.livraison_id===l.id&&new Date(f.ts).getTime()>=t0-1000)f.ts=quand});
 l.circuit="direct";l.saisie_par=who();l.saisie_le=now();if(o.bon)l.bon_papier=String(o.bon).slice(0,40);
 if(Array.isArray(o.articles)&&o.articles.length){l.articles_remis=o.articles;const manque=o.articles.filter(a=>a.remis<a.cmd);if(manque.length){c.obs=(c.obs?c.obs+" · ":"")+"Remis en partie : "+manque.map(a=>a.desig+" "+a.remis+"/"+a.cmd).join(", ")}}
 audit("Livraison directe (circuit direct)",c.numero+" — "+lv.nom+" — "+(o.resultat==="echec"?"échec : "+(o.motif||""):"livrée, encaissé "+fcfa(l.montant_encaisse||0))+(o.bon?" — bon papier "+o.bon:""));
 return""}
function cenDirectModal(cid){
 if(!can("admin","superviseur"))return toast("Réservé à l'administrateur et au superviseur","err");
 if(CL.on)return toast("Le circuit direct n'est pas disponible en mode serveur","err");
 const L=cenDirectListe();if(!L.length)return modal("📝 Circuit direct",'<div class="pill">Aucune commande prête, affectée ou en cours à valider.</div>',{focus:false});
 const lvs=lvActifs(),dtl=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16),mots=(S.config.motifs||["Client absent"]),modes=S.config.modes||["Espèces"];
 const row=c=>{const cl=cenCli(c),act=activeLiv(c.id),att=soldeCmd(c);return`<div class="card cdrow" data-lv="${act?esc(act.livreur_id):""}" style="margin:8px 0"><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="ck_${c.id}" style="width:auto;margin-top:4px" ${c.id===cid?"checked":""}><span style="flex:1"><b>${esc(c.numero)}</b> · ${esc(cl.nom||"")} <span class="mu sm">${esc(zoneDe(c))} ${esc(c.adr.quartier||"")}</span> ${badge(ST[c.statut],"")}${act?` <span class="mu sm">(${esc((liv(act.livreur_id)||{}).nom||"")})</span>`:""}<br><span class="sm">À encaisser : <b>${fcfa(att)}</b></span></span></label>
  <div class="g3"><label>Résultat<select name="rs_${c.id}"><option value="livree">✅ Livrée</option><option value="echec">❌ Non livrée</option></select></label><label>Montant encaissé (F)<input type="number" name="mt_${c.id}" min="0" value="${att}"></label><label>Mode<select name="md_${c.id}">${opts(modes,modes[0])}</select></label></div>
  <div class="g3"><label>Reçu par<input name="rp_${c.id}" placeholder="Nom du client"></label><label>Réf. Mobile Money<input name="rf_${c.id}" placeholder="si Mobile Money"></label><label>Explication si écart / motif d'échec<input name="ex_${c.id}" list="cen_mots"></label></div>
  <details><summary class="sm mu" style="cursor:pointer">👕 Articles remis (${c.lignes.length})</summary>${c.lignes.map((x,i)=>`<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="flex:1">${esc(lname(x))}</span><span class="mu sm">commandé ${x.qte} · remis</span><input type="number" name="q_${c.id}_${i}" min="0" max="${x.qte}" value="${x.qte}" style="width:70px"></label>`).join("")}</details></div>`};
 modal("📝 Circuit direct — livraison validée par le centre",`<div class="pill">Pour les livraisons faites hors application (livreur sans réseau ou téléphone en panne) : le centre valide à la place du livreur, enregistre l'encaissement et les articles remis. Le livreur garde le circuit habituel s'il peut l'utiliser.</div>
 <div class="g3"><label>Livreur qui a livré<select name="lid" required>${opts([{v:"",t:"— choisir —"}].concat(lvs.map(l=>({v:l.id,t:l.nom}))),"")}</select></label><label>Date et heure de la livraison<input type="datetime-local" name="quand" value="${dtl}" max="${dtl}" required></label><label>Bon papier n° (facultatif)<input name="bon" maxlength="40"></label></div>
 <datalist id="cen_mots">${mots.map(m=>`<option value="${esc(m)}">`).join("")}</datalist><label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="cd_tous" style="width:auto"> Voir aussi les commandes des autres livreurs et celles sans livreur</label><div class="sm mu" id="cd_nb"></div>${L.map(row).join("")}`,
 {wide:true,label:"Valider les livraisons cochées",cls:"ok",onSubmit:d=>{
  if(!d.lid)return toast("Choisissez le livreur qui a livré","err"),false;
  const quand=new Date(d.quand).toISOString(),ids=L.filter(c=>d["ck_"+c.id]),R={ok:[],ko:[]};
  if(!ids.length)return toast("Cochez au moins une commande","err"),false;
  for(const c of ids){const att=soldeCmd(c),mt=+d["mt_"+c.id],res=d["rs_"+c.id],ex=String(d["ex_"+c.id]||"").trim();
   const art=c.lignes.map((x,i)=>({desig:lname(x),cmd:x.qte,remis:Math.max(0,Math.min(x.qte,+d["q_"+c.id+"_"+i]||0))}));
   if(res==="livree"){if(!String(d["rp_"+c.id]||"").trim()){R.ko.push(c.numero+" : indiquez qui a reçu");continue}if(mt!==att&&ex.length<3){R.ko.push(c.numero+" : écart de "+fcfa(mt-att)+", explication obligatoire");continue}}
   else if(ex.length<3){R.ko.push(c.numero+" : motif d'échec obligatoire");continue}
   const e=cenDirectExec(c,{lid:d.lid,quand,resultat:res,montant:mt,mode:d["md_"+c.id],ref:String(d["rf_"+c.id]||"").trim().toUpperCase(),recu_par:String(d["rp_"+c.id]||"").trim(),ecart_note:ex,motif:ex,obs:ex,bon:d.bon,articles:art});
   e?R.ko.push(c.numero+" : "+e):R.ok.push(c.numero)}
  save();if(R.ko.length){toast(R.ok.length+" enregistrée(s) ; à revoir : "+R.ko.join(" | "),"err");render();return R.ok.length>0}
  toast(R.ok.length+" livraison(s) enregistrée(s) en circuit direct","ok");render()}});cenDirectFiltre()}
/* Choisir le livreur n'affiche que ses commandes (case à cocher pour tout voir : le centre peut valider pour un autre livreur que celui affecté) ; une ligne masquée est décochée pour ne jamais être validée sans être vue */
function cenDirectFiltre(){const sel=document.querySelector("#mf [name=lid]"),cb=document.getElementById("cd_tous"),nb=document.getElementById("cd_nb");if(!sel||!cb)return;
 const f=()=>{const lid=sel.value,tous=cb.checked;let n=0;document.querySelectorAll("#mf .cdrow").forEach(r=>{const ok=!lid||tous||r.dataset.lv===lid;r.style.display=ok?"":"none";if(ok)n++;else{const k=r.querySelector("input[type=checkbox]");if(k)k.checked=false}});if(nb)nb.textContent=lid&&!tous?n+" commande(s) de "+sel.options[sel.selectedIndex].text+(n?"":" : aucune — cochez la case ci-dessus pour voir les autres"):""};
 sel.addEventListener("change",f);cb.addEventListener("change",f);f()}
const cenV_direct=()=>{
 const j=ymd(new Date()),H=S.livraisons.filter(l=>l.circuit==="direct"&&ymd(l.saisie_le||l.fin_at)===j).sort((a,b)=>new Date(b.saisie_le)-new Date(a.saisie_le)),n=cenDirectListe().length;
 return`<div class="cdl"><div class="ban"><h1>Circuit direct</h1><p>Le centre valide lui-même les livraisons faites hors application</p></div>
 <div class="card"><div class="between"><span><b>${n}</b> commande(s) prête(s), affectée(s) ou en cours peuvent être validées ici.<div class="sm mu">Le livreur n'a rien à faire sur son téléphone ; l'argent encaissé est compté à sa charge comme d'habitude (Trésorerie).</div></span><button class="btn" data-act="cenDirect">📝 Saisir des livraisons</button></div></div>
 <h2>Saisies aujourd'hui (${H.length})</h2>${tbl(["Commande","Livreur","Résultat","Encaissé","Reçu par","Saisi par",""],H.map(l=>{const c=cmd(l.commande_id)||{};return`<tr><td><b>${esc(c.numero||"")}</b></td><td>${esc((liv(l.livreur_id)||{}).nom||"")}</td><td>${l.statut==="livree"?badge("Livrée","ok"):badge("Non livrée","er")}</td><td>${l.statut==="livree"?fcfa(l.montant_encaisse||0):"—"}</td><td class="sm">${esc(l.recu_par||"")}</td><td class="sm">${esc(l.saisie_par||"")}</td><td><button class="btn sm ghost" data-act="cenPreuve" data-id="${c.id}">🧾</button></td></tr>`}),"Aucune saisie aujourd'hui")}</div>`};

/* ---------- Réglages, sons, écran allumé, veille ---------- */
function cenReglages(){const C=cenCfg(),D=cenDev(),adm=can("admin","superviseur");
 modal("⚙ Réglages du centre",`<div class="sec">Cet appareil</div>
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="son" style="width:auto" ${D.son?"checked":""}> 🔔 Son et vibration quand une alerte urgente apparaît</label>
 <label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" name="wake" style="width:auto" ${D.wake?"checked":""}> 📺 Garder l'écran allumé (poste du centre)</label>
 ${adm?`<div class="sec" style="margin-top:12px">Règles du centre (tous les postes)</div>
 <div class="g3"><label>Max colis par tournée<input type="number" name="max" min="2" max="20" value="${C.max_tournee}"></label><label>Rayon de groupage (km)<input type="number" name="ray" min="0.5" max="20" step="0.5" value="${C.rayon_km}"></label><label>Offre sans réponse (min)<input type="number" name="of" min="1" value="${C.offre_min}"></label></div>
 <div class="g3"><label>Coût d'une course seule (F)<input type="number" name="cu" min="0" value="${C.cout_unit}"></label><label>Coût en tournée par colis (F)<input type="number" name="cg" min="0" value="${C.cout_groupe}"></label><label>Position perdue après (min)<input type="number" name="im" min="1" value="${C.immobile_min}"></label></div>
 <div class="g3"><label>Commande prête sans livreur (min)<input type="number" name="pr" min="1" value="${C.pret_min}"></label><label>Collecte en retard (min)<input type="number" name="cr" min="1" value="${C.collecte_retard_min}"></label><label>Collectes récurrentes<select name="ac"><option value="1" ${C.auto_col?"selected":""}>Planifiées automatiquement</option><option value="0" ${C.auto_col?"":"selected"}>Manuelles</option></select></label></div>`:""}`,
 {label:"Enregistrer",onSubmit:d=>{try{localStorage.setItem("angels_cen_dev",JSON.stringify({son:!!d.son,wake:!!d.wake}))}catch(e){}cenWake();
  if(adm){const n=x=>Math.max(0,+x||0);S.config.cen={max_tournee:Math.max(2,n(d.max)),rayon_km:n(d.ray)||3,offre_min:n(d.of)||3,cout_unit:n(d.cu),cout_groupe:n(d.cg),immobile_min:n(d.im)||15,pret_min:n(d.pr)||20,collecte_retard_min:n(d.cr)||15,auto_col:d.ac!=="0",veille:true};audit("Réglages du centre de livraison","");save()}toast("Réglages enregistrés","ok");render()}})}
let CEN_WL=null;
async function cenWake(){try{if(CEN_WL){await CEN_WL.release();CEN_WL=null}if(cenDev().wake&&navigator.wakeLock&&document.visibilityState==="visible")CEN_WL=await navigator.wakeLock.request("screen")}catch(e){}}
let CEN_VU=null;
function cenWatch(){
 if(!APPC||!ME||!S||ME.role==="livreur"||ME.role==="vendeur")return;
 const A=cenAlertes(),urg=A.filter(a=>a.k==="er").map(a=>a.cle),neufs=CEN_VU?urg.filter(k=>!CEN_VU.has(k)):[];CEN_VU=new Set(urg);
 if(neufs.length&&cenDev().son&&typeof ANGELS_SIGNAL!=="undefined"){try{ANGELS_SIGNAL.jouer("alerte",{rep:1,vib:true,dire:""})}catch(e){}}
 let ch=0;try{if(S.config.cen?S.config.cen.auto_col!==false:true)ch=cenColGen(true)}catch(e){}
 const libre=!document.querySelector("#modal .ov");if(libre&&(neufs.length||ch)&&["centre","tour","echecs","cloture"].includes(view))render()}

function centreInit(){
 /* commandes déposées par un vendeur : l'origine est enregistrée une fois pour toutes (plus de déduction par le nom de l'auteur) */
 try{S.commandes.forEach(c=>{if(c.depose_par_vendeur===undefined&&c.hist&&c.hist[0]&&S.users.some(u=>u.role==="vendeur"&&u.nom===c.hist[0].par))c.depose_par_vendeur=true})}catch(e){}
 Object.assign(VIEWS,{direct:cenV_direct,tour:cenV_tour,echecs:cenV_echecs,perf:cenV_perf,cloture:cenV_cloture});
 Object.assign(ACT,{cenDirect:cenDirectModal,cenAffAuto,cenFiche,cenCreneauForm,cenCreneauOff,cenConfEnvoyer,cenConfOui:id=>cenConfRep(id,"oui"),cenConfNon:id=>cenConfRep(id,"report"),cenTour:cenTourModal,cenPreuve,cenPreuvePrint,
  cenControle,cenColisNb:v=>{const[cid,lid]=String(v).split("|"),c=cmd(cid);if(!c)return;colisGenerer(c,+(prompt("Nombre de colis pour "+c.numero,"1")||1));save();cenControle(lid)},cenCarteLiv:id=>{ui.mapLiv=id;ui.cdt="rep";view="livraisons";render()},
  cenRecForm,cenRecDel:id=>{S.col_rec=(S.col_rec||[]).filter(r=>r.id!==id);save();render()},cenColGen:()=>cenColGen(false),cenPerfCsv,cenClore,cenCloturePrint,cenReglages});
 document.addEventListener("keydown",e=>{if(e.target&&e.target.id==="cen_scan"&&e.key==="Enter"){e.preventDefault();cenScanOk(e.target.value);e.target.value=""}});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")cenWake()});
 window.addEventListener("online",()=>{if(APPC&&ME)render()});window.addEventListener("offline",()=>{if(APPC&&ME)render()});
 if(APPC)setInterval(cenWatch,30000);
}
/* Bloc d'accueil du centre : hors ligne, alertes, raccourcis */
function cenHome(){const A=cenAlertes(),nEch=S.commandes.filter(c=>c.statut==="echouee"||c.statut==="retour_cours").length,P=S.commandes.filter(c=>c.statut==="prete"&&!expOuverte(c)).length;
 return`${typeof passBandeau==="function"?passBandeau():""}${navigator.onLine===false?'<div class="al warn sm">📶 Hors ligne : ce que vous faites est gardé sur cet appareil et envoyé dès le retour du réseau.</div>':""}
 <div class="rac noprint"><button class="btn" data-act="centreGo" data-id="tour|" style="width:auto">🧭 Tour de contrôle</button>${P>1?`<button class="btn ghost" data-act="cenTour" style="width:auto">🔁 Proposer des tournées</button>`:""}<button class="btn ghost" data-act="centreGo" data-id="echecs|" style="width:auto">↩️ Échecs & retours${nEch?" ("+nEch+")":""}</button><button class="btn ghost" data-act="cenDirect" style="width:auto">📝 Circuit direct</button><button class="btn ghost" data-act="centreGo" data-id="cloture|" style="width:auto">🔒 Clôture du jour</button><button class="btn ghost" data-act="cenReglages" style="width:auto">⚙ Réglages</button></div>${cenAlHtml(5)}`}
