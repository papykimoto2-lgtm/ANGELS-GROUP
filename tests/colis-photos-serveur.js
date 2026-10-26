/* Photos des colis, côté serveur (supabase/functions/_shared/colis-photos.js) avec une base simulée : publication protégée, images JPEG réduites uniquement, jeu remplacé, purge.
   Usage : node tests/colis-photos-serveur.js */
const fs=require("fs"),path=require("path");
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/colis-photos.js");
 const J=(n)=>"data:image/jpeg;base64,"+"/9j/4AAQ".repeat(Math.max(1,n));
 const mk=()=>{const d={t:new Map(),purge:[],retires:[]};return{d,remplacer:async(ref,L)=>{[...d.t.keys()].filter(k=>k.startsWith(ref+"|")).forEach(k=>d.t.delete(k));L.forEach(l=>d.t.set(ref+"|"+l.n,l))},retirer:async R=>{R.forEach(r=>[...d.t.keys()].filter(k=>k.startsWith(r+"|")).forEach(k=>d.t.delete(k)));d.retires.push(...R)},purger:async l=>{d.purge.push(l)}}};
 const cfg={adminKey:"A".repeat(32)},A=cfg.adminKey,T0=Date.parse("2026-10-26T10:00:00Z");let db=mk();
 const pub=(req,key=A)=>P.publierPhotos(db,cfg,req,key,T0);
 chk("CP-1","clé d'administration obligatoire (absente ou fausse : 401, rien d'écrit)",(await pub({livraisons:[{livraison_ref:"l1",photos:[{n:1,photo:J(5)}]}]},"x")).status===401&&(await P.publierPhotos(db,{},{},"x",T0)).status===401&&db.d.t.size===0);
 let r=await pub({livraisons:[{livraison_ref:"l1",photos:[{n:1,photo:J(5)},{n:2,photo:J(6)},{n:3,photo:J(7)}]}]});
 chk("CP-2","publication : 3 photos de la livraison enregistrées",r.status===200&&r.body.photos===3&&r.body.livraisons===1&&db.d.t.size===3,JSON.stringify(r.body));
 r=await pub({livraisons:[{livraison_ref:"l1",photos:[{n:2,photo:J(9)}]}]});
 chk("CP-3","republication : le nouveau jeu REMPLACE l'ancien (photo 2 mise à jour, photos 1 et 3 retirées)",db.d.t.size===1&&db.d.t.get("l1|2").photo===J(9)&&!db.d.t.has("l1|1"));
 r=await pub({livraisons:[{livraison_ref:"l2",photos:[{n:1,photo:"data:image/png;base64,iVBOR"},{n:2,photo:"data:image/jpeg;base64,<script>"},{n:3,photo:"http://x/y.jpg"},{n:21,photo:J(2)},{n:0,photo:J(2)},{n:4,photo:J(2)},{n:4,photo:J(3)},{n:5,photo:"data:image/jpeg;base64,"+"A".repeat(P.PHOTO_MAX)}]}]});
 const l2=[...db.d.t.keys()].filter(k=>k.startsWith("l2|"));
 chk("CP-4","seules les images JPEG réduites valides sont acceptées (PNG, balise, lien externe, numéro hors 1-20, doublon, image trop lourde : refusés)",l2.join()==="l2|4"&&r.body.refusees===7,JSON.stringify([l2,r.body]));
 await pub({livraisons:[{livraison_ref:"l3",photos:[{n:1,photo:J(2)}]}],retirer:["l1","l2"]});
 chk("CP-5","livraisons terminées : leurs photos sont retirées sur demande du bureau",![...db.d.t.keys()].some(k=>/^l[12]\|/.test(k))&&db.d.t.has("l3|1")&&db.d.retires.join()==="l1,l2");
 chk("CP-6","purge : photos de plus de 7 jours supprimées à chaque publication",db.d.purge.length>0&&Date.parse(db.d.purge[0])===T0-7*864e5);
 db=mk();const lots=Array.from({length:30},(_,i)=>({livraison_ref:"x"+i,photos:[{n:1,photo:J(2)}]}));r=await pub({livraisons:lots});
 chk("CP-7","un envoi est limité à 20 livraisons",r.body.livraisons===20);
 db=mk();const many=Array.from({length:30},(_,i)=>({n:(i%20)+1,photo:J(2)}));r=await pub({livraisons:[{livraison_ref:"y",photos:many}]});
 chk("CP-8","20 colis au plus par livraison",r.body.photos<=20);
 const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/029_colis_photos.sql"),"utf8");
 chk("CP-9","migration : RLS active, aucun accès direct en écriture, lecture limitée aux missions du livreur connecté, JPEG ≤ 70 000 caractères imposé en base",/enable row level security/.test(sql)&&/revoke all on public\.pg_colis_photos from anon, authenticated/.test(sql)&&/grant select \(livraison_ref, n, photo, maj_le\)/.test(sql)&&/pg_livreurs where user_id = \(select auth\.uid\(\)\) and actif/.test(sql)&&/length\(photo\) <= 70000/.test(sql)&&!/grant (insert|update|delete)/i.test(sql));
 console.log(`\nRÉSULTAT : ${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
})();
