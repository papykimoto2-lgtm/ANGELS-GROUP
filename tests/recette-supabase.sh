#!/usr/bin/env bash
# Recette SQL (cahier des charges §7) — exige un Postgres de test où 001/002/003 sont appliqués
# et un schéma "auth" minimal (auth.users, auth.uid() lisant request.jwt.claim.sub).
# Usage : PGHOST=/tmp PGPORT=5544 PGUSER=postgres PGDATABASE=t bash tests/recette-supabase.sh
set -u
PSQL="psql -v ON_ERROR_STOP=1 -At -q"
OK=0; KO=0
pg(){ $PSQL -c "$1" 2>&1; }
as(){ $PSQL -c "select set_config('request.jwt.claim.sub','$1',false); set role authenticated; $2" 2>&1 | tail -n +2; }
pass(){ OK=$((OK+1)); echo "PASS $1"; }
fail(){ KO=$((KO+1)); echo "FAIL $1 → $2"; }
expect(){ local n="$1" want="$2"; shift 2; local out; out=$("$@" 2>&1); if [ "$out" = "$want" ]; then pass "$n"; else fail "$n" "attendu [$want] obtenu [$out]"; fi; }
fails(){ local n="$1" pat="$2" u="$3" q="$4" out; out=$(as "$u" "$q"); if echo "$out" | grep -qiE "$pat"; then pass "$n"; else fail "$n" "attendu erreur /$pat/ obtenu [$out]"; fi; }

U_ADM=00000000-0000-0000-0000-0000000000a1; U_DIR=00000000-0000-0000-0000-0000000000a2; U_FLO=00000000-0000-0000-0000-0000000000a3
U_CAI=00000000-0000-0000-0000-0000000000a4; U_CPT=00000000-0000-0000-0000-0000000000a5; U_CA=00000000-0000-0000-0000-0000000000b1; U_CB=00000000-0000-0000-0000-0000000000b2
D_A=00000000-0000-0000-0000-0000000000c1; D_B=00000000-0000-0000-0000-0000000000c2
T_A=00000000-0000-0000-0000-0000000000d1; T_B=00000000-0000-0000-0000-0000000000d2
V_A=00000000-0000-0000-0000-0000000000e1; V_L=00000000-0000-0000-0000-0000000000e2; V_G=00000000-0000-0000-0000-0000000000e3

pg "
insert into auth.users(id) values ('$U_ADM'),('$U_DIR'),('$U_FLO'),('$U_CAI'),('$U_CPT'),('$U_CA'),('$U_CB') on conflict do nothing;
insert into third_parties(id,type,nom,aux) values ('$T_A','chauffeur','Chauffeur A','4110001'),('$T_B','chauffeur','Chauffeur B','4110002') on conflict do nothing;
insert into drivers(id,nom,third_party_id) values ('$D_A','Chauffeur A','$T_A'),('$D_B','Chauffeur B','$T_B') on conflict do nothing;
insert into profiles(id,nom,role,driver_id) values ('$U_ADM','Admin','admin',null),('$U_DIR','Directeur','directeur',null),('$U_FLO','Flotte','flotte',null),('$U_CAI','Caissier','caissier',null),('$U_CPT','Comptable','comptable',null),('$U_CA','Chauffeur A','chauffeur','$D_A'),('$U_CB','Chauffeur B','chauffeur','$D_B') on conflict do nothing;
insert into vehicles(id,immat) values ('$V_A','TEST-A'),('$V_L','TEST-L'),('$V_G','TEST-G') on conflict do nothing;
insert into gps_devices(ident,vehicle_id) values ('GPS-T1','$V_G') on conflict do nothing;
insert into geofences(nom,lat,lng,rayon_m) values ('Abidjan',5.345,-4.03,30000);" >/dev/null

