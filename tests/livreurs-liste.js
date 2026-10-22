/* Liste des livreurs de l'écran de connexion : logique serveur (supabase/functions/_shared/passerelle.js → listerLivreurs). Usage : node tests/livreurs-liste.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const base=[{livreur_ref:"lv1",user_id:"u1",ident:"Koffi.Yves",nom:"Koffi Yves",actif:true,tel:"0700000001"},{livreur_ref:"lv2",user_id:"u2",ident:"traore.ali",nom:"Traoré Ali",actif:true},{livreur_ref:"lv3",user_id:"u3",ident:"ancien.lv",nom:"Ancien",actif:false}];
 const db={livreursActifs:async()=>base.filter(x=>x.actif).map(x=>({ident:x.ident,nom:x.nom,actif:x.actif,user_id:x.user_id,livreur_ref:x.livreur_ref}))};
 const r=await P.listerLivreurs(db,{listeLogin:true});
 chk("LL-1","livreurs actifs seulement (le compte désactivé n'apparaît pas)",r.status===200&&r.body.ok&&r.body.livreurs.length===2&&!r.body.livreurs.some(x=>x.ident==="ancien.lv")?true:JSON.stringify(r.body));
 chk("LL-2","seuls identifiant (minuscules) et nom sont exposés : ni téléphone, ni identifiant interne, ni utilisateur",r.body.livreurs.every(x=>Object.keys(x).sort().join()==="ident,nom")&&r.body.livreurs[0].ident==="koffi.yves"?true:JSON.stringify(r.body.livreurs));
 const off=await P.listerLivreurs(db,{listeLogin:false});
 chk("LL-3","désactivable (LISTE_LIVREURS_LOGIN=0) : liste vide, aucune lecture en base",off.status===200&&off.body.livreurs.length===0?true:JSON.stringify(off.body));
 let lu=0;const spy={livreursActifs:async()=>{lu++;return []}};await P.listerLivreurs(spy,{listeLogin:false});
 chk("LL-4","interrupteur coupé : la base n'est pas interrogée",lu===0?true:lu+" lecture(s)");
 const gros=Array.from({length:300},(_,i)=>({ident:"lv"+i,nom:"N"+i,actif:true}));
 const g=await P.listerLivreurs({livreursActifs:async()=>gros},{listeLogin:true});
 chk("LL-5","plafond de 200 entrées",g.body.livreurs.length===200?true:g.body.livreurs.length);
 const v=await P.listerLivreurs({livreursActifs:async()=>null},{listeLogin:true});
 chk("LL-6","base vide : liste vide sans erreur",v.status===200&&v.body.livreurs.length===0?true:JSON.stringify(v));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
