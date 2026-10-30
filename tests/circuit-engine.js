/* Moteur de circuits rentables : classement par heure, fiabilité, ancienneté, profil semaine/week-end, répartition de flotte, rapport chauffeur. Sans navigateur. */
const E=require("../circuit-engine.js");let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
const NOW=new Date(2026,9,28,12,0,0).getTime(),jour=n=>{const d=new Date(NOW);d.setDate(d.getDate()-n);return d};
let id=0;const mk=(n,zone,h,montant,drv,dayBack)=>{const d=jour(dayBack);d.setHours(h,15,0,0);return{id:"c"+(id++),driver_id:drv||"d1",zone,montant,t:d.toISOString()}};
/* 20 jours : Plateau chaud le matin (7-9 h), Riviera chaud le soir (17-20 h) */
const C=[];for(let j=1;j<=20;j++){for(const h of[7,8,9])for(let k=0;k<2;k++)C.push(mk(0,"Plateau",h,2500,"d1",j));for(const h of[17,18,19,20])for(let k=0;k<2;k++)C.push(mk(0,"Riviera",h,3000,"d2",j));C.push(mk(0,"Abobo",13,1500,"d1",j))}
const T=E.tableau(C,{now:NOW});
chk("CE-1","assez de données : tableau suffisant, jours comptés",T.suffisant&&T.jours===20,JSON.stringify([T.total,T.jours]));
chk("CE-2","8 h : Plateau en tête",E.meilleures(T,8).liste[0].zone==="Plateau",JSON.stringify(E.meilleures(T,8).liste));
chk("CE-3","18 h : Riviera en tête",E.meilleures(T,18).liste[0].zone==="Riviera");
chk("CE-4","3 h du matin : aucune zone fiable",E.meilleures(T,3).liste.length===0);
chk("CE-5","potentiel Plateau 8 h = 2 courses × 2 500 F par jour d'activité = 5 000 F/h",E.meilleures(T,8).liste[0].pot===5000,E.meilleures(T,8).liste[0].pot);
chk("CE-6","moins de 30 courses : pas de suggestion, nombre manquant indiqué",(()=>{const t=E.tableau(C.slice(0,10),{now:NOW}),m=E.meilleures(t,8);return !t.suffisant&&!m.ok&&m.manque===20&&!m.liste.length})());
chk("CE-7","fiabilité : 'fiable' avec ≥ 20 courses dans la fenêtre, 'indicatif' entre 5 et 19",E.meilleures(T,8).liste[0].fiab==="fiable"&&(()=>{const few=[];for(let j=1;j<=6;j++){few.push(mk(0,"Plateau",8,2500,"d1",j));few.push(mk(0,"Plateau",8,2500,"d1",j))}for(let j=1;j<=8;j++)for(let k=0;k<3;k++)few.push(mk(0,"Abobo",13,1500,"d1",j));const t=E.tableau(few,{now:NOW});return t.zones.Plateau.fiab[8]==="indicatif"})());
/* ancienneté : des courses récentes pèsent plus que de vieilles courses */
const R=[];for(let j=1;j<=40;j++)R.push(mk(0,"Plateau",10,2000,"d1",j+60));for(let j=1;j<=40;j++)R.push(mk(0,"Marcory",10,2000,"d1",j));
const TR=E.tableau(R,{now:NOW}),mr=E.meilleures(TR,10).liste;
chk("CE-8","les courses récentes l'emportent sur les anciennes (demi-vie 30 jours)",mr[0]&&mr[0].zone==="Marcory",JSON.stringify(mr));
/* semaine / week-end : le week-end change le classement quand il y a assez de courses */
const W=[];for(let j=1;j<=60;j++){const d=jour(j),we=d.getDay()===0||d.getDay()===6;for(let k=0;k<3;k++)W.push(mk(0,we?"Riviera":"Plateau",14,2000,"d1",j))}
chk("CE-9","profil week-end distinct du profil semaine",E.meilleures(E.tableau(W,{now:NOW,jour:"weekend"}),14).liste[0].zone==="Riviera"&&E.meilleures(E.tableau(W,{now:NOW,jour:"semaine"}),14).liste[0].zone==="Plateau");
chk("CE-10","profil demandé sans assez de courses : repli sur tous les jours",E.tableau(C.slice(0,50),{now:NOW,jour:"weekend"}).jour===null);
/* position : distance et durée */
const pos={lat:5.3236,lng:-4.0196},mp=E.meilleures(T,8,{pos,max:5}).liste;
chk("CE-11","distance depuis la position du chauffeur (Plateau = 0 km, Riviera plus loin)",mp.find(r=>r.zone==="Plateau").km<0.1&&E.distanceKm(pos,{lat:5.3560,lng:-3.9560})>6,JSON.stringify(mp));
chk("CE-12","filtre de commune (taxi communal) : seules les zones de la commune",(()=>{const l=E.meilleures(E.tableau(C,{now:NOW}),18,{commune:"Cocody",max:5}).liste;return l.length&&l.every(r=>r.commune==="Cocody")})());
/* créneaux et plan */
const cr=E.creneaux(T,7,3);chk("CE-13","créneaux des 3 prochaines heures : Plateau à 7, 8 et 9 h",cr.map(x=>x.meilleure&&x.meilleure.zone).join()==="Plateau,Plateau,Plateau",JSON.stringify(cr));
const P=E.plan(E.tableau((()=>{const a=[];for(let j=1;j<=20;j++){for(let k=0;k<3;k++)a.push(mk(0,"Plateau",18,3000,"d1",j));for(let k=0;k<2;k++)a.push(mk(0,"Riviera",18,3000,"d1",j));for(let k=0;k<1;k++)a.push(mk(0,"Marcory",18,3000,"d1",j))}return a})(),{now:NOW}),18,10);
chk("CE-14","plan : 10 taxis tous placés, plafond de 40 % par zone respecté, zone la plus chaude servie en premier",P.ok&&P.lignes.reduce((s,l)=>s+l.taxis,0)===10&&P.lignes.every(l=>l.taxis<=4)&&P.lignes[0].zone==="Plateau",JSON.stringify(P));
chk("CE-15","plan sans assez de données : aucune répartition",!E.plan(E.tableau([],{now:NOW}),18,10).ok);
/* rapport chauffeur */
const rp=E.rapport(C,[{id:"d1",nom:"Awa"},{id:"d2",nom:"Koffi"}],{now:NOW,jours:7});
chk("CE-16","rapport : courses, recette, zones principales et alignement par chauffeur",rp[0].courses>0&&rp[0].ca>0&&rp[0].zones[0]==="Plateau"&&rp[1].zones[0]==="Riviera",JSON.stringify(rp));
chk("CE-17","alignement : un chauffeur qui travaille dans les zones chaudes de l'heure est à 100 %",rp[1].alignement===100,rp[1].alignement);
chk("CE-18","données invalides ignorées (montant nul, zone vide, date illisible)",E.tableau([{zone:"",montant:100,t:NOW},{zone:"X",montant:0,t:new Date().toISOString()},{zone:"X",montant:100,t:"n'importe quoi"}],{now:NOW}).total===0);
/* itinéraire rentable : enchaînement optimal heure par heure, trajet décompté */
(()=>{const Z=[{nom:"A",commune:"X",lat:5.30,lng:-4.00},{nom:"B",commune:"X",lat:5.32,lng:-4.00},{nom:"Loin",commune:"Y",lat:5.40,lng:-3.80}];
 const I=[];for(let j=1;j<=20;j++){for(const h of[8,9])for(let k=0;k<2;k++)I.push(mk(0,"A",h,2500,"d1",j));for(const h of[9,10])for(let k=0;k<2;k++)I.push(mk(0,"B",h,2600,"d1",j));for(const h of[8,9,10])for(let k=0;k<2;k++)I.push(mk(0,"Loin",h,2700,"d1",j))}
 const TI=E.tableau(I,{now:NOW}),it=E.itineraire(TI,8,3,{zones:Z});
 chk("CE-19","itinéraire : 3 étapes, gain net ≤ brut, étapes avec zone, heure, trajet",it.ok&&it.etapes.length===3&&it.net<=it.brut&&it.etapes.every(x=>x.zone&&x.h>=8&&x.h<=10),JSON.stringify(it));
 chk("CE-20","itinéraire : un détour long est pénalisé — reste dans la zone proche quand le gain brut de la zone lointaine ne compense pas",(()=>{const a=E.itineraire(TI,8,3,{zones:Z,pos:{lat:5.30,lng:-4.00}});return a.etapes[0].zone!=="Loin"||a.etapes[0].min>0})(),JSON.stringify(E.itineraire(TI,8,3,{zones:Z,pos:{lat:5.30,lng:-4.00}})));
 const g=E.regrouper(E.itineraire(TI,8,3,{zones:Z}).etapes);chk("CE-21","regroupement : heures consécutives dans la même zone fusionnées",g.length<=3&&g.reduce((s,x)=>s+(x.a-x.de+1),0)===3,JSON.stringify(g));
 chk("CE-22","itinéraire : sans assez de courses, rien n'est proposé",!E.itineraire(E.tableau([],{now:NOW}),8,4).ok&&E.itineraire(E.tableau([],{now:NOW}),8,4).manque===30);
 chk("CE-23","itinéraire : heure sans zone fiable (3 h) → étape vide, le chauffeur reste sur place",(()=>{const a=E.itineraire(TI,3,2,{zones:Z});return a.ok&&a.etapes.length===2&&a.etapes.every(x=>!x.zone)&&a.net===0})());
 chk("CE-24","itinéraire : filtre de commune respecté",E.itineraire(TI,8,3,{zones:Z,commune:"X"}).etapes.every(x=>!x.zone||x.commune==="X"));
 const opt=E.itineraire(TI,8,3,{zones:Z}),glouton=(()=>{let v=0,prev=null;for(let i=0;i<3;i++){const m=E.meilleures(TI,8+i,{max:1,zones:Z}).liste[0],z=Z.find(q=>q.nom===m.zone),d=prev&&prev.nom!==z.nom?E.distanceKm(prev,z):0;v+=m.pot*(1-Math.min(1,d/20));prev=z}return v})();
 chk("CE-25","itinéraire : au moins aussi bon que le choix glouton heure par heure",opt.net>=Math.round(glouton)-1,JSON.stringify([opt.net,glouton]))})();
console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");process.exit(ko?1:0);
