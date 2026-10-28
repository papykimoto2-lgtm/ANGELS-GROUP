/* Circuit direct : une livraison ancienne validée au bureau ne bloque pas le livreur pour « argent détenu depuis X h » (le délai de reversement part de la saisie). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const e=[];ME=S.users.find(u=>u.actif&&u.role==="admin")||S.users.find(u=>u.actif);ME.role="admin";S.config.delai_reversement_h=24;
  const lv={id:"lvA",nom:"ANGE",statut:"disponible",zone:"Z"};S.livreurs.push(lv);S.clients.push({id:"clX",nom:"C"});
  const c={id:"cA",numero:"CMD-A",client_id:"clX",statut:"en_cours",adr:{zone:"Adjamé"},priorite:"normale",lignes:[],total:1000,frais:0,date:new Date(Date.now()-4*864e5).toISOString(),hist:[]};S.commandes.push(c);
  S.livraisons.push({id:"lA",commande_id:"cA",livreur_id:"lvA",statut:"acceptee",affectee_at:new Date(Date.now()-4*864e5).toISOString(),accept_at:new Date(Date.now()-4*864e5).toISOString(),montant_attendu:1000,hist:[]});
  const m=cenDirectExec(c,{lid:"lvA",quand:new Date(Date.now()-2*864e5).toISOString(),resultat:"livree",montant:1000,mode:"Espèces",recu_par:"Client"});if(m)e.push("saisie : "+m);
  const f=S.fonds.find(x=>x.livraison_id==="lA"&&x.type==="encaissement");if(!f)e.push("encaissement absent");else{
   if(Date.now()-new Date(f.ts)<36e5*40)e.push("date réelle non conservée");if(!f.saisi_le)e.push("saisi_le absent");}
  const h=detenuAge("lvA")/36e5;if(h>1)e.push("délai compté depuis la livraison : "+Math.round(h)+" h");
  const rq=risqueDetenu(lv);if(rq.bloque)e.push("livreur bloqué : "+rq.raisons.join(";"));
  /* un encaissement normal ancien garde son comportement */
  S.fonds.push({id:"fN",type:"encaissement",livreur_id:"lvA",commande_id:"cA",montant:500,mode:"Espèces",ts:new Date(Date.now()-30*36e5).toISOString()});
  S.fonds=S.fonds.filter(x=>x.id!==f.id);if(Math.round(detenuAge("lvA")/36e5)!==30)e.push("encaissement normal : âge inattendu "+detenuAge("lvA")/36e5);
  return e.length?e.join(" | "):true});
 const ok=r===true&&!E.length;console.log(ok?"PASS":"FAIL",r,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
