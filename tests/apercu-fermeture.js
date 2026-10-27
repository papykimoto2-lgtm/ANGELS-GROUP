/* Aperçu avant impression : le bouton « Fermer », la touche Échap et le clic hors de la fenêtre ferment réellement l'aperçu (et il se rouvre normalement).
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/apercu-fermeture.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1366,height:768}})).newPage();let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(700);
 const ouvre=async()=>{await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);ANGELS_PRINT.ouvrir({division:"distribution",titre:"Clôture de tournée — TEST",ref:"CT-0004",corps:"<p>Bonjour test</p>"})});await p.waitForTimeout(1200)};
 const etat=()=>p.evaluate(()=>{const e=document.getElementById("ap-ov"),r=e.getBoundingClientRect();return{vis:getComputedStyle(e).display!=="none"&&r.width>0&&r.height>0,scroll:document.body.style.overflow}});
 await ouvre();let s=await etat();
 chk("AF-1","l'aperçu s'ouvre et affiche le document",s.vis&&await p.evaluate(()=>/Bonjour test/.test(document.getElementById("ap-f").contentDocument.body.innerText)));
 await p.click("#ap-x");await p.waitForTimeout(300);s=await etat();
 chk("AF-2","« Fermer » ferme vraiment l'aperçu (plus rien à l'écran) et rend le défilement de la page",!s.vis&&s.scroll==="");
 await ouvre();await p.keyboard.press("Escape");await p.waitForTimeout(300);s=await etat();
 chk("AF-3","la touche Échap ferme l'aperçu",!s.vis);
 await ouvre();await p.mouse.click(8,8);await p.waitForTimeout(300);s=await etat();
 chk("AF-4","un clic en dehors de la fenêtre ferme l'aperçu",!s.vis);
 await ouvre();s=await etat();chk("AF-5","l'aperçu se rouvre normalement après fermeture",s.vis);
 chk("AF-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();process.exit(ko?1:0);
})();