# ───── Contrats, échéances, encaissements
as $U_FLO "select public.create_contract('recette','$V_A','$D_A',15000,null,current_date-2,null,'aucun',0)" >/dev/null
CA=$(pg "select id from operating_contracts where vehicle_id='$V_A'")
as $U_FLO "select public.generate_obligations(current_date)" >/dev/null
expect "REC-01 échéances = montant contractuel (3 × 15 000)" "3|15000" pg "select count(*)||'|'||min(montant) from payment_obligations where contract_id='$CA'"
O1=$(pg "select id from payment_obligations where contract_id='$CA' order by date_ech limit 1")
O2=$(pg "select id from payment_obligations where contract_id='$CA' order by date_ech offset 1 limit 1")
O3=$(pg "select id from payment_obligations where contract_id='$CA' order by date_ech offset 2 limit 1")
expect "ouverture de caisse" "1" as $U_CAI "select count(public.open_cash(0))"
as $U_CAI "select public.register_payment('idem-0001','$D_A',12000,'especes',null,current_date,'echeances',null,array['$O1']::uuid[])" >/dev/null
expect "REC-02 12 000 sur 15 000 → solde 3 000" "3000" pg "select app.solde('$O1')"
as $U_CAI "select public.register_payment('idem-0002','$D_A',3000,'especes',null,current_date,'echeances',null,array['$O1']::uuid[])" >/dev/null
expect "REC-03 soldée, deux imputations conservées" "0|2" pg "select app.solde('$O1')||'|'||count(*) from payment_allocations where obligation_id='$O1' and actif"
fails "REC-04 même clé d'idempotence refusée" "doublon" $U_CAI "select public.register_payment('idem-0001','$D_A',100,'especes',null,current_date,'echeances',null,array['$O2']::uuid[])"
P1=$(pg "select id from payments where idempotency_key='idem-0001'")
fails "REC-04 double confirmation refusée" "déjà confirmé" $U_CAI "select public.confirm_payment('$P1')"
as $U_CAI "select public.register_payment('idem-0003','$D_A',5000,'especes',null,current_date-1,'echeances',null,array['$O2']::uuid[])" >/dev/null
expect "REC-05 date de valeur conservée" "5000|true" pg "select p.montant||'|'||(p.date_valeur=current_date-1) from payments p where idempotency_key='idem-0003'"
fails "REC-06 caissier ne peut pas modifier un tarif" "droits insuffisants" $U_CAI "select public.amend_contract('$CA',16000,current_date+1,'x')"
fails "REC-06 rétroactif sans validation refusé" "validation requise" $U_FLO "select public.amend_contract('$CA',16000,current_date-1,'x')"
as $U_FLO "select public.create_contract('location','$V_L','$D_B',70000,'semaine',current_date-20,null,null,0); select public.generate_obligations(current_date)" >/dev/null
CL=$(pg "select id from operating_contracts where vehicle_id='$V_L'")
as $U_FLO "select public.terminate_contract('$CL',current_date,'Fin de location')" >/dev/null
N1=$(pg "select count(*) from payment_obligations where contract_id='$CL'")
as $U_FLO "select public.generate_obligations(current_date+90)" >/dev/null
expect "REC-07 aucune échéance après la date d'effet" "$N1|0" pg "select count(*)||'|'||count(*) filter (where date_ech>current_date) from payment_obligations where contract_id='$CL'"
fails "REC-08 double contrat sur la même période refusé" "exclusion|conflicting|chevauch|overlap" $U_FLO "select public.create_contract('recette','$V_L','$D_B',9000,null,current_date-3,null,'aucun',0)"
R5=$(pg "select r.id from receipts r join payments p on p.id=r.payment_id where p.idempotency_key='idem-0003'")
fails "REC-09 annulation reçu refusée au caissier" "droits insuffisants" $U_CAI "select public.cancel_receipt('$R5','x')"
as $U_DIR "select public.cancel_receipt('$R5','Erreur de saisie')" >/dev/null
expect "REC-09 annulation tracée, solde restauré, extourne créée" "15000|annule|1" pg "select app.solde('$O2')||'|'||(select statut from receipts where id='$R5')||'|'||(select count(*) from journal_entries where libelle like 'Extourne%Annulation%')"
expect "REC-10 chauffeur A : aucune donnée du chauffeur B" "0|0" as $U_CA "select (select count(*) from payment_obligations where driver_id='$D_B')||'|'||(select count(*) from payments where driver_id='$D_B')"
expect "REC-10 chauffeur A : voit ses échéances" "t" as $U_CA "select count(*)>0 from payment_obligations where driver_id='$D_A'"
fails "POR-04 chauffeur ne peut pas modifier un tarif" "droits insuffisants" $U_CA "select public.amend_contract('$CA',1,current_date+1,'x')"
fails "REC-10 chauffeur ne peut pas encaisser" "droits insuffisants" $U_CA "select public.register_payment('idem-9999','$D_A',100,'especes',null,current_date,'echeances',null,array['$O3']::uuid[])"
as $U_CAI "select public.register_payment('idem-0004','$D_A',15000,'mobile','MM-1',current_date,'echeances',null,array['$O3']::uuid[])" >/dev/null
expect "POR-02 paiement mobile non visible avant confirmation" "0" as $U_CA "select count(*) from payments where idempotency_key='idem-0004'"
P4=$(pg "select id from payments where idempotency_key='idem-0004'")
as $U_CAI "select public.confirm_payment('$P4')" >/dev/null
expect "POR-02 visible après confirmation" "1|1" as $U_CA "select (select count(*) from payments where idempotency_key='idem-0004')||'|'||(select count(*) from receipts where payment_id='$P4')"
fails "REC mobile sans référence refusé" "référence de transaction obligatoire" $U_CAI "select public.register_payment('idem-0005','$D_A',100,'mobile','',current_date,'echeances',null,array['$O3']::uuid[])"

