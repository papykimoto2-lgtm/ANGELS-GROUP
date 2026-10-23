/* Rôles et droits : rôles personnalisés + droits module par module et action par action (Distributions, Transport, Agro, Hub).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/roles.js   (lancé avec tests/demo-hook.js : données de démonstration) */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const page=async(f)=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(f+": "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+f+".html");await p.waitForTimeout(700);return p};
 const surDist=fs.readFileSync(path.join(root,"distribution.html"),"utf8");

 /* ======== Distributions ======== */
 const D=await page("distribution");
 const coh=await D.evaluate(()=>{const mauvais=[];for(const n of NAV.filter(n=>!(n.r.length===1&&n.r[0]==="vendeur")))for(const r of Object.keys(ROLES).filter(x=>!["livreur","vendeur"].includes(x))){if(n.r.includes(r)!==ANGELS_ROLES.a("distribution",S,r,"v."+n.v))mauvais.push(n.v+"/"+r)}return mauvais});
 const listes=[...new Set([...surDist.matchAll(/\bcan\(((?:"[a-z]+"(?:,"[a-z]+")*))\)/g)].map(m=>m[1]))].concat([...surDist.matchAll(/garde\((\[[^\]]*\])/g)].map(m=>m[1].slice(1,-1)));
 const sansAtome=await D.evaluate(ls=>ls.filter(l=>{const roles=l.split(",").map(x=>x.replace(/"/g,""));const ext=roles.filter(r=>!["livreur","vendeur"].includes(r));return ext.length&&!ANGELS_ROLES.atomeDe("distribution",roles)}),listes);
 const defTest=await D.evaluate(ls=>{const e=[];for(const l of ls){const roles=l.split(",").map(x=>x.replace(/"/g,""));const a=ANGELS_ROLES.atomeDe("distribution",roles);if(!a)continue;for(const r of ["admin","direction","superviseur","commercial","preparateur","caissier"]){if(roles.includes(r)!==ANGELS_ROLES.a("distribution",S,r,a))e.push(l+"@"+r)}}return e},listes);
 chk("ROL-1","Distributions : les droits par défaut du catalogue reproduisent EXACTEMENT les menus d'origine, et chaque contrôle d'action du code correspond à un droit du catalogue (rien d'oublié)",coh.length===0&&sansAtome.length===0&&defTest.length===0,JSON.stringify({coh,sansAtome,defTest}).slice(0,400));
 await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");render()});
 await D.evaluate(()=>ACT.rolesDroits());await D.waitForSelector("#rl-ov");
 const ouv=await D.evaluate(()=>({titre:document.querySelector("#rl-ov h2").innerText,roles:[...document.querySelectorAll("#rl-ov .ri")].map(x=>x.firstChild.textContent.trim()),admVerrou:[...document.querySelectorAll("#rl-ov .ri")].find(x=>/Administrateur/.test(x.innerText)).innerText}));
 chk("ROL-2","gestionnaire de rôles ouvert depuis Utilisateurs & droits : rôles d'origine listés (livreur et vendeur, rattachés à une fiche, absents), l'administrateur est verrouillé",/Distributions/.test(ouv.titre)&&ouv.roles.length===6&&/🔒/.test(ouv.admVerrou)&&!ouv.roles.some(x=>/Livreur|Vendeur/.test(x)),JSON.stringify(ouv));
 /* création d'un rôle */
 await D.click('#rl-ov [data-r="+"]');await D.fill("#rl-ov [data-nom]","Chef d'équipe");await D.fill("#rl-ov [data-desc]","Suit les commandes sans toucher à l'argent");
 for(const a of ["v.commandes","v.clients","commandes.gerer"])await D.check('#rl-ov [data-d="'+a+'"]');
 await D.click("#rl-ov [data-save]");await D.waitForTimeout(300);
 const cr=await D.evaluate(()=>({r:S.roles_perso,msg:document.querySelector("#rl-ov .msg").innerText,audit:S.audit.some(a=>a.action==="Rôle créé"),ROLES:Object.values(ROLES)}));
 chk("ROL-3","création du rôle « Chef d'équipe » : nom, description et 3 droits enregistrés dans l'état (donc synchronisés), journal d'audit, libellé disponible partout",cr.r.length===1&&cr.r[0].nom==="Chef d'équipe"&&cr.r[0].droits.join()==="commandes.gerer,v.clients,v.commandes"&&cr.audit&&/créé/.test(cr.msg)&&cr.ROLES.includes("Chef d'équipe"),JSON.stringify(cr).slice(0,300));
 /* validations */
 await D.click('#rl-ov [data-r="+"]');await D.fill("#rl-ov [data-nom]","chef d'équipe");await D.check('#rl-ov [data-d="v.clients"]');await D.click("#rl-ov [data-save]");const v1=await D.innerText("#rl-ov .msg");
 await D.fill("#rl-ov [data-nom]","Sans écran");await D.uncheck('#rl-ov [data-d="v.clients"]');await D.click("#rl-ov [data-save]");const v2=await D.innerText("#rl-ov .msg");
 await D.fill("#rl-ov [data-nom]","ab");await D.check('#rl-ov [data-d="v.clients"]');await D.click("#rl-ov [data-save]");const v3=await D.innerText("#rl-ov .msg");
 chk("ROL-4","contrôles : nom déjà pris (même en minuscules), rôle sans aucun droit de consultation, nom trop court → refusés avec un message clair, rien n'est créé",/déjà ce nom/.test(v1)&&/consultation/.test(v2)&&/3 caractères/.test(v3)&&(await D.evaluate(()=>S.roles_perso.length))===1,JSON.stringify([v1,v2,v3]));
 await D.evaluate(()=>document.querySelector("#rl-ov [data-x]").click());
 /* le rôle en action */
 const act=await D.evaluate(async()=>{const u={id:"u_test_chef",nom:"Awa Chef",role:S.roles_perso[0].id,actif:true,pwd:null};S.users.push(u);ME=u;render();await new Promise(r=>setTimeout(r,100));
  const nav=NAV.filter(voirNav).map(n=>n.v);return{nav,gerer:can("admin","commercial","superviseur"),caisse:can("admin","caissier"),commercial:can("admin","commercial"),garde:garde(["admin","superviseur"]),menu:[...document.querySelectorAll("aside [data-act=nav]")].map(e=>e.dataset.id)}});
 chk("ROL-5","un utilisateur du rôle voit UNIQUEMENT les écrans accordés (Commandes, Clients) et n'obtient que les actions accordées : créer des commandes oui ; encaisser, gérer produits, affecter les livreurs non",act.nav.join()==="clients,commandes"&&act.gerer===true&&act.caisse===false&&act.commercial===false&&act.garde===false&&act.menu.slice().sort().join()==="clients,commandes",JSON.stringify(act));
 /* modification d'un rôle d'origine + rétablissement */
 const orig=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");return NAV.filter(n=>{const ov=ANGELS_ROLES.surcharge("distribution",S,"caissier");return ov?ov.has("v."+n.v):n.r.includes("caissier")}).map(n=>n.v).join()});
 await D.evaluate(()=>ACT.rolesDroits());await D.waitForSelector("#rl-ov");
 await D.click('#rl-ov [data-r="caissier"]');await D.uncheck('#rl-ov [data-d="v.finance"]');await D.click("#rl-ov [data-save]");await D.waitForTimeout(200);
 const modif=await D.evaluate(()=>({ov:S.droits_roles&&S.droits_roles.caissier,nav:NAV.filter(n=>{const ov=ANGELS_ROLES.surcharge("distribution",S,"caissier");return ov?ov.has("v."+n.v):n.r.includes("caissier")}).map(n=>n.v).join(),aud:S.audit.some(a=>a.action==="Droits du rôle modifié"||/Droits du rôle modifiés/.test(a.action))}));
 await D.click("#rl-ov [data-retab]");await D.waitForTimeout(200);
 const retab=await D.evaluate(()=>({ov:S.droits_roles&&S.droits_roles.caissier,nav:NAV.filter(n=>{const ov=ANGELS_ROLES.surcharge("distribution",S,"caissier");return ov?ov.has("v."+n.v):n.r.includes("caissier")}).map(n=>n.v).join()}));
 chk("ROL-6","rôle d'origine « Caissier » : retirer l'écran Finance s'applique aussitôt ; « Rétablir les droits d'origine » remet exactement la configuration d'origine",orig.includes("finance")&&!modif.nav.includes("finance")&&modif.ov&&modif.aud&&retab.ov===undefined&&retab.nav===orig,JSON.stringify({orig,modif,retab}));
 /* suppression : refusée si utilisé */
 await D.click('#rl-ov .ri:has-text("Chef d\'équipe")');await D.click("#rl-ov [data-del]");await D.waitForTimeout(200);const sup1=await D.innerText("#rl-ov .msg");
 await D.evaluate(()=>{S.users.find(u=>u.id==="u_test_chef").role="commercial"});await D.click("#rl-ov [data-del]");await D.waitForTimeout(300);
 const sup2=await D.evaluate(()=>({n:S.roles_perso.length,txt:document.querySelector("#rl-ov .msg").innerText}));
 chk("ROL-7","suppression d'un rôle utilisé : refusée avec le nom des utilisateurs ; après leur changement de rôle, la suppression réussit",/utilisé par Awa Chef/.test(sup1)&&sup2.n===0&&/supprimé/.test(sup2.txt),JSON.stringify([sup1,sup2]));
 const adm=await D.evaluate(()=>{document.querySelector('#rl-ov [data-r="admin"]').click();return{dis:[...document.querySelectorAll("#rl-ov [data-d]")].every(x=>x.disabled),save:!!document.querySelector("#rl-ov [data-save]")}});
 chk("ROL-8","l'administrateur garde tous les droits : cases verrouillées, pas de bouton Enregistrer",adm.dis&&!adm.save,JSON.stringify(adm));
 await D.close();

 /* ======== Agro ======== */
 const A=await page("agro");
 const cohA=await A.evaluate(()=>{const m=[];for(const r of Object.keys(ROLES)){for(const k of Object.keys(ACL))if(ACL[k].includes(r)!==ANGELS_ROLES.a("agro",S,r,k))m.push(k+"/"+r);for(const n of NAV)if(n.r.includes(r)!==ANGELS_ROLES.a("agro",S,r,"v."+n.v))m.push("v."+n.v+"/"+r)}return m});
 chk("ROL-9","Agro : le catalogue reproduit exactement les droits d'action (ACL) et les menus d'origine de chaque rôle",cohA.length===0,JSON.stringify(cohA).slice(0,300));
 await A.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");render()});await A.evaluate(()=>A["rl.ouvrir"]());await A.waitForSelector("#rl-ov");
 await A.click('#rl-ov [data-r="+"]');await A.fill("#rl-ov [data-nom]","Aide-soigneur");await A.selectOption("#rl-ov [data-copie]","soigneur");await A.uncheck('#rl-ov [data-d="sante"]');await A.click("#rl-ov [data-save]");await A.waitForTimeout(300);
 const ag=await A.evaluate(async()=>{const r=S.roles_perso[0],u={id:"u_aide",nom:"Koffi Aide",role:r.id,actif:true,pwd:null};S.users.push(u);ME=u;render();await new Promise(x=>setTimeout(x,100));
  return{droits:r.droits.filter(x=>!x.startsWith("v.")),suivi:can("suivi"),sante:can("sante"),vente:can("vente"),nav:NAV.filter(showNav).map(n=>n.v).join(),lib:ROLES[r.id]}});
 chk("ROL-10","Agro : rôle « Aide-soigneur » créé en copiant le Soigneur puis en retirant « Santé » : suivi quotidien oui, santé non, ventes non, menus du Soigneur conservés",ag.suivi===true&&ag.sante===false&&ag.vente===false&&/lots/.test(ag.nav)&&!/ventes|compta/.test(ag.nav)&&ag.lib==="Aide-soigneur",JSON.stringify(ag));
 await A.close();

 /* ======== Transport ======== */
 const T=await page("transport");
 await T.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");render()});await T.evaluate(()=>A["rl.ouvrir"]());await T.waitForSelector("#rl-ov");
 await T.click('#rl-ov [data-r="+"]');await T.fill("#rl-ov [data-nom]","Agent de caisse");await T.selectOption("#rl-ov [data-copie]","caissier");await T.uncheck('#rl-ov [data-d="depenses.c"]');await T.check('#rl-ov [data-d="vehicules.v"]');await T.click("#rl-ov [data-save]");await T.waitForTimeout(300);
 const tr=await T.evaluate(async()=>{const r=S.roles_perso[0],u={id:"u_agent",nom:"Yao Agent",role:r.id,actif:true,pwd:null};S.users.push(u);ME=u;render();await new Promise(x=>setTimeout(x,100));
  return{perm:S.perms[r.id].caisse,dep:can("depenses","c"),depV:can("depenses","v"),veh:can("vehicules","v"),comp:can("compta","v"),nav:NAV.filter(showNav).length,lib:ROLES[r.id]}});
 chk("ROL-11","Transport : rôle « Agent de caisse » (copie du Caissier, sans création de dépenses, avec consultation des véhicules) : la matrice native S.perms est utilisée ; droits appliqués",tr.perm.join()==="v,c,e"&&tr.dep===false&&tr.depV===true&&tr.veh===true&&tr.comp===false&&tr.lib==="Agent de caisse"&&tr.nav>0,JSON.stringify(tr));
 const tm=await T.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="users";render();const roles=[...document.querySelectorAll('select[data-f="pm:role"] option')].map(o=>o.textContent);return roles});
 chk("ROL-12","Transport : le rôle personnalisé apparaît dans la matrice native des droits et dans le choix du rôle d'un utilisateur",tm.includes("Agent de caisse"),JSON.stringify(tm));
 await T.close();

 /* ======== Hub ======== */
 const H=await page("parametres");
 await H.evaluate(()=>{const S=JSON.parse(localStorage.getItem("angels_transport_v3"));const a=S.users.find(u=>u.role==="admin");AUTH.trans={id:a.id,nom:a.nom,exp:Date.now()+6e5};UM="trans";uView()});
 await H.waitForSelector('[data-rl="1"]');await H.click('[data-rl="1"]');await H.waitForSelector("#rl-ov");
 await H.click('#rl-ov [data-r="+"]');await H.fill("#rl-ov [data-nom]","Auditeur interne");await H.check('#rl-ov [data-d="vehicules.v"]');await H.check('#rl-ov [data-d="audit.v"]');await H.click("#rl-ov [data-save]");await H.waitForTimeout(300);
 const hub=await H.evaluate(()=>{const S=JSON.parse(localStorage.getItem("angels_transport_v3"));return{role:(S.roles_perso||[]).map(r=>r.nom),audit:S.audit.some(a=>/Rôle créé \(via Hub\)/.test(a.a)),perm:S.perms[S.roles_perso.slice(-1)[0].id].audit}});
 await H.evaluate(()=>document.querySelector("#rl-ov [data-x]").click());await H.waitForTimeout(200);
 const sel=await H.evaluate(()=>[...document.querySelectorAll("[data-ur] option,#uadd select[name=role] option")].map(o=>o.textContent));
 chk("ROL-13","Hub → Utilisateurs et rôles : gestionnaire de rôles de Transport ; le rôle créé est enregistré dans les données de l'application (audit « via Hub ») et proposé pour les utilisateurs",hub.role.includes("Auditeur interne")&&hub.audit&&hub.perm.join()==="v"&&sel.includes("Auditeur interne"),JSON.stringify({hub,sel:sel.slice(-4)}));
 await H.close();
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.slice(0,5).join(" | "):""));process.exit(ko||errs.length?1:0);
})();
