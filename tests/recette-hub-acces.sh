#!/usr/bin/env bash
# Recette SQL de 033_hub_acces.sql. Postgres de test avec 006, 019, 033 appliqués et un schéma auth minimal.
# Usage : PGHOST=/tmp PGPORT=5544 PGUSER=postgres PGDATABASE=t bash tests/recette-hub-acces.sh
set -u
OK=0; KO=0
q(){ psql -v ON_ERROR_STOP=1 -At -q -c "$1" 2>&1; }
as(){ psql -At -q -c "select set_config('request.jwt.claim.sub','$1',false); set role $2; $3" 2>&1 | tail -n +2; }
t(){ if echo "$3" | grep -qE "$2"; then OK=$((OK+1)); echo "PASS $1"; else KO=$((KO+1)); echo "FAIL $1 → [$3]"; fi; }
D=00000000-0000-0000-0000-0000000000a1; C=00000000-0000-0000-0000-0000000000a2; X=00000000-0000-0000-0000-0000000000a3; I=00000000-0000-0000-0000-0000000000a4
q "truncate public.hub_profils, public.hub_acces_journal, public.sync_enreg cascade; truncate auth.users cascade;
insert into auth.users(id) values ('$D'),('$C'),('$X'),('$I');
insert into public.hub_profils(user_id,nom,role,actif) values ('$D','Dir','directeur',true),('$C','Cpt','autre',true),('$I','Inactif','admin',false);
insert into public.sync_enreg(app,coll,id,data) values ('transport','payments','p1','{\"montant\":5}'),('transport','users','u1','{\"nom\":\"x\",\"pwd\":\"secret\"}'),('distribution','commandes','c1','{\"total\":9}'),('agro','audit','a1','{\"x\":1}');" >/dev/null
t "HUB-SQL-1 directeur : lecture consolidée" '"payments"' "$(as $D authenticated 'select public.hub_consolide_lire()')"
t "HUB-SQL-2 comptes, mots de passe et journaux exclus" '^0$' "$(as $D authenticated "select count(*) from jsonb_array_elements(public.hub_consolide_lire()->'transport') e where e->>'coll' in ('users')" ; )"
t "HUB-SQL-3 rôle « autre » : refusé" '"refuse": true' "$(as $C authenticated 'select public.hub_consolide_lire()')"
t "HUB-SQL-4 utilisateur sans profil : refusé" '"refuse": true' "$(as $X authenticated 'select public.hub_consolide_lire()')"
t "HUB-SQL-5 profil désactivé : refusé" '"refuse": true' "$(as $I authenticated 'select public.hub_consolide_lire()')"
t "HUB-SQL-6 anonyme : exécution interdite" 'permission denied' "$(as $D anon 'select public.hub_consolide_lire()')"
t "HUB-SQL-7 aucune lecture directe de sync_enreg" 'permission denied' "$(as $D authenticated 'select count(*) from public.sync_enreg')"
t "HUB-SQL-8 aucun accès au journal d'accès" 'permission denied' "$(as $D authenticated 'select count(*) from public.hub_acces_journal')"
t "HUB-SQL-9 profils : chacun ne voit que le sien" '^1$' "$(as $D authenticated 'select count(*) from public.hub_profils')"
t "HUB-SQL-10 profils : écriture directe interdite" 'permission denied' "$(as $D authenticated "update public.hub_profils set role='admin' where user_id='$C'")"
t "HUB-SQL-11 refus et accès journalisés" '^3\|2$' "$(q "select count(*) filter (where not ok)||'|'||count(*) filter (where ok) from public.hub_acces_journal")"
echo; echo "$OK PASS / $KO FAIL"; [ "$KO" = 0 ]
