/* Preuve de livraison : scan des colis (jetons du QR vérifiés par le serveur), signature du livreur ou du client sur son téléphone (lien à usage unique), photo, position.
   Logique serveur testée avec une base en mémoire (vraies fonctions de supabase/functions/_shared).
   Usage : node tests/livraison-preuve.js */
const fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 const G=await import("../supabase/functions/_shared/passerelle.js"),S=await import("../supabase/functions/_shared/signature-client.js");
 const D={mis:{},code:{},colis:{},pre:{},jet:{},ev:[],n:0};
 const db={livreursConnus:async()=>["LV1"],refsAvecEvenementsEnAttente:async()=>[],ecrireMission:async m=>{D.mis[m.livraison_ref]=m},ecrireCode:async(r,h)=>{D.code[r]={code_hash:h,essais:0}},retirerMissions:async()=>{},
  compteParUtilisateur:async u=>u==="U1"?{livreur_ref:"LV1",actif:true}:null,mission:async r=>D.mis[r]||null,code:async r=>D.code[r]||null,majCode:async(r,p)=>Object.assign(D.code[r],p),majMission:async(r,p)=>Object.assign(D.mis[r],p),majPosition:async()=>{},
  ajouterEvenement:async e=>{D.ev.push(Object.assign({id:++D.n},e))},ecrireColis:async(r,L)=>{D.colis[r]=L},colis:async r=>D.colis[r]||[],ecrirePreuve:async(r,p)=>{D.pre[r]=Object.assign(D.pre[r]||{},p)},preuve:async r=>D.pre[r]||null,
  ecrireJeton:async j=>{for(const k of Object.keys(D.jet))if(D.jet[k].livraison_ref===j.livraison_ref)delete D.jet[k];D.jet[j.token_hash]=j},jeton:async h=>D.jet[h]||null,consommerJeton:async h=>{D.jet[h].utilise=true}};
 const cfg={adminKey:"ADM",essaisCodeMax:5},NOW=Date.parse("2026-10-22T10:00:00Z"),R="L-1",NUM="CMD-2026-0007";
 const png="data:image/png;base64,"+"iVBORw0KGgo".repeat(60),jpg="data:image/jpeg;base64,/9j/4AAQ"+"A".repeat(500);
 const pub=async(extra)=>G.traiterSync(db,cfg,{action:"publier",missions:[Object.assign({livraison_ref:R,livreur_ref:"LV1",commande_ref:NUM,statut:"acceptee",code:"4321",colis:[{n:1,tok:"AB2CD"},{n:2,tok:"XY7ZK"}],payload:{numero:NUM,org:"ANGEL'S",lignes:[{desig:"Sac",qte:2}],montant_attendu:15000,exige_colis:true,exige_signature:true}},extra||{})]},"ADM",NOW);
 const act=(type,donnees)=>G.traiterAction(db,cfg,{livraison_ref:R,type,donnees},"U1",NOW);
 let r=await pub();
 chk("PR-1","publication : les jetons des colis ne sont jamais conservés (empreintes seulement) ni visibles dans la mission du livreur",r.status===200&&D.colis[R].length===2&&D.colis[R].every(k=>k.hash.length===64)&&!JSON.stringify(D.mis[R]).includes("AB2CD")&&D.mis[R].payload.colis_total===2&&!("colis" in D.mis[R].payload),JSON.stringify(D.colis));
 const q=(n,t,num)=>({txt:"AGE1|"+(num||NUM)+"|"+n+"/2|"+t,mode:"scan"});
 const razPrise=()=>{D.mis[R].statut="acceptee";delete D.mis[R].payload.collecte_at;delete D.mis[R].payload.nb_colis;D.ev.length=0};
 let x=await act("prise_en_charge",{nb_colis:2,scans:[q(1,"AB2CD")]});chk("PR-2","prise en charge : un colis manquant → ACCEPTÉE (le scan est facultatif), marquée « partiel » avec le colis restant",x.status===200&&D.ev[0].donnees.scan_etat==="partiel"&&/n° 2/.test(D.ev[0].donnees.scan_msg),JSON.stringify(x)+JSON.stringify(D.ev[0]));razPrise();
 x=await act("prise_en_charge",{nb_colis:2,scans:[q(1,"AB2CD"),q(2,"FAUX1")]});chk("PR-3","prise en charge : jeton faux → acceptée, marquée « partiel » (aucun faux colis reconnu)",x.status===200&&D.ev[0].donnees.scan_etat==="partiel"&&!D.ev[0].donnees.scans,JSON.stringify(x));razPrise();
 x=await act("prise_en_charge",{nb_colis:2,scans:[q(1,"AB2CD"),q(2,"XY7ZK","CMD-2026-0099")]});chk("PR-4","prise en charge : étiquette d'une autre commande → acceptée mais tracée avec le nom de l'autre commande",x.status===200&&D.ev[0].donnees.scan_etat==="partiel"&&/CMD-2026-0099/.test(D.ev[0].donnees.scan_msg),JSON.stringify(x));razPrise();
 x=await act("prise_en_charge",{nb_colis:1,scans:[q(1,"AB2CD"),{txt:"xy7zk",mode:"saisi"}]});
 chk("PR-5","prise en charge : QR + code saisi à la main (5 caractères) → acceptée, nombre de colis = celui de la commande, mode enregistré",x.status===200&&D.mis[R].payload.nb_colis===2&&D.ev[0].donnees.scan_etat==="ok"&&D.ev[0].donnees.scans.map(s=>s.mode).join()==="scan,saisi"&&D.ev[0].donnees.nb_colis===2,JSON.stringify(x)+JSON.stringify(D.ev[0]));
 D.mis[R].statut="en_cours";
 const base={code:"4321",montant:15000,mode:"Espèces",recu_par:"Awa K."};
 x=await act("confirmer",Object.assign({},base,{scans:[q(1,"AB2CD")],signature:png}));chk("PR-6","confirmation : colis non tous scannés à la remise → ACCEPTÉE, marquée « partiel » (scan facultatif)",x.status===200&&D.ev.filter(e=>e.type==="confirmer")[0].donnees.scan_etat==="partiel",JSON.stringify(x));{const i=D.ev.findIndex(e=>e.type==="confirmer");if(i>=0)D.ev.splice(i,1);D.mis[R].statut="en_cours"}
 const sc=[q(1,"AB2CD"),q(2,"XY7ZK")];
 x=await act("confirmer",Object.assign({},base,{scans:sc}));chk("PR-7","confirmation : signature exigée (commande ≥ seuil) et absente → refusée, le code reste valide",x.status===400&&/Signature/.test(x.body.erreur)&&D.code[R].essais===0,JSON.stringify(x));
 x=await act("confirmer",Object.assign({},base,{scans:sc,signature:"data:image/png;base64,<script>"}));chk("PR-8","confirmation : signature invalide refusée",x.status===400&&/illisible/.test(x.body.erreur));
 x=await act("confirmer",Object.assign({},base,{scans:sc,signature:png,photo:"data:image/png;base64,AAAA"}));chk("PR-9","confirmation : photo qui n'est pas un JPEG refusée",x.status===400&&/Photo/.test(x.body.erreur));
 /* signature du client sur son téléphone */
 let d=await act("demande_signature",{});const jeton=d.body.jeton;chk("PR-10","le livreur demande un lien de signature : jeton de 16 caractères, 15 minutes ; seule l'empreinte est gardée",d.status===200&&/^[A-Z2-9]{16}$/.test(jeton)&&!JSON.stringify(D.jet).includes(jeton)&&Date.parse(d.body.expire)-NOW===900000,JSON.stringify(d.body));
 let e0=await act("signature_etat",{});chk("PR-11","avant la signature : état « non signée »",e0.body.signee===false);
 const v=await S.voirSignature(db,{t:jeton},NOW);chk("PR-12","le client voit sa commande (numéro, articles, montant) sans adresse ni téléphone",v.status===200&&v.body.numero===NUM&&v.body.lignes[0].desig==="Sac"&&v.body.montant===15000&&!/adr|tel|code|livreur/i.test(JSON.stringify(v.body)),JSON.stringify(v.body));
 const bad=[await S.signerLivraison(db,cfg,{t:jeton,nom:"A",signature:png},"9.9.9.9",NOW),await S.signerLivraison(db,cfg,{t:jeton,nom:"Awa Koffi",signature:"x"},"9.9.9.9",NOW),await S.signerLivraison(db,cfg,{t:"ZZZZZZZZZZZZZZZZ",nom:"Awa Koffi",signature:png},"9.9.9.9",NOW),await S.voirSignature(db,{t:""},NOW)];
 chk("PR-13","signature du client : nom trop court, signature invalide, jeton inconnu ou illisible → refusés, rien enregistré",bad[0].status===400&&bad[1].status===400&&bad[2].status===410&&bad[3].status===400&&!(D.pre[R]&&D.pre[R].signature_client),JSON.stringify(bad.map(b=>b.status)));
 const exp=await S.voirSignature(db,{t:jeton},NOW+16*60000);chk("PR-14","le lien expire au bout de 15 minutes",exp.status===410);
 const sg=await S.signerLivraison(db,cfg,{t:jeton,nom:"Awa Koffi",signature:png,gps:{lat:5.35,lng:-4.0,precision:12}},"7.7.7.7",NOW);
 chk("PR-15","signature du client : enregistrée avec nom, position et heure ; l'adresse du client n'est pas stockée (empreinte salée)",sg.status===200&&D.pre[R].client_nom==="Awa Koffi"&&D.pre[R].client_gps.lat===5.35&&!JSON.stringify(D.pre[R]).includes("7.7.7.7")&&D.pre[R].client_ip.length===64,JSON.stringify(sg));
 const re=await S.signerLivraison(db,cfg,{t:jeton,nom:"Autre",signature:png},"7.7.7.7",NOW);chk("PR-16","le lien est à usage unique : une seconde signature est refusée",re.status===410&&D.pre[R].client_nom==="Awa Koffi");
 e0=await act("signature_etat",{});chk("PR-17","le livreur voit « signée » avec le nom du client",e0.body.signee===true&&e0.body.nom==="Awa Koffi");
 x=await act("confirmer",Object.assign({},base,{scans:sc,photo:jpg,gps:{lat:5.351,lng:-4.001,precision:9}}));
 const ev=D.ev[D.ev.length-1];
 chk("PR-18","confirmation avec la signature du client (sans signature du livreur), photo et position : acceptée ; l'événement indique la source et ne porte pas les images",x.status===200&&D.mis[R].statut==="livree"&&ev.type==="confirmer"&&ev.donnees.signature_source==="client"&&ev.donnees.photo===true&&ev.donnees.gps.lat===5.351&&ev.donnees.scans.length===2&&!JSON.stringify(ev).includes("iVBOR")&&D.pre[R].photo===jpg,JSON.stringify(ev).slice(0,300));
 const pb=await G.traiterSync(db,cfg,{action:"preuve",livraison_ref:R},"ADM",NOW),pm=await G.traiterSync(db,cfg,{action:"preuve",livraison_ref:R},"mauvaise",NOW);
 chk("PR-19","bureau : relève la preuve (signature du client, photo, position) avec la clé d'administration ; sinon refusé",pb.body.preuve.signature_client===png&&pb.body.preuve.photo===jpg&&pm.status===401&&!JSON.stringify(pm.body).includes("iVBOR"));
 /* seconde mission : signature du livreur, sans colis exigés */
 D.mis["L-2"]={livraison_ref:"L-2",livreur_ref:"LV1",commande_ref:"CMD-2",statut:"en_cours",payload:{exige_colis:false,exige_signature:false,montant_attendu:0}};D.code["L-2"]={code_hash:await G.empreinteCode("L-2","1111"),essais:0};
 x=await G.traiterAction(db,cfg,{livraison_ref:"L-2",type:"confirmer",donnees:{code:"1111",montant:0,recu_par:"Paul",signature:png}},"U1",NOW);chk("PR-20","commande sans exigence : signature du livreur facultative mais acceptée (source « livreur »)",x.status===200&&D.ev[D.ev.length-1].donnees.signature_source==="livreur"&&D.pre["L-2"].signature===png,JSON.stringify(x));
 D.mis["L-3"]={livraison_ref:"L-3",livreur_ref:"LV1",commande_ref:"CMD-3",statut:"acceptee",payload:{}};const f=await G.traiterAction(db,cfg,{livraison_ref:"L-3",type:"demande_signature",donnees:{}},"U1",NOW);
 const au=await G.traiterAction(db,cfg,{livraison_ref:R,type:"demande_signature",donnees:{}},"U2",NOW);chk("PR-21","lien de signature : impossible hors livraison en cours, ou pour la mission d'un autre livreur",f.status===409&&au.status===401||au.status===403,JSON.stringify([f.status,au.status]));
 const mig=fs.readFileSync(path.join(root,"supabase/migrations/015_preuves_livraison.sql"),"utf8"),fn=fs.readFileSync(path.join(root,"supabase/functions/livraison-signer/index.js"),"utf8");
 chk("PR-22","base : tables protégées (RLS, aucun droit anon/authenticated, aucune politique), images bornées ; fonction publique de signature sans lecture de la file ni clé",/pg_colis\s+enable row level security/.test(mig)&&/pg_preuves\s+enable row level security/.test(mig)&&/pg_sign_jetons\s+enable row level security/.test(mig)&&/revoke all on public\.pg_colis, public\.pg_preuves, public\.pg_sign_jetons from anon, authenticated/.test(mig)&&!/create policy|grant /i.test(mig)&&/length\(signature\) <= 80000/.test(mig)&&/voirSignature/.test(fn)&&!/traiterSync|adminKey/.test(fn));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
