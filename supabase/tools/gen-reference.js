// Génère 003_transport_reference.sql depuis la matrice de droits et le plan comptable de transport.html
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../..");
const s=fs.readFileSync(path.join(root,"transport.html"),"utf8").split("<script>")[1].split("</script>")[0];
const a=s.indexOf("const ROLES="),b=s.indexOf("/* ---------- Persistance");
const pl=s.match(/const PLAN=.*\n/)[0],jr=s.match(/const JOURNAUX=.*\n/)[0];
const {defPerms,PLAN,JOURNAUX}=new Function(s.slice(a,b)+pl+jr+";return {defPerms,PLAN,JOURNAUX}")();
const q=x=>"'"+String(x).replace(/'/g,"''")+"'";
let o="-- ANGEL'S & CO TRANSPORT — données de référence (générées par supabase/tools/gen-reference.js)\n";
o+="-- Plan comptable INDICATIF (SYSCOHADA révisé) : à faire valider par le comptable avant production.\n";
o+="insert into public.chart_of_accounts(num,nom,type) values\n"+PLAN.map(p=>"("+p.map(q).join(",")+")").join(",\n")+"\non conflict do nothing;\n\n";
o+="insert into public.journals(code,nom) values\n"+JOURNAUX.map(p=>"("+p.map(q).join(",")+")").join(",\n")+"\non conflict do nothing;\n\n";
const P=defPerms(),rows=[];
Object.keys(P).forEach(r=>Object.keys(P[r]).forEach(m=>P[r][m].forEach(x=>rows.push("("+[r,m,x].map(q).join(",")+")"))));
o+="insert into public.role_permissions(role,module,action) values\n"+rows.join(",\n")+"\non conflict do nothing;\n\n";
const st={seuil_justificatif:10000,seuil_validation:50000,delai_alerte:30,retard_alerte_jours:3,gps_actif_min:10,gps_ancien_min:60,gps_retention_jours:90,compte_caisse:"571",compte_banque:"521",compte_mobile:"521"};
o+="insert into public.system_settings(key,value) values\n"+Object.entries(st).map(([k,v])=>"("+q(k)+","+q(JSON.stringify(v))+"::jsonb)").join(",\n")+"\non conflict do nothing;\n";
fs.writeFileSync(path.join(root,"supabase/migrations/003_transport_reference.sql"),o);
console.log(rows.length+" droits, "+PLAN.length+" comptes");
