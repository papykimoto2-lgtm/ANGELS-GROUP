/* Configuration publique de la passerelle livreur (projet Supabase ANGELS-GROUP).
   L'adresse et la clé « anon » sont publiques par conception : l'accès aux données est protégé par la connexion et les règles RLS.
   Ne jamais mettre ici la clé « service_role » ni la clé d'administration. */
window.ANGELS_PASSERELLE = {
  url: "https://gfzqxoolorbejxnxrlji.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmenF4b29sb3JiZWp4bnhybGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDU5NjgsImV4cCI6MjEwNzk4MTk2OH0.wvWjArPEGEdbgYNW4sDhZjyDjWPUID2OsaJ68G2tvpk",
  /* Clé PUBLIQUE VAPID des notifications push (node tools/gen-vapid.js) : vide = notifications push non activées. Jamais la clé privée. */
  vapid: "BOkzfrYx_qdvpZTqY8iThgNtQdSPDJ9mRHSbqp_fiYQqI0sb89HWFi-Au6zzh-sM0GYhDRpVO910CaXWi4J45Z0"
};
