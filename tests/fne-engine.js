/* Facture normalisée électronique (moteur fne-engine.js) : gabarits, TVA, remises, validation, avoirs, simulation.
   Usage : node tests/fne-engine.js */
const F=require("../fne-engine.js");let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
const K={ncc:"9606123E",etablissement:"ANGEL'S GROUP Yopougon",point_vente:"01",tel_defaut:"0700000000",email_defaut:"compta@angels.ci"};
const fac=(o)=>Object.assign({numero:"FAC-2026-0001",type:"sale",client:{nom:"Boutique Mariam",tel:"05 05 11 11 11",email:"m@x.ci"},paiement:"Wave",tva_taux:18,prix_ttc:true,lignes:[{ref:"P-RIZ",desc:"Riz 25 kg",qte:2,pu:14500},{ref:"",desc:"Frais de livraison",qte:1,pu:1500}]},o||{});
const lanc=fn=>{try{fn();return null}catch(e){return e.message}};

let p=F.construire(fac(),K);
chk("FN-1","vente B2C : prix TTC → prix unitaire HT à 18 %, code TVA, moyen de paiement (Wave → mobile-money), téléphone nettoyé, établissement et point de vente repris des réglages",
 p.invoiceType==="sale"&&p.template==="B2C"&&p.paymentMethod==="mobile-money"&&p.items[0].taxes[0]==="TVA"&&Math.abs(p.items[0].amount-14500/1.18)<0.01&&p.clientPhone==="0505111111"&&p.establishment===K.etablissement&&p.pointOfSale==="01"&&p.isRne===false,JSON.stringify(p).slice(0,300));
chk("FN-2","le total recalculé localement retombe sur le TTC de l'application (16 700 F au franc près)",Math.abs(F.totaux(p).ttc-(2*14500+1500))<=1,JSON.stringify(F.totaux(p)));
chk("FN-3","modes de paiement : espèces, Orange/MTN/Moov/Wave, virement, chèque, carte, à terme ; inconnu → espèces",
 [["Espèces","cash"],["Orange Money","mobile-money"],["MTN MoMo","mobile-money"],["Moov Money","mobile-money"],["Virement","transfer"],["Chèque","check"],["Carte bancaire","card"],["À terme","deferred"],["Autre","cash"]].every(([a,b])=>F.modePaiement(a)===b));
chk("FN-4","gabarit : client avec NCC → B2B (NCC en majuscules transmis) ; étranger → B2F ; sinon réglage par défaut",
 F.construire(fac({client:{nom:"SARL X",tel:"0102030405",email:"a@b.ci",ncc:"9502363n"}}),K).template==="B2B"&&F.construire(fac({client:{nom:"SARL X",tel:"0102030405",email:"a@b.ci",ncc:"9502363n"}}),K).clientNcc==="9502363N"&&F.construire(fac({client:{nom:"Acme",tel:"0102030405",email:"a@b.ci",etranger:true},devise:"EUR",taux_change:655}),K).template==="B2F"&&F.gabarit({template:"B2G"},K)==="B2G");
chk("FN-5","codes de TVA : 18 → TVA, 9 → TVAB, 0 → exonération choisie (conventionnelle par défaut ; export séparé) ; autre taux refusé",
 F.codeTva(18,K)==="TVA"&&F.codeTva(9,K)==="TVAB"&&F.codeTva(0,K)==="TVAC"&&F.codeTva(0,Object.assign({},K,{tva_zero:"TVAD"}))==="TVAD"&&F.codeTva(0,Object.assign({},K,{tva_export:"TVAD"}),"export")==="TVAD"&&/non pris en charge/.test(lanc(()=>F.codeTva(7,K))||""));
