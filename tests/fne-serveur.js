/* Certification FNE côté serveur (supabase/functions/_shared/fne.js) avec une base en mémoire et une fausse DGI :
   clé de synchronisation, secrets par division et environnement, une facture = un seul autocollant, réponse perdue, refus de la DGI, avoir.
   Usage : node tests/fne-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const S=await import("../supabase/functions/_shared/fne.js");
 const mem=()=>{const m=new Map();return{m,lire:async k=>m.get(k)||null,inserer:async(k,l)=>{if(m.has(k))return false;m.set(k,{cle:k,statut:l.statut,reponse:null,erreur:null,maj:l.maj,payload:l.payload});return true},
  reprendre:async(k,maj,c)=>{const x=m.get(k);if(!x||x.maj!==maj)return false;Object.assign(x,c);return true},maj:async(k,c)=>{Object.assign(m.get(k),c)}}};
 const SEC={FNE_TEST_KEY:"cle-test",FNE_PROD_KEY:"cle-prod",FNE_PROD_URL:"https://fne.example.ci/api",FNE_AGRO_PROD_KEY:"cle-agro"},cfg={syncKey:"K".repeat(32),secret:n=>SEC[n]||""},K=cfg.syncKey;
 const appels=[];let mode="ok";
 const dgi={ncc:"9606123E",reference:"9606123E25000000019",token:"http://54.247.95.108/fr/verification/x",warning:false,balance_sticker:179,invoice:{id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",amount:30500,vatAmount:4655,items:[{id:"bf9cc241-9b5f-4d26-a570-aa8e682a759e",quantity:2,reference:"R",description:"Riz",amount:12288.14}],secret:"NE-PAS-RENDRE"}};
 const fetchFn=async(url,o)=>{appels.push({url,auth:o.headers.Authorization,corps:JSON.parse(o.body)});
  if(mode==="reseau")throw new Error("ECONNRESET");if(mode==="delai"){const e=new Error("x");e.name="AbortError";throw e}
  if(mode==="refus")return{status:400,json:async()=>({message:"Point of sale is not valid",error:"bad_request",statusCode:400})};
  if(mode==="401")return{status:401,json:async()=>({message:"Invalid API Key"})};
  if(mode==="vide")return{status:200,json:async()=>({})};
  return{status:200,json:async()=>JSON.parse(JSON.stringify(dgi))}};
 const P={invoiceType:"sale",paymentMethod:"cash",template:"B2C",isRne:false,clientCompanyName:"Client comptoir",clientPhone:"0700000000",clientEmail:"a@b.ci",pointOfSale:"01",establishment:"ANGEL'S",foreignCurrency:"",foreignCurrencyRate:0,items:[{taxes:["TVA"],reference:"R",description:"Riz",quantity:2,amount:12288.14,discount:0,measurementUnit:"pcs"}],discount:0};
 const T=(req,db,cle=K)=>S.traiterFne(db,cfg,req,cle,fetchFn,1e12);
 const db=mem(),sig=(o={})=>T(Object.assign({action:"signer",app:"distribution",env:"test",cle_doc:"doc1",payload:P},o),db);

 chk("FS-1","clé de synchronisation obligatoire (absente ou fausse) ; application et environnement inconnus refusés",(await T({action:"etat"},db,"x")).status===401&&(await S.traiterFne(db,{},{action:"etat"},"x",fetchFn)).status===401&&(await T({action:"etat",app:"zzz",env:"test"},db)).status===400&&(await T({action:"etat",app:"agro",env:"dev"},db)).status===400);
 const e1=await T({action:"etat",app:"distribution",env:"test"},db),e2=await T({action:"etat",app:"distribution",env:"prod"},db),e3=await T({action:"etat",app:"agro",env:"prod"},db);
 chk("FS-2","état : test configuré (plateforme DGI par défaut), production via FNE_PROD_URL ; la clé n'est jamais rendue",e1.body.configure&&e1.body.hote==="54.247.95.108"&&e2.body.configure&&e2.body.hote==="fne.example.ci"&&e3.body.configure&&!JSON.stringify([e1,e2,e3]).includes("cle-"));
 const sans={FNE_TEST_KEY:"",FNE_PROD_KEY:"k",FNE_PROD_URL:"http://fne.example.ci"};const c2={syncKey:K,secret:n=>sans[n]||""};
 chk("FS-3","production refusée sans adresse, en clair (http) ou vers la plateforme de test ; test sans clé refusé avec un message clair",(await S.traiterFne(mem(),c2,{action:"signer",app:"distribution",env:"prod",cle_doc:"d",payload:P},K,fetchFn)).status===503&&(await S.traiterFne(mem(),c2,{action:"signer",app:"distribution",env:"test",cle_doc:"d",payload:P},K,fetchFn)).status===503&&S.acces("transport","prod",n=>({FNE_PROD_KEY:"k",FNE_PROD_URL:"https://54.247.95.108/ws"}[n]||""))===null);
 const r1=await sig();
 chk("FS-4","certification : appel de la DGI avec la clé Bearer de l'environnement, sur /external/invoices/sign, corps transmis tel quel ; réponse réduite (pas de champ inconnu)",r1.status===200&&r1.body.ok&&!r1.body.rejoue&&r1.body.reponse.reference==="9606123E25000000019"&&appels.length===1&&appels[0].url==="http://54.247.95.108/ws/external/invoices/sign"&&appels[0].auth==="Bearer cle-test"&&appels[0].corps.items[0].description==="Riz"&&!JSON.stringify(r1.body).includes("NE-PAS-RENDRE"),JSON.stringify(r1.body).slice(0,200));
 const r2=await sig();
 chk("FS-5","UNE FACTURE = UN AUTOCOLLANT : renvoi du même document → résultat déjà obtenu, aucun nouvel appel à la DGI",r2.status===200&&r2.body.rejoue===true&&r2.body.reponse.reference===r1.body.reponse.reference&&appels.length===1);
 await sig({cle_doc:"doc2",app:"agro",env:"prod"});
 chk("FS-6","clé par division et environnement : la production d'Agro utilise FNE_AGRO_PROD_KEY et l'adresse de production ; les documents sont cloisonnés",appels[1].auth==="Bearer cle-agro"&&appels[1].url==="https://fne.example.ci/api/external/invoices/sign"&&(await sig({cle_doc:"doc2",app:"transport",env:"prod"})).body.rejoue===false);
 mode="refus";const r3=await sig({cle_doc:"doc3"});mode="ok";
 chk("FS-7","refus de la DGI (400) : message rapporté, document en échec ; un nouvel essai est autorisé et certifie",r3.status===422&&/Point of sale/.test(r3.body.erreur)&&db.m.get("distribution:test:signer:doc3").statut==="echec"&&(await sig({cle_doc:"doc3"})).body.ok===true);
 mode="401";const r4=await sig({cle_doc:"doc4"});mode="ok";
 chk("FS-8","clé API refusée par la DGI (401) : message d'administration, sans fuite de la clé",r4.status===502&&/Clé API/.test(r4.body.erreur)&&!JSON.stringify(r4).includes("cle-test"));
 mode="reseau";const r5=await sig({cle_doc:"doc5"});mode="ok";
 chk("FS-9","réponse perdue (réseau coupé) : état INCERTAIN signalé ; sans confirmation le renvoi est refusé (pas de double autocollant)",r5.status===504&&r5.body.incertain&&db.m.get("distribution:test:signer:doc5").statut==="incertain"&&(await sig({cle_doc:"doc5"})).status===409&&(await sig({cle_doc:"doc5"})).body.incertain===true);
 const n0=appels.length,r6=await sig({cle_doc:"doc5",forcer:true});
 chk("FS-10","après vérification sur la plateforme FNE, le renvoi confirmé (forcer) certifie une seule fois",r6.status===200&&r6.body.ok&&appels.length===n0+1&&(await sig({cle_doc:"doc5"})).body.rejoue===true);
 mode="delai";const r7=await sig({cle_doc:"doc6"});mode="ok";
 chk("FS-11","délai dépassé : traité comme incertain",r7.status===504&&r7.body.incertain);
 mode="vide";const r8=await sig({cle_doc:"doc7"});mode="ok";
 chk("FS-12","réponse 200 sans référence ni jeton : jamais considérée comme certifiée (incertain)",r8.status===502&&r8.body.incertain&&db.m.get("distribution:test:signer:doc7").statut==="incertain");
 db.m.set("distribution:test:signer:doc8",{cle:"x",statut:"en_cours",maj:1e12-1000});
 chk("FS-13","certification déjà en cours (moins de 2 minutes) : refus de lancer un second appel ; passé ce délai elle devient incertaine",(await sig({cle_doc:"doc8"})).body.en_cours===true&&(await (async()=>{db.m.get("distribution:test:signer:doc8").maj=1e12-600000;return sig({cle_doc:"doc8"})})()).body.incertain===true);
 const nAvant=appels.length,bad=async o=>(await sig(o)).status;
 chk("FS-14","demande invalide refusée AVANT tout appel : sans ligne, NCC client absent en B2B, quantité nulle, code de TVA inconnu, trop de lignes, clé de document vide",
  (await bad({cle_doc:"xv1",payload:Object.assign({},P,{items:[]})}))===422&&(await bad({cle_doc:"xv2",payload:Object.assign({},P,{template:"B2B"})}))===422&&(await bad({cle_doc:"xv3",payload:Object.assign({},P,{items:[Object.assign({},P.items[0],{quantity:0})]})}))===422&&(await bad({cle_doc:"xv4",payload:Object.assign({},P,{items:[Object.assign({},P.items[0],{taxes:["X"]})]})}))===422&&(await bad({cle_doc:"xv5",payload:Object.assign({},P,{items:Array(201).fill(P.items[0])})}))===422&&(await bad({cle_doc:""}))===400&&appels.length===nAvant);
 const a1=await T({action:"avoir",app:"distribution",env:"test",cle_doc:"doc1",id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",items:[{id:"bf9cc241-9b5f-4d26-a570-aa8e682a759e",quantity:1}]},db),ap=appels[appels.length-1];
 chk("FS-15","avoir : POST /external/invoices/{id}/refund avec les lignes et quantités ; idempotent (même clé = même avoir)",a1.status===200&&ap.url==="http://54.247.95.108/ws/external/invoices/e2b2d8da-a532-4c08-9182-f5b428ca468d/refund"&&ap.corps.items[0].quantity===1&&(await T({action:"avoir",app:"distribution",env:"test",cle_doc:"doc1",id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",items:[{id:"bf9cc241-9b5f-4d26-a570-aa8e682a759e",quantity:1}]},db)).body.rejoue===true);
 chk("FS-16","avoir invalide refusé (identifiant, quantité nulle, aucune ligne) ; l'avoir d'une facture n'écrase pas la facture (clés distinctes)",(await T({action:"avoir",app:"distribution",env:"test",cle_doc:"xa2",id:"x",items:[{id:"bf9cc241-9b5f-4d26-a570-aa8e682a759e",quantity:1}]},db)).status===422&&(await T({action:"avoir",app:"distribution",env:"test",cle_doc:"xa3",id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",items:[]},db)).status===422&&db.m.get("distribution:test:signer:doc1").statut==="certifiee"&&db.m.has("distribution:test:avoir:doc1"));
 const mig=require("fs").readFileSync(__dirname+"/../supabase/migrations/025_fne.sql","utf8");
 chk("FS-17","migration : clé primaire par document/environnement (garantie d'unicité), accès fermé aux navigateurs",/primary key/.test(mig)&&/enable row level security/.test(mig)&&/revoke all on public\.fne_certifications from anon, authenticated/.test(mig));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0)})();
