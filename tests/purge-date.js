/* Purge par date (Distributions) : commandes, livraisons, caisse antérieures à la coupure. Usage : node tests/purge-date.js */
const path=require("path");const P=require(path.join(__dirname,"..","purge-date-engine.js"));
let ok=0,ko=0;const chk=(id,l,o,i)=>{console.log(o===true?"PASS":"FAIL",id,l,o===true?"":"-> "+(i||o));o===true?ok++:ko++};
const NOW=Date.parse("2026-11-11T14:00:00"),COUP=P.coupureHier(NOW),J=(j,h)=>new Date(2026,10,j,h||10,0,0).toISOString();   /* J(9) = 9 novembre */
const mk=()=>({
 commandes:[
  {id:"c_vieille",date:J(5),saisie_le:J(5),hist:[{ts:J(5)},{ts:J(6)}]},          /* ancienne, livrée le 6 : supprimée */
  {id:"c_9",date:J(9,23),hist:[{ts:J(9,23)}]},                                   /* 9 novembre 23 h : supprimée */
  {id:"c_hier",date:J(10,8),hist:[{ts:J(10,8)}]},                               /* hier : gardée */
  {id:"c_auj",date:J(11,9),hist:[{ts:J(11,9)}]},                                /* aujourd'hui : gardée */
  {id:"c_active",date:J(7),hist:[{ts:J(7)},{ts:J(10,15)}]},                     /* créée le 7, mais activité hier : gardée */
  {id:"c_retry",date:J(6),hist:[{ts:J(6)}]},                                    /* ancienne mais 2e tentative récente : protégée */
  {id:"c_sans_date",nom:"x"}                                                    /* aucun horodatage : gardée */
 ],
 livraisons:[
  {id:"l_vieille",commande_id:"c_vieille",affectee_at:J(5),fin_at:J(6),hist:[{ts:J(5)}]},
  {id:"l_9",commande_id:"c_9",affectee_at:J(9,23)},
  {id:"l_hier",commande_id:"c_hier",affectee_at:J(10,9)},
  {id:"l_retry1",commande_id:"c_retry",affectee_at:J(6)},
  {id:"l_retry2",commande_id:"c_retry",affectee_at:J(11,8)},
  {id:"l_orpheline_vieille",commande_id:"inconnue",affectee_at:J(3)},
  {id:"l_orpheline_recente",commande_id:"inconnue",affectee_at:J(11,7)}
 ],
 caisse_sessions:[
  {id:"s_vieille",statut:"cloturee",ouverte_le:J(6,8),cloturee_le:J(6,18)},
  {id:"s_ouverte_vieille",statut:"ouverte",ouverte_le:J(8,8)},                  /* encore ouverte : gardée */
  {id:"s_a_cheval",statut:"cloturee",ouverte_le:J(9,22),cloturee_le:J(10,6)},   /* clôturée hier : gardée */
  {id:"s_auj",statut:"ouverte",ouverte_le:J(11,8)}
 ],
 caisse_mvts:[
  {id:"m1",session_id:"s_vieille",cree_le:J(6,9)},
  {id:"m2",session_id:"s_ouverte_vieille",cree_le:J(8,9)},                       /* ancien mais session gardée : gardé */
  {id:"m3",session_id:"s_a_cheval",cree_le:J(9,23)},
  {id:"m4",session_id:"s_auj",cree_le:J(11,9)},
  {id:"m5",session_id:"s_vieille",cree_le:J(11,9)},                             /* date récente mais session supprimée : supprimé avec elle */
  {id:"m6",session_id:null,cree_le:J(2)},                                       /* sans session, ancien : supprimé */
  {id:"m7",session_id:null,cree_le:J(11,9)}
 ],
 caisse_remises:[{id:"r1",cree_le:J(4)},{id:"r2",cree_le:J(11,9)}],
 caisse_reappros:[],caisse_file:[],
 fonds:[{id:"f1",livraison_id:"l_vieille",ts:J(6)},{id:"f2",livraison_id:"l_hier",ts:J(10)}],
 retours:[{id:"rt1",commande_id:"c_vieille"}],
 clients:[{id:"cl1",nom:"Awa",cree_le:J(1)}],users:[{id:"u1"}],config:{org:"X"},audit:[{ts:J(1),a:"x"}],stock_mvts:[{id:"sm1",ts:J(1)}]
});
const ids=(S,k)=>(S[k]||[]).map(x=>x.id).sort().join(",");
const S=mk(),p=P.plan(S,COUP),avant=JSON.stringify(S);
chk("PD-1","l'aperçu ne modifie rien",JSON.stringify(S)===avant);
chk("PD-2","coupure = début d'hier (10 novembre) ; jour affiché 2026-11-10",p.jour==="2026-11-10"&&COUP===new Date(2026,10,10).getTime(),p.jour);
const g=Object.fromEntries(p.groupes.map(x=>[x.cle,x]));
chk("PD-3","aperçu chiffré : commandes 2, livraisons 3, sessions 1, mouvements 3, remises 1 (total 10)",g.commandes.supprimer===2&&g.livraisons.supprimer===3&&g.caisse_sessions.supprimer===1&&g.caisse_mvts.supprimer===3&&g.caisse_remises.supprimer===1&&p.total===10,JSON.stringify(p.groupes.map(x=>[x.cle,x.supprimer])));
chk("PD-4","une commande ancienne liée à une livraison récente est protégée et comptée",p.proteges.commandes===1,JSON.stringify(p.proteges));
const r=P.appliquer(S,COUP);
chk("PD-5","commandes gardées : hier, aujourd'hui, activité récente, protégée, sans date ; supprimées : la vieille et celle du 9",ids(S,"commandes")==="c_active,c_auj,c_hier,c_retry,c_sans_date",ids(S,"commandes"));
chk("PD-6","livraisons : celles des commandes supprimées et l'orpheline ancienne partent ; les deux tentatives d'une commande protégée restent",ids(S,"livraisons")==="l_hier,l_orpheline_recente,l_retry1,l_retry2",ids(S,"livraisons"));
chk("PD-7","caisse : session ouverte et session clôturée hier gardées avec leurs mouvements, même anciens",ids(S,"caisse_sessions")==="s_a_cheval,s_auj,s_ouverte_vieille"&&ids(S,"caisse_mvts")==="m2,m3,m4,m7",ids(S,"caisse_sessions")+" | "+ids(S,"caisse_mvts"));
chk("PD-8","les mouvements d'une session supprimée partent avec elle, même récents ; remise ancienne supprimée",!S.caisse_mvts.some(m=>m.id==="m5")&&ids(S,"caisse_remises")==="r2");
chk("PD-9","clients, utilisateurs, paramétrage, audit, stock : intacts",S.clients.length===1&&S.users.length===1&&S.config.org==="X"&&S.audit.length===1&&S.stock_mvts.length===1);
chk("PD-10","données conservées qui pointent vers du supprimé signalées (encaissements livreur, retours), non supprimées",p.liens.some(x=>x.cle==="fonds"&&x.n===1)&&p.liens.some(x=>x.cle==="retours"&&x.n===1)&&S.fonds.length===2&&S.retours.length===1,JSON.stringify(p.liens));
const arr=S.commandes;P.appliquer(S,COUP);chk("PD-11","second passage : rien de plus supprimé, tableaux modifiés en place",S.commandes===arr&&P.plan(S,COUP).total===0);
const V={commandes:[],livraisons:[]};chk("PD-12","données absentes ou vides : aucun plantage",P.plan(V,COUP).total===0&&P.plan({},COUP).total===0);
chk("PD-13","date invalide refusée, date valide acceptée",P.coupureDe("2026-13-40")===null&&P.coupureDe("abc")===null&&P.coupureDe("2026-11-10")===COUP);
console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
