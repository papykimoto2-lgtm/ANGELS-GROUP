/* Identité et modules de l'instance. Valeurs par défaut : ANGEL'S GROUP.
   Une instance cliente remplace ce fichier au déploiement : node tools/instance.js <client> (clients/<client>/marque.js). */
window.ERP_MARQUE = {
  id: "angels",
  nom: "ANGEL'S GROUP",
  court: "Angel's Group",
  modules: ["distribution", "transport", "agro"],
  outils: ["portail", "compta", "crm", "parametres"],
  admin: null
};
