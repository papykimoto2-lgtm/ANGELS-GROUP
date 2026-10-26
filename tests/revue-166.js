/* Corrections issues de la revue du pull #166 : circuit direct (retour arrière, dates), origine « déposée par le vendeur » enregistrée,
   téléphone normalisé de la même façon au bureau et dans l'application vendeur, accès en masse repris après rechargement, notifications.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/revue-166.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path"),fs=require("fs");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:1000}})).newPage();let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.signature_seuil=99999999;
  window.__prete=n=>{const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(base));c.id="rv_"+n;c.numero="CMD-RV-"+n;c.statut="prete";c.date=new Date(Date.now()-5*864e5).toISOString();c.colis=null;c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];S.commandes.push(c);return c};
  window.__lv=S.livreurs.filter(l=>!l.archive);window.__hier=new Date(Date.now()-26*36e5).toISOString()});
 /* RV-1 retour arrière complet */
 let r=await p.evaluate(()=>{const c=__prete("1"),A=__lv[0],B=__lv[1],l0=affecter(c,A.id,"");const sv=confirmer;const st0=c.statut,n0=S.livraisons.length,f0=S.fonds.length,a0=l0.statut;
  confirmer=()=>false;let e;try{e=cenDirectExec(c,{lid:B.id,quand:__hier,resultat:"livree",montant:soldeCmd(c),mode:"Espèces",recu_par:"X"})}finally{confirmer=sv}
  const act=activeLiv(c.id);return{e,st:c.statut===st0,n:S.livraisons.length===n0,f:S.fonds.length===f0,rest:act&&act.id===l0.id&&act.livreur_id===A.id&&act.statut===a0,circ:!livsOf(c.id).some(x=>x.circuit==="direct"),dir:CEN_DIRECT}});
 chk("RV-1","échec en cours de route : la réaffectation est annulée, l'ancien livreur garde sa mission, aucune livraison ni fonds en trop",!!r.e&&r.st&&r.n&&r.f&&r.rest&&r.circ&&r.dir===false,JSON.stringify(r));
 /* RV-2 dates */
 r=await p.evaluate(()=>{const c=__prete("2"),lv=__lv[0],base={lid:lv.id,resultat:"livree",montant:soldeCmd(c),mode:"Espèces",recu_par:"X"};
  const fut=cenDirectExec(c,Object.assign({quand:new Date(Date.now()+864e5).toISOString()},base));
  const avant=cenDirectExec(c,Object.assign({quand:new Date(Date.now()-30*864e5).toISOString()},base));
  const j=ymd(new Date(__hier));S.clotures_j=[{id:"x",jour:j,par:"t",ts:1,livrees:0,echecs:0,ouverts:0}];const clos=cenDirectExec(c,Object.assign({quand:__hier},base));S.clotures_j=[];
  return{fut,avant,clos,st:c.statut}});
 chk("RV-2","date refusée si dans le futur, antérieure à la commande, ou dans une journée déjà clôturée (la commande n'est pas touchée)",/futur/.test(r.fut)&&/précéder/.test(r.avant)&&/clôturée/.test(r.clos)&&r.st==="prete",JSON.stringify(r));
 /* RV-3 horaires réels conservés */
 r=await p.evaluate(()=>{const c=__prete("3"),lv=__lv[0],l=affecter(c,lv.id,"");const reel=new Date(Date.now()-40*36e5).toISOString();l.affectee_at=reel;
  const e=cenDirectExec(c,{lid:lv.id,quand:__hier,resultat:"livree",montant:soldeCmd(c),mode:"Espèces",recu_par:"X"});const x=livsOf(c.id).find(y=>y.statut==="livree");return{e,aff:x.affectee_at===reel,fin:x.fin_at===__hier}});
 chk("RV-3","l'heure d'affectation déjà réelle est conservée ; seule la fin de livraison reçoit la date saisie",r.e===""&&r.aff&&r.fin,JSON.stringify(r));
 /* RV-4 bonus à la date réelle */
 const bon=await p.evaluate(()=>{const c=__prete("4"),lv=__lv[0],l=affecter(c,lv.id,"");const src=confirmer.toString();return /d\.at\?new Date\(d\.at\)/.test(src)});
 chk("RV-4","le bonus de zone se calcule à la date réelle de la livraison (et non à l'heure de saisie)",bon===true);
 /* RV-5 origine persistée */
 r=await p.evaluate(()=>{const vu=S.users.find(u=>u.role==="vendeur")||S.users.find(u=>u.actif);vu.role="vendeur";const base=S.commandes[0];const c=JSON.parse(JSON.stringify(base));c.id="rv_o";c.numero="CMD-RV-O";c.hist=[{ts:new Date().toISOString(),de:null,a:"brouillon",par:vu.nom,note:"Création"}];delete c.depose_par_vendeur;delete c.app_ref;S.commandes.push(c);
  centreInit();const mig=c.depose_par_vendeur===true;vu.nom="Nom changé";const apres=deposeParVendeur(c);
  const agence=JSON.parse(JSON.stringify(base));agence.id="rv_a";agence.hist=[{ts:1,de:null,a:"brouillon",par:"Agence",note:""}];delete agence.depose_par_vendeur;delete agence.app_ref;S.commandes.push(agence);centreInit();
  return{mig,apres,agence:deposeParVendeur(agence)}});
 chk("RV-5","l'origine « déposée par le vendeur » est enregistrée sur la commande : elle survit au changement de nom du vendeur, les commandes de l'agence restent exclues",r.mig&&r.apres&&r.agence===false,JSON.stringify(r));
 /* RV-6 téléphone */
 r=await p.evaluate(()=>["+225 07 01 02 03 04","0701020304","225 0701020304","00225 0701020304","0033612345678","12345"].map(t=>vendTelIdent({tel:t})));
 const web=fs.readFileSync(path.resolve(__dirname,"../vendeur.html"),"utf8");
 const tel=eval("(function(){"+web.match(/const telIdent=[^\n]+/)[0].replace(/\/\*.*$/,"")+";return telIdent})()");
 const memes=["+225 07 01 02 03 04","0701020304","225 0701020304","00225 0701020304","0033612345678","12345"].map(tel);
 chk("RV-6","le bureau et l'application vendeur normalisent le téléphone de la même façon (y compris les numéros étrangers)",JSON.stringify(r)===JSON.stringify(memes)&&r[4]==="0033612345678",JSON.stringify([r,memes]));
 /* RV-7 accès en masse repris */
 r=await p.evaluate(()=>{const v=S.vendeurs[0];_vendAccesRes=[{v,ident:"0700000001",code:"123456",msg:""}];vendAccesGarde();_vendAccesRes=[];const R=vendAccesRepris();return{n:R.length,code:R[0]&&R[0].code,msg:/Votre identifiant : 0700000001/.test(R[0]&&R[0].msg)}});
 chk("RV-7","accès créés en masse : les codes sont gardés pour la session et retrouvés après un rechargement ou une fermeture de la fenêtre",r.n===1&&r.code==="123456"&&r.msg,JSON.stringify(r));
 /* RV-8 notification vendeur */
 r=await p.evaluate(()=>{const v=S.vendeurs[0];v.ident_serveur=v.ident_serveur||"0700000009";S.push_file=[];const c=__prete("8");c.vendeur_id=v.id;S.config.push_types=null;
  CEN_DIRECT=true;try{setStatut(c,"en_cours","x")}finally{CEN_DIRECT=false}return{n:(S.push_file||[]).length}});
 chk("RV-8","circuit direct : le vendeur ne reçoit plus « en route » juste avant « livrée »",r.n===0,JSON.stringify(r));
 /* serveur : refus de mot de passe ou autre erreur */
 const P=await import("file://"+path.resolve(__dirname,"../supabase/functions/_shared/passerelle.js"));
 const mk=(msgs)=>{let i=0,vus=[];return{vus,db:{vendeurDe:async()=>null,creerUtilisateur:async(e,m)=>{vus.push(m);const x=msgs[i++];if(x)throw new Error(x);return "u1"},ecrireVendeur:async()=>{},retirerCleVendeur:async()=>{}}}};
 const cfg={adminKey:"k"};
 let a=mk(["Password should be at least 8 characters"]);let q=await P.traiterSync(a.db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v",nom:"N",ident:"0700000002"},"k");
 chk("RV-9","refus de mot de passe trop court : un code de 8 chiffres est essayé",q.status===200&&/^\d{8}$/.test(q.body.mdp)&&a.vus.length===2,JSON.stringify([q,a.vus]));
 a=mk(["Too many requests, rate limit"]);q=await P.traiterSync(a.db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v",nom:"N",ident:"0700000002"},"k");
 chk("RV-10","autre erreur (trop de requêtes) : pas de nouvel essai de mot de passe, le vrai message est remonté",q.status===409&&/rate limit/.test(q.body.erreur)&&a.vus.length===1,JSON.stringify([q,a.vus]));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();process.exit(ko?1:0);
})();