p=F.construire(fac({tva_taux:0,prix_ttc:true}),K);
chk("FN-6","sans TVA (taux 0) : prix unitaire inchangé, code d'exonération, total identique",p.items.every(i=>i.taxes[0]==="TVAC")&&p.items[0].amount===14500&&F.totaux(p).ttc===30500,JSON.stringify(F.totaux(p)));
p=F.construire(fac({remise:3050}),K);
chk("FN-7","remise globale en francs → pourcentage de la DGI (3 050 F sur 30 500 F = 10 %) ; total net recalculé",p.discount===10&&Math.abs(F.totaux(p).ttc-27450)<=1,p.discount+" "+JSON.stringify(F.totaux(p)));
p=F.construire(fac({lignes:[{desc:"A",qte:2,pu:1000,remise:10},{desc:"B",qte:1,pu:500,code:"TVAB"}]}),K);
chk("FN-8","remise par ligne en pourcentage et code de TVA forcé sur une ligne (9 %)",p.items[0].discount===10&&p.items[1].taxes[0]==="TVAB"&&Math.abs(p.items[1].amount-500/1.09)<0.01);
chk("FN-9","vente valide : aucun problème",F.valider(F.construire(fac(),K),K).length===0,F.valider(F.construire(fac(),K),K).join("|"));
const faux=F.valider(F.construire(fac({client:{nom:"",tel:"",email:""}}),{}),{});
chk("FN-10","réglages manquants (NCC, établissement, point de vente), téléphone et e-mail absents : tout est signalé avant l'envoi",faux.length>=5&&faux.some(x=>/NCC/.test(x))&&faux.some(x=>/Point de vente/.test(x))&&faux.some(x=>/Établissement/.test(x))&&faux.some(x=>/Téléphone/.test(x))&&faux.some(x=>/E-mail/.test(x)),faux.join("|"));
const b2b=F.valider(F.construire(fac({client:{nom:"SARL",tel:"0102030405",email:"a@b.ci",template:"B2B"}}),K),K);
chk("FN-11","facture entreprise (B2B) sans NCC du client refusée",b2b.some(x=>/NCC du client/.test(x)),b2b.join("|"));
p=F.construire(fac({client:{nom:"Acme",tel:"0102030405",email:"a@b.ci",etranger:true},devise:"USD",taux_change:0}),K);
chk("FN-12","client étranger avec devise sans taux de change refusé ; avec taux accepté",F.valider(p,K).some(x=>/Taux/i.test(x))&&F.valider(F.construire(fac({client:{nom:"Acme",tel:"0102030405",email:"a@b.ci",etranger:true},devise:"USD",taux_change:600}),K),K).length===0);
const v0=F.valider(F.construire(fac({lignes:[{desc:"",qte:0,pu:-5}]}),K),K);
chk("FN-13","ligne sans désignation, quantité nulle, prix négatif : refusées avec le numéro de ligne",v0.some(x=>/Ligne 1 : désignation/.test(x))&&v0.some(x=>/quantité/.test(x))&&v0.some(x=>/prix/.test(x)),v0.join("|"));
chk("FN-14","téléphone et e-mail par défaut utilisés pour un client comptoir sans coordonnées",F.valider(F.construire(fac({client:{nom:"",tel:"",email:""}}),K),K).length===0);
const rep={ncc:"9606123E",reference:"9606123E25000000019",token:"http://54.247.95.108/fr/verification/019465c1",warning:false,balance_sticker:179,invoice:{id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",amount:30500,vatAmount:4655,items:[{id:"bf9cc241-9b5f-4d26-a570-aa8e682a759e",quantity:2,reference:"P-RIZ",description:"Riz 25 kg",amount:12288.14},{id:"50b5c9d9-e22d-4dce-ba3c-5d2519c3418f",quantity:1,reference:"",description:"Livraison",amount:1271.19}]}};
const cert=F.certification(rep,{env:"test"});
chk("FN-15","réponse de la DGI → enregistrement : référence, jeton QR, identifiants des lignes, solde d'autocollants, environnement",cert.statut==="certifiee"&&cert.ref==="9606123E25000000019"&&cert.dgi_id&&cert.items.length===2&&cert.solde_stickers===179&&cert.env==="test"&&cert.alerte_stickers===false);
const av=F.avoirPayload(cert,[{index:0,quantity:1}],[]);
chk("FN-16","avoir : quantités par ligne, identifiant de la facture certifiée ; refus au-delà de la quantité facturée ou déjà rendue ; facture non certifiée refusée",
 av.id===cert.dgi_id&&av.items[0].quantity===1&&/maximum 2/.test(lanc(()=>F.avoirPayload(cert,[{index:0,quantity:3}],[]))||"")&&/maximum 1/.test(lanc(()=>F.avoirPayload(cert,[{index:0,quantity:2}],[{items:[{id:cert.items[0].id,quantity:1}]}]))||"")&&/pas certifiée/.test(lanc(()=>F.avoirPayload({statut:"x"},[]))||"")&&/au moins une/.test(lanc(()=>F.avoirPayload(cert,[{index:0,quantity:0}],[]))||""));
const reste=F.reste(cert,[{items:[{id:cert.items[0].id,quantity:1}]}]);
chk("FN-17","quantités encore rendables par ligne après un premier avoir",reste[cert.items[0].id]===1&&reste[cert.items[1].id]===1);
const pf=F.construire(fac(),K);
chk("FN-18","montant d'un avoir au prorata des quantités rendues (1 sac sur 2 = 14 500 F)",Math.abs(F.montantAvoir(pf,cert,[{id:cert.items[0].id,quantity:1}])-14500)<=1,F.montantAvoir(pf,cert,[{id:cert.items[0].id,quantity:1}]));
chk("FN-19","écart avec le total de la DGI : toléré à 1 F par ligne, signalé au-delà",F.ecart(Object.assign({},cert,{montant_dgi:30501}),pf)===0&&F.ecart(Object.assign({},cert,{montant_dgi:31500}),pf)===1000);
const sim=F.simuler(pf,1,"x"),cs=F.certification(sim,{env:"simulation"});
chk("FN-20","simulation de formation : même forme de réponse que la DGI, référence marquée SIM, jamais prise pour une vraie (jeton « simulation:// », QR non imprimé)",/^SIM/.test(sim.reference)&&/^simulation:\/\//.test(sim.token)&&cs.items.length===2&&F.avoirPayload(cs,[{index:0,quantity:1}],[]).items.length===1&&!/<svg/.test(F.bloc(cs,()=>"<svg>")));
const bl=F.bloc(Object.assign({},cert,{env:"test"}),t=>"<svg>"+t+"</svg>");
chk("FN-21","impression : mention « Facture normalisée électronique », numéro certifié, QR ; bandeau « sans valeur fiscale » hors production ; aucun bandeau en production",/FACTURE NORMALISÉE ÉLECTRONIQUE/.test(bl)&&/9606123E25000000019/.test(bl)&&/<svg>/.test(bl)&&/SANS VALEUR FISCALE/.test(bl)&&!/SANS VALEUR/.test(F.bloc(Object.assign({},cert,{env:"prod"}),t=>"<svg/>"))&&F.bloc({statut:"x"},null)==="");
chk("FN-22","réglages : valeurs par défaut (FNE inactif, simulation) ; les valeurs fournies l'emportent",F.cfg().actif===false&&F.cfg().env==="simulation"&&F.cfg({env:"test",ncc:"X"}).env==="test"&&F.cfg({ncc:null}).ncc==="");
console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
