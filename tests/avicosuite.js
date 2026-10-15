// Contrôle de fumée : AvicoSuite intégré comme Angel's Agro (avicosuite.html).
const {chromium}=require(process.env.PLAYWRIGHT||"playwright"),path=require("path"),fs=require("fs");
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM}),root=path.resolve(__dirname,"..");let ok=0,ko=0;
 const t=(id,n,r)=>{const v=r===true;v?ok++:ko++;console.log((v?"PASS ":"FAIL ")+id+" "+n+(v?"":" → "+r))};
 const html=fs.readFileSync(path.join(root,"avicosuite.html"),"utf8");
 t("AVI-01","marque Angel's Agro (titre, manifeste), plus de « AviNest Pro » visible",(/<title>Angel’s Agro/.test(html)&&/rel="manifest" href="manifest-avicosuite.webmanifest"/.test(html)&&!/AviNest Pro/.test(html))||"marque");
 t("AVI-02","identifiants internes de chiffrement inchangés (compatibilité des données)",(/SanixAviNest_PBKDF2_2025/.test(html)&&/SanixAviNest_v1/.test(html))||"identifiants modifiés");
 const mf=JSON.parse(fs.readFileSync(path.join(root,"manifest-avicosuite.webmanifest"),"utf8"));
 t("AVI-03","manifeste : start_url, icônes présentes",(mf.start_url==="./avicosuite.html"&&mf.icons.every(i=>fs.existsSync(path.join(root,i.src))))||"manifeste");
 const p=await b.newPage(),errs=[];p.on("pageerror",e=>errs.push(e.message.slice(0,140)));
 await p.goto("file://"+path.join(root,"avicosuite.html"),{waitUntil:"load"});await p.waitForTimeout(2500);
 t("AVI-04","l'application démarre sans erreur JavaScript (écran de configuration de l'organisation)",(errs.length===0&&/Configuration initiale requise|organisation/i.test(await p.evaluate(()=>document.body.innerText)))||errs.join("|"));
 t("AVI-05","titre de page Angel's Agro",(await p.title()).startsWith("Angel’s Agro")||await p.title());
 const hub=fs.readFileSync(path.join(root,"index.html"),"utf8");
 t("AVI-06","accueil (index) : la carte Angel's Agro ouvre avicosuite.html ; la version locale reste accessible",(/href="avicosuite\.html" id="c-agro"/.test(hub)&&/href="agro\.html" id="c-agro-local"/.test(hub))||"hub");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0);
})();
