/* Construit une instance cliente (marque, modules, couleurs, icônes) à partir du code commun.
   Usage : node tools/instance.js <client>   → dist/<client>/ ; réglages : clients/<client>/{instance.json,marque.js,icons/}.
   Vercel : Build Command « node tools/instance.js <client> », Output Directory « dist/<client> ». Aucun secret dans ces fichiers. */
const fs = require("fs"), path = require("path");
const racine = path.resolve(__dirname, ".."), client = process.argv[2];
if (!client || !/^[a-z0-9-]+$/.test(client)) { console.error("Usage : node tools/instance.js <client>"); process.exit(1); }
const cdir = path.join(racine, "clients", client);
if (!fs.existsSync(path.join(cdir, "instance.json"))) { console.error("Client inconnu : " + client); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(path.join(cdir, "instance.json"), "utf8"));
const out = path.join(racine, "dist", client);
const PAGES = { transport: ["transport.html", "manifest-transport.webmanifest", /^icons\/transport-/], agro: ["agro.html", "manifest-agro.webmanifest", /^icons\/agro-/] };
const TOUJOURS_EXCLUS = /^(tests|tools|supabase|docs|android|clients|dist|node_modules|\.git|\.github|\.claude)(\/|$)|^(README\.md|package.*\.json|vercel\.json)$/;
const TEXTE = /\.(html|js|webmanifest|json)$/;
const exclus = [];
Object.keys(PAGES).forEach(m => { if (!cfg.modules.includes(m)) exclus.push(PAGES[m][0], PAGES[m][1], PAGES[m][2]); });
if (!(cfg.outils || []).includes("compta")) exclus.push("compta-groupe.html");
const rejete = rel => TOUJOURS_EXCLUS.test(rel) || exclus.some(e => e instanceof RegExp ? e.test(rel) : e === rel);
const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function transformer(rel, txt, final) {
  if (rel === "marque.js") return fs.readFileSync(path.join(cdir, "marque.js"), "utf8");
  cfg.remplacements.forEach(([a, b]) => { txt = txt.split(a).join(b); });
  Object.keys(cfg.couleurs || {}).forEach(a => { txt = txt.replace(new RegExp(echapper(a), "gi"), cfg.couleurs[a]); });
  if (rel === "sw.js") {
    txt = txt.replace(/const V = "angels-/, 'const V = "' + client + "-");
    if (final) txt = txt.replace(/const COQUE = \[[\s\S]*?\];/, bloc => bloc.replace(/"([^"]+)",?\s*/g, (m, f) => f === "./" || fs.existsSync(path.join(out, f)) ? m : ""));
  }
  return txt;
}
function copier(dir, rel0) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const rel = rel0 ? rel0 + "/" + e.name : e.name;
    if (rejete(rel)) return;
    const src = path.join(dir, e.name), dst = path.join(out, rel);
    if (e.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); return copier(src, rel); }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (TEXTE.test(e.name)) fs.writeFileSync(dst, transformer(rel, fs.readFileSync(src, "utf8")));
    else fs.copyFileSync(src, dst);
  });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
copier(racine, "");
const ic = path.join(cdir, "icons");
if (fs.existsSync(ic)) fs.readdirSync(ic).forEach(f => fs.copyFileSync(path.join(ic, f), path.join(out, "icons", f)));
/* sw.js : second passage, une fois tous les fichiers présents (la liste de la coque ne garde que ce qui existe) */
const sw = path.join(out, "sw.js");
fs.writeFileSync(sw, transformer("sw.js", fs.readFileSync(sw, "utf8"), true));
/* vercel.json : en-têtes de sécurité identiques, sans la règle de la branche principale propre au dépôt commun. */
const vj = JSON.parse(fs.readFileSync(path.join(racine, "vercel.json"), "utf8"));
delete vj.ignoreCommand;
fs.writeFileSync(path.join(out, "vercel.json"), JSON.stringify(vj, null, 2) + "\n");
console.log("Instance « " + client + " » construite dans " + path.relative(racine, out));