# ───── Caisse, comptabilité
fails "COM-04 clôture avec écart sans explication" "explication obligatoire" $U_CAI "select public.close_cash(1,'')"
expect "COM-04 clôture avec explication" "1" as $U_CAI "select count(*) from (select public.close_cash(1,'Billet manquant')) x" 
expect "COM-04 écart enregistré" "t" pg "select ecart<>0 from cash_sessions where statut='cloturee'"
fails "COM-05 caissier ne peut pas ajouter un compte" "row-level security|violates" $U_CAI "insert into chart_of_accounts values ('999','X','Autre')"
fails "COM-05 caissier ne peut pas clôturer une période" "droits insuffisants" $U_CAI "select public.close_period('2020-01')"
as $U_CPT "select public.close_period(to_char(current_date,'YYYY-MM'))" >/dev/null
fails "COM-05 écriture dans une période clôturée refusée" "clôturée" $U_CPT "select public.post_manual_entry('OD',current_date,'test','p','[{\"compte\":\"571\",\"debit\":100},{\"compte\":\"121\",\"credit\":100}]'::jsonb)"
as $U_DIR "select public.reopen_period(to_char(current_date,'YYYY-MM'))" >/dev/null
fails "COM-08 écriture déséquilibrée refusée" "déséquilibrée" $U_CPT "select public.post_manual_entry('OD',current_date,'test','p','[{\"compte\":\"571\",\"debit\":100},{\"compte\":\"121\",\"credit\":90}]'::jsonb)"
as $U_CPT "select public.post_manual_entry('OD',current_date,'Apport','p','[{\"compte\":\"638\",\"debit\":500},{\"compte\":\"571\",\"credit\":500}]'::jsonb)" >/dev/null
E1=$(pg "select id from journal_entries where libelle='Apport'")
as $U_CPT "select public.reverse_entry('$E1','erreur')" >/dev/null
expect "COM-09 extourne tracée, original conservé" "1|true" pg "select count(*)||'|'||bool_and(extournee_par is not null) from journal_entries where libelle='Apport'"
expect "COM-08 journaux équilibrés" "0" pg "select count(*) from (select entry_id from journal_lines group by entry_id having sum(debit)<>sum(credit)) x"
expect "COM-10 soldes tiers = soldes échéances" "t" pg "select (select coalesce(sum(app.solde(id)),0) from payment_obligations)=(select coalesce(sum(debit-credit),0) from journal_lines where compte='411')"
expect "COM-07 lettrage de l'échéance soldée" "t" pg "select bool_and(lettre is not null) from journal_lines where ob='$O1' and compte='411' and not ext"
expect "COM-06 caisse 571 = mouvements validés" "t" pg "select (select coalesce(sum(debit-credit),0) from journal_lines where compte='571')=(select coalesce(sum(case when sens='entree' then montant else -montant end),0) from cash_movements where statut='validee')"
# ───── Immutabilité
for q in "delete from journal_lines" "delete from payments" "delete from receipts" "delete from audit_logs"; do
 out=$(pg "$q"); if echo "$out" | grep -qi "interdite"; then pass "Immutabilité : $q"; else fail "Immutabilité : $q" "$out"; fi; done
for q in "update journal_lines set debit=debit+1" "update payments set montant=montant+1" "update audit_logs set action='x'"; do
 out=$(pg "$q"); if echo "$out" | grep -qiE "interdite|modifi|ne peut"; then pass "Immutabilité : $q"; else fail "Immutabilité : $q" "$out"; fi; done
fails "Droits : écriture directe d'un paiement refusée" "permission denied" $U_CAI "insert into payments(idempotency_key,driver_id,montant,mode,date_valeur) values('xx12345678','$D_A',1,'especes',current_date)"
# ───── GPS
expect "GPS-01 position valide" "ok" pg "select public.ingest_gps_position('GPS-T1',5.34,-4.08,now(),20)"
expect "GPS-03 coordonnées invalides → quarantaine" "rejected:Coordonnées invalides" pg "select public.ingest_gps_position('GPS-T1',95,-4,now(),0)"
expect "GPS-03 horodatage futur → quarantaine" "rejected:Horodatage dans le futur" pg "select public.ingest_gps_position('GPS-T1',5.3,-4,now()+interval '1 day',0)"
expect "GPS quarantaine alimentée" "2" pg "select count(*) from gps_quarantine"
expect "GPS sortie de zone → alerte" "1" bash -c "$(declare -f pg); PSQL='$PSQL'; pg \"select public.ingest_gps_position('GPS-T1',6.9,-5.2,now(),10)\" >/dev/null; $PSQL -c \"select count(*) from gps_alerts where type='sortie_zone'\""
fails "GPS-05 carte GPS refusée au chauffeur" "." $U_CA "select count(*)/0 from gps_positions"
expect "GPS-05 chauffeur : aucune position visible" "0" as $U_CA "select count(*) from gps_positions"
fails "GPS-05 ingestion interdite aux utilisateurs" "permission denied" $U_FLO "select public.ingest_gps_position('GPS-T1',5.3,-4,now(),0)"
expect "GPS-05 flotte voit les positions" "t" as $U_FLO "select count(*)>0 from gps_positions"
echo; echo "RÉSULTAT : $OK réussis, $KO échecs"; [ $KO -eq 0 ]
