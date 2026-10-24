/* FNE de bout en bout : orchestrateur des applications (fne-engine.js) → fonction serveur (fne.js) → fausse DGI.
   Simulation, essai DGI, production, double clic, réponse perdue puis reprise, avoirs partiels, environnement qui change.
   Usage : node tests/fne-integration.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 const SV=await import("../supabase/functions/_shared/fne.js"),F=require("../fne-engine.js");
 const m=new Map(),db={lire:async k=>m.get(k)||null,inserer:async(k,l)=>{if(m.has(k))return false;m.set(k,{cle:k,statut:l.statut,reponse:null,maj:l.maj});return true},reprendre:async(k,mj,c)=>{const x=m.get(k);if(!x||x.maj!==mj)return false;Object.assign(x,c);return true},maj:async(k,c)=>{Object.assign(m.get(k),c)}};
 const SEC={FNE_TEST_KEY:"t",FNE_PROD_KEY:"p",FNE_PROD_URL:"https://fne.example.ci"},cfg={syncKey:"K".repeat(32),secret:n=>SEC[n]||""};
 let n=0,mode="ok";const dgiAppels=[];
 const dgi=async(url,o)=>{dgiAppels.push(url);if(mode==="coupe"){mode="ok";throw new Error("reset")}
  const b=JSON.parse(o.body);
  if(/refund/.test(url))return{status:200,json:async()=>({ncc:"9606123E",reference:"A9606123E2500000"+(++n),token:"http://x/v/"+n,warning:false,balance_sticker:170})};
  const tot=Math.round(b.items.reduce((a,i)=>a+i.quantity*i.amount*(1+(i.taxes[0]==="TVA"?.18:0)),0));
  return{status:200,json:async()=>({ncc:"9606123E",reference:"9606123E2500000"+(++n),token:"http://x/v/"+n,warning:false,balance_sticker:179-n,invoice:{id:"inv-0000000"+n,amount:tot,vatAmount:0,items:b.items.map((i,k)=>({id:"it-0000000"+n+k,quantity:i.quantity,reference:i.reference,description:i.description,amount:i.amount}))}})}};
 global.localStorage={_:{angels_sync:JSON.stringify({cle:cfg.syncKey}),angels_supabase:JSON.stringify({url:"https://x.supabase.co"})},getItem(k){return this._[k]||null}};
 global.fetch=async(url,o)=>{const r=await SV.traiterFne(db,cfg,JSON.parse(o.body),o.headers["x-sync-key"],dgi,Date.now());return{ok:r.status<400,status:r.status,json:async()=>r.body}};
 global.AbortController=global.AbortController;
 const S={fne_certs:[]},log=[];let reglages={actif:true,env:"simulation",ncc:"9606123E",etablissement:"ANGEL'S",point_vente:"01",tel_defaut:"0700000000",email_defaut:"a@b.ci"};
 const M=F.moteur({app:"distribution",state:()=>S,cfg:()=>reglages,save:()=>{},audit:(a,d)=>log.push(a+"|"+d),user:()=>"Awa"});
 const src={type:"facture",id:"d1"},fac=()=>({numero:"FAC-2026-0001",type:"sale",client:{nom:"Mariam",tel:"0505111111",email:"m@x.ci"},paiement:"Espèces",tva_taux:18,prix_ttc:true,lignes:[{ref:"R",desc:"Riz",qte:2,pu:14500},{desc:"Huile",qte:1,pu:6500}]});
 const err=async f=>{try{await f();return null}catch(e){return e}};

 reglages.actif=false;chk("FI-1","FNE désactivée : aucune certification possible",/pas activée/.test((await err(()=>M.certifier(src,fac()))).message));reglages.actif=true;
 const c1=await M.certifier(src,fac());
 chk("FI-2","simulation : certifiée localement (SIM…), jamais envoyée à la DGI, environnement mémorisé, total local = total facture",c1.statut==="certifiee"&&/^SIM/.test(c1.ref)&&c1.env==="simulation"&&dgiAppels.length===0&&c1.montant_dgi===35500&&c1.items.length===2&&log[0].startsWith("Facture certifiée FNE (simulation)"),JSON.stringify(c1).slice(0,200));
 chk("FI-3","une facture déjà certifiée dans l'environnement courant n'est jamais certifiée une seconde fois",(await M.certifier(src,fac())).id===c1.id&&S.fne_certs.length===1);
 const a1=await M.avoir(src,[{index:0,quantity:1}],"Retour d'un sac");
 chk("FI-4","avoir partiel (1 sac sur 2) : certifié, rattaché à la facture, montant au prorata (14 500 F)",a1.statut==="certifiee"&&a1.parent===c1.id&&a1.montant===14500&&M.avoirs(c1).length===1,JSON.stringify(a1).slice(0,200));
 chk("FI-5","un second avoir ne peut pas dépasser la quantité restante ; motif obligatoire",/maximum 1/.test((await err(()=>M.avoir(src,[{index:0,quantity:2}],"x"))).message)&&/Motif/.test((await err(()=>M.avoir(src,[{index:0,quantity:1}],""))).message)&&(await M.avoir(src,[{index:0,quantity:1}],"Second sac")).statut==="certifiee"&&/maximum 0/.test((await err(()=>M.avoir(src,[{index:0,quantity:1}],"x"))).message));

 reglages.env="test";const s2={type:"facture",id:"d2"};
 chk("FI-6","passage en environnement de test : la certification de simulation ne vaut plus ; la facture se certifie réellement (via le serveur et la DGI de test)",M.valable(src)===null);
 const c2=await M.certifier(s2,Object.assign(fac(),{numero:"FAC-2026-0002"}));
 chk("FI-7","essai DGI : le serveur appelle /external/invoices/sign, la référence DGI est conservée avec son jeton QR, l'identifiant et les lignes",c2.statut==="certifiee"&&c2.env==="test"&&/^9606123E/.test(c2.ref)&&c2.dgi_id&&c2.items.length===2&&dgiAppels.length===1&&/\/sign$/.test(dgiAppels[0])&&c2.solde_stickers>0,JSON.stringify(c2).slice(0,160));
 const j1=await Promise.allSettled([M.certifier({type:"facture",id:"d3"},fac()),M.certifier({type:"facture",id:"d3"},fac())]),nd3=dgiAppels.length;
 chk("FI-8","double clic simultané : un seul autocollant consommé (un appel DGI), l'autre demande est refusée ou rend le même résultat",j1.some(x=>x.status==="fulfilled")&&nd3===2&&S.fne_certs.filter(c=>c.src.id==="d3").length===1,nd3+" "+JSON.stringify(j1.map(x=>x.status)));
 mode="coupe";const e4=await err(()=>M.certifier({type:"facture",id:"d4"},fac())),r4=S.fne_certs.find(c=>c.src.id==="d4");
 chk("FI-9","réponse perdue : statut INCERTAIN, message clair ; la reprise sans confirmation est refusée",e4&&e4.incertain&&r4.statut==="incertain"&&(await err(()=>M.certifier({type:"facture",id:"d4"},fac()))).incertain===true);
 const c4=await M.certifier({type:"facture",id:"d4"},fac(),{forcer:true});
 chk("FI-10","après vérification sur la plateforme FNE, la reprise confirmée certifie (même enregistrement)",c4.statut==="certifiee"&&c4.id===r4.id&&S.fne_certs.filter(c=>c.src.id==="d4").length===1);
 const a2=await M.avoir(s2,[{index:1,quantity:1}],"Huile périmée");
 chk("FI-11","avoir en essai DGI : appel /refund avec l'identifiant de la facture certifiée et l'identifiant de la ligne",a2.statut==="certifiee"&&/inv-\d+\/refund$/.test(dgiAppels[dgiAppels.length-1])&&a2.montant===6500,dgiAppels[dgiAppels.length-1]);
 reglages.ncc="";const e5=await err(()=>M.certifier({type:"facture",id:"d5"},fac()));reglages.ncc="9606123E";
 chk("FI-12","réglages incomplets : refus AVANT tout envoi (aucun autocollant consommé) avec la liste des problèmes",/NCC/.test(e5.message)&&!S.fne_certs.some(c=>c.src.id==="d5"));
 reglages.env="prod";SEC.FNE_PROD_KEY="";const e6=await err(()=>M.certifier({type:"facture",id:"d6"},fac()));
 chk("FI-13","production non configurée côté serveur : message explicite, enregistrement en échec (réessayable), rien de certifié",/Production non configurée/.test(e6.message)&&S.fne_certs.find(c=>c.src.id==="d6").statut==="echec");
 SEC.FNE_PROD_KEY="p";const c6=await M.certifier({type:"facture",id:"d6"},fac());
 chk("FI-14","production configurée : la certification reprend et réussit sur le même enregistrement ; un essai ou une simulation ne compte pas en production",c6.statut==="certifiee"&&c6.env==="prod"&&S.fne_certs.filter(c=>c.src.id==="d6").length===1&&M.valable(s2)===null);
 reglages.env="simulation";const d=await M.diagnostic();reglages.env="test";const d2=await M.diagnostic();
 chk("FI-15","diagnostic : simulation locale ; essai/production interrogent le serveur (configuré ou non)",d.simulation===true&&d2.configure===true&&!!d2.hote);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0)})();
