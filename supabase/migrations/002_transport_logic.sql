-- ANGEL'S & CO TRANSPORT — logique métier, intégrité, RLS (à appliquer après 001)

-- ───────────── Utilitaires de sécurité ─────────────
grant usage on schema app to anon, authenticated, service_role;

create or replace function app.perm(p_module text, p_act text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join role_permissions rp on rp.role=p.role
  where p.id=auth.uid() and p.actif and rp.module=p_module and rp.action=p_act)
$$;
create or replace function app.my_driver() returns uuid
language sql stable security definer set search_path=public as $$
 select driver_id from profiles where id=auth.uid() and actif and role='chauffeur'
$$;
create or replace function app.setting(p_key text, p_default text) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select value #>> '{}' from system_settings where key=p_key), p_default)
$$;
create or replace function app.audit(p_action text, p_detail jsonb default null) returns void
language sql security definer set search_path=public as $$
 insert into audit_logs(user_id,action,detail) values(auth.uid(),p_action,p_detail)
$$;
create or replace function app.next_number(p_name text, p_prefix text) returns text
language plpgsql security definer set search_path=public as $$
declare v bigint; pf text;
begin
 insert into numbering_sequences(name,prefix,last_value) values(p_name,p_prefix,0) on conflict do nothing;
 update numbering_sequences set last_value=last_value+1 where name=p_name returning last_value,prefix into v,pf;
 return pf||'-'||to_char(current_date,'YYYY')||'-'||lpad(v::text,5,'0');
end $$;
create or replace function app.haversine(a double precision,b double precision,c double precision,d double precision) returns double precision
language sql immutable as $$
 select 2*6371000*asin(sqrt(power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2)))
$$;
create or replace function app.montant_a(p_contract uuid, p_date date) returns numeric
language sql stable security definer set search_path=public as $$
 select montant from contract_versions where contract_id=p_contract and from_date<=p_date order by from_date desc limit 1
$$;
create or replace function app.solde(p_ob uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select case when o.exo_motif is not null then 0
  else o.montant-coalesce((select sum(a.montant) from payment_allocations a where a.obligation_id=o.id and a.actif),0) end
 from payment_obligations o where o.id=p_ob
$$;

-- ───────────── Intégrité : immutabilité, périodes, équilibre ─────────────
create or replace function app.forbid_delete() returns trigger language plpgsql as $$
begin raise exception 'Suppression interdite sur % : utiliser une annulation ou une extourne', tg_table_name; end $$;
create or replace function app.forbid_update() returns trigger language plpgsql as $$
begin raise exception 'Modification interdite sur %', tg_table_name; end $$;
do $$ declare t text; begin
 foreach t in array array['payments','payment_allocations','receipts','cash_movements','cash_sessions','journal_entries','journal_lines','audit_logs','payment_obligations'] loop
  execute format('create trigger no_delete_%1$s before delete on public.%1$s for each row execute function app.forbid_delete()',t);
 end loop;
end $$;
create trigger no_update_audit before update on public.audit_logs for each row execute function app.forbid_update();

create or replace function app.guard_period() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into accounting_periods(id,statut) values(to_char(new.date,'YYYY-MM'),'ouverte') on conflict do nothing;
 if exists(select 1 from accounting_periods where id=to_char(new.date,'YYYY-MM') and statut='cloturee') then
  raise exception 'Période comptable clôturée : %', to_char(new.date,'YYYY-MM'); end if;
 return new;
end $$;
create trigger guard_period before insert on public.journal_entries for each row execute function app.guard_period();

create or replace function app.check_entry_balance() returns trigger language plpgsql security definer set search_path=public as $$
declare d numeric; c numeric;
begin
 select coalesce(sum(debit),0),coalesce(sum(credit),0) into d,c from journal_lines where entry_id=new.entry_id;
 if d<>c or d=0 then raise exception 'Écriture % déséquilibrée (débit %, crédit %)', new.entry_id, d, c; end if;
 return null;
end $$;
create constraint trigger entry_balanced after insert or update on public.journal_lines
 deferrable initially deferred for each row execute function app.check_entry_balance();

create or replace function app.protect_lines() returns trigger language plpgsql as $$
begin
 if (new.entry_id,new.compte,new.debit,new.credit,new.third_party_id,new.ob,new.vehicle_id) is distinct from
    (old.entry_id,old.compte,old.debit,old.credit,old.third_party_id,old.ob,old.vehicle_id) then
  raise exception 'Une écriture validée ne peut être modifiée : utiliser une extourne'; end if;
 return new;
end $$;
create trigger protect_lines before update on public.journal_lines for each row execute function app.protect_lines();
create or replace function app.protect_entries() returns trigger language plpgsql as $$
begin
 if (new.numero,new.journal,new.date,new.libelle,new.piece) is distinct from (old.numero,old.journal,old.date,old.libelle,old.piece) then
  raise exception 'Une écriture validée ne peut être modifiée'; end if;
 return new;
end $$;
create trigger protect_entries before update on public.journal_entries for each row execute function app.protect_entries();
create or replace function app.protect_payments() returns trigger language plpgsql as $$
begin
 if (new.idempotency_key,new.driver_id,new.montant,new.mode,new.date_valeur,new.type) is distinct from
    (old.idempotency_key,old.driver_id,old.montant,old.mode,old.date_valeur,old.type) then
  raise exception 'Un paiement ne peut être modifié'; end if;
 if old.statut in ('annule','rejete') and new.statut<>old.statut then raise exception 'Paiement définitivement %', old.statut; end if;
 return new;
end $$;
create trigger protect_payments before update on public.payments for each row execute function app.protect_payments();

-- ───────────── Comptabilité : écritures, extourne, lettrage ─────────────
create or replace function app._new_entry(p_journal text, p_date date, p_libelle text, p_piece text, p_source jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare id uuid;
begin
 insert into journal_entries(numero,journal,date,libelle,piece,source,created_by)
 values(app.next_number('je','EC'),p_journal,p_date,p_libelle,p_piece,p_source,auth.uid()) returning journal_entries.id into id;
 return id;
end $$;
create or replace function app.recompute_lettrage(p_ob uuid) returns void
language plpgsql security definer set search_path=public as $$
declare o payment_obligations%rowtype;
begin
 select * into o from payment_obligations where id=p_ob;
 update journal_lines set lettre=case when o.exo_motif is null and app.solde(p_ob)=0 then 'L'||lpad(o.num::text,5,'0') else null end
 where ob=p_ob and compte='411' and not ext;
end $$;
create or replace function app._reverse_entry(p_entry uuid, p_motif text, p_ob uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare e journal_entries%rowtype; x uuid; code text; n int;
begin
 select * into e from journal_entries where id=p_entry for update;
 if not found then raise exception 'Écriture introuvable'; end if;
 x:=app._new_entry(e.journal,current_date,'Extourne '||e.numero||' — '||p_motif,e.piece,jsonb_build_object('type','extourne','id',e.id));
 insert into journal_lines(entry_id,compte,third_party_id,debit,credit,ob,vehicle_id,ext)
  select x,compte,third_party_id,credit,debit,ob,vehicle_id,true from journal_lines
  where entry_id=p_entry and not ext and (p_ob is null or ob=p_ob);
 get diagnostics n=row_count;
 if n=0 then raise exception 'Aucune ligne à extourner'; end if;
 code:='X'||right((select numero from journal_entries where id=x),5);
 update journal_lines set ext=true,lettre=code where entry_id=p_entry and not ext and (p_ob is null or ob=p_ob);
 update journal_lines set lettre=code where entry_id=x;
 if not exists(select 1 from journal_lines where entry_id=p_entry and not ext) then update journal_entries set extournee_par=x where id=p_entry; end if;
 return x;
end $$;
create or replace function public.reverse_entry(p_entry uuid, p_motif text) returns uuid
language plpgsql security definer set search_path=public as $$
declare e journal_entries%rowtype; x uuid;
begin
 if not app.perm('compta','a') then raise exception 'Droits insuffisants'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 select * into e from journal_entries where id=p_entry;
 if not found or coalesce(e.source->>'type','')<>'manual' then raise exception 'Écriture générée par une opération : annuler l''opération source'; end if;
 x:=app._reverse_entry(p_entry,p_motif); perform app.audit('Écriture extournée',jsonb_build_object('entry',p_entry,'motif',p_motif)); return x;
end $$;
create or replace function public.post_manual_entry(p_journal text, p_date date, p_libelle text, p_piece text, p_lines jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare eid uuid; l jsonb;
begin
 if not app.perm('compta','c') then raise exception 'Droits insuffisants'; end if;
 if p_journal not in ('OD','AN') then raise exception 'Journal non autorisé pour une saisie manuelle'; end if;
 if coalesce(btrim(p_libelle),'')='' then raise exception 'Libellé obligatoire'; end if;
 eid:=app._new_entry(p_journal,p_date,p_libelle,p_piece,jsonb_build_object('type','manual'));
 for l in select * from jsonb_array_elements(p_lines) loop
  insert into journal_lines(entry_id,compte,third_party_id,debit,credit)
  values(eid,l->>'compte',nullif(l->>'tiers','')::uuid,coalesce((l->>'debit')::numeric,0),coalesce((l->>'credit')::numeric,0));
 end loop;
 perform app.audit('Écriture manuelle',jsonb_build_object('entry',eid)); return eid;
end $$;
create or replace function public.close_period(p_id text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('compta','a') then raise exception 'Droits insuffisants'; end if;
 if exists(select 1 from cash_sessions where statut='ouverte' and to_char(ouverte_le,'YYYY-MM')=p_id) then raise exception 'Une caisse de cette période est encore ouverte'; end if;
 insert into accounting_periods(id,statut) values(p_id,'cloturee') on conflict(id) do update set statut='cloturee';
 perform app.audit('Période clôturée',jsonb_build_object('periode',p_id));
end $$;
create or replace function public.reopen_period(p_id text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('compta','x') then raise exception 'Droits insuffisants'; end if;
 update accounting_periods set statut='ouverte' where id=p_id; perform app.audit('Période rouverte',jsonb_build_object('periode',p_id));
end $$;

-- ───────────── Contrats et échéances ─────────────
create or replace function public.create_contract(p_mode text,p_vehicle uuid,p_driver uuid,p_montant numeric,p_periodicite text,p_debut date,p_fin date,p_repos text,p_depot numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if not app.perm('contrats','c') then raise exception 'Droits insuffisants'; end if;
 if p_montant<=0 then raise exception 'Montant invalide'; end if;
 if (select statut from vehicles where id=p_vehicle)='sorti' then raise exception 'Véhicule sorti du parc'; end if;
 insert into operating_contracts(numero,mode,vehicle_id,driver_id,periodicite,repos,debut,fin,depot)
 values(app.next_number('ct','CTR'),p_mode,p_vehicle,p_driver,case when p_mode='recette' then 'jour' else coalesce(p_periodicite,'mois') end,coalesce(p_repos,'dimanche'),p_debut,p_fin,coalesce(p_depot,0)) returning id into cid;
 insert into contract_versions(contract_id,from_date,montant,motif,par) values(cid,p_debut,p_montant,'Création',auth.uid());
 if not exists(select 1 from assignments where vehicle_id=p_vehicle and driver_id=p_driver and fin is null) then
  insert into assignments(vehicle_id,driver_id,debut) values(p_vehicle,p_driver,p_debut); end if;
 perform app.audit('Contrat créé',jsonb_build_object('contract',cid)); return cid;
end $$;
create or replace function app._exonerate(p_ob uuid, p_motif text) returns void
language plpgsql security definer set search_path=public as $$
declare eid uuid;
begin
 if exists(select 1 from payment_allocations where obligation_id=p_ob and actif) then raise exception 'Échéance déjà encaissée (même partiellement)'; end if;
 update payment_obligations set exo_motif=p_motif,exo_par=auth.uid(),exo_at=now(),jour='non_travaillee' where id=p_ob and exo_motif is null;
 select entry_id into eid from journal_lines where ob=p_ob and compte='706' and not ext limit 1;
 if eid is not null then perform app._reverse_entry(eid,'Exonération : '||p_motif,p_ob); end if;
end $$;
create or replace function public.exonerate_obligation(p_ob uuid, p_motif text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('planning','a') then raise exception 'Droits insuffisants'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 perform app._exonerate(p_ob,p_motif); perform app.audit('Échéance exonérée',jsonb_build_object('ob',p_ob,'motif',p_motif));
end $$;
create or replace function public.amend_contract(p_id uuid,p_montant numeric,p_from date,p_motif text) returns void
language plpgsql security definer set search_path=public as $$
declare o record; eid uuid; delta numeric;
begin
 if not (app.perm('contrats','e') or app.perm('contrats','a')) then raise exception 'Droits insuffisants'; end if;
 if p_from<current_date and not app.perm('contrats','a') then raise exception 'Modification rétroactive : validation requise'; end if;
 if p_from<current_date and coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire pour une modification rétroactive'; end if;
 if p_montant<=0 then raise exception 'Montant invalide'; end if;
 if exists(select 1 from payment_obligations o join payment_allocations a on a.obligation_id=o.id and a.actif where o.contract_id=p_id and o.date_ech>=p_from) then
  raise exception 'Des échéances déjà encaissées existent après cette date : régulariser d''abord'; end if;
 insert into contract_versions(contract_id,from_date,montant,motif,par) values(p_id,p_from,p_montant,coalesce(p_motif,'Avenant'),auth.uid())
 on conflict(contract_id,from_date) do update set montant=excluded.montant,motif=excluded.motif,par=excluded.par,at=now();
 for o in select id,montant,driver_id,vehicle_id,date_ech from payment_obligations where contract_id=p_id and date_ech>=p_from and exo_motif is null loop
  delta:=app.montant_a(p_id,o.date_ech)-o.montant;
  if delta<>0 then
   update payment_obligations set montant=montant+delta where id=o.id;
   eid:=app._new_entry('VT',current_date,'Régularisation tarif — avenant','ECH-'||o.date_ech,jsonb_build_object('type','regul','ob',o.id));
   insert into journal_lines(entry_id,compte,third_party_id,debit,credit,ob,vehicle_id)
    select eid,'411',d.third_party_id,greatest(delta,0),greatest(-delta,0),o.id,o.vehicle_id from drivers d where d.id=o.driver_id;
   insert into journal_lines(entry_id,compte,debit,credit,ob,vehicle_id) values(eid,'706',greatest(-delta,0),greatest(delta,0),o.id,o.vehicle_id);
  end if;
 end loop;
 perform app.audit('Avenant',jsonb_build_object('contract',p_id,'montant',p_montant,'from',p_from));
end $$;
create or replace function public.terminate_contract(p_id uuid,p_effet date,p_motif text) returns void
language plpgsql security definer set search_path=public as $$
declare c operating_contracts%rowtype; o record;
begin
 if not (app.perm('contrats','e') or app.perm('contrats','a')) then raise exception 'Droits insuffisants'; end if;
 if p_effet<current_date and not app.perm('contrats','a') then raise exception 'Résiliation rétroactive : validation requise'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 select * into c from operating_contracts where id=p_id for update;
 if not found or c.statut<>'actif' then raise exception 'Contrat inactif'; end if;
 if p_effet<c.debut then raise exception 'Date d''effet antérieure au début'; end if;
 update operating_contracts set statut='resilie',effet=p_effet,motif_resil=p_motif where id=p_id;
 for o in select id from payment_obligations po where po.contract_id=p_id and po.date_ech>p_effet and po.exo_motif is null
   and not exists(select 1 from payment_allocations a where a.obligation_id=po.id and a.actif) loop
  perform app._exonerate(o.id,'Résiliation '||c.numero);
 end loop;
 update assignments set fin=p_effet where vehicle_id=c.vehicle_id and driver_id=c.driver_id and fin is null;
 perform app.audit('Contrat résilié',jsonb_build_object('contract',p_id,'effet',p_effet));
end $$;
create or replace function public.generate_obligations(p_upto date) returns integer
language plpgsql security definer set search_path=public as $$
declare n int; d date; eid uuid;
begin
 if auth.uid() is not null and not app.perm('planning','c') then raise exception 'Droits insuffisants'; end if;
 create temp table if not exists _new(id uuid, dt date, montant numeric, driver uuid, vehicle uuid) on commit drop;
 truncate _new;
 with cand as (
  select c.id cid, c.vehicle_id, c.driver_id, x.dt from operating_contracts c
  cross join lateral (
   select dd::date dt from generate_series(c.debut, least(p_upto, coalesce(c.effet,c.fin,p_upto)), interval '1 day') dd
    where c.mode='recette' and not (c.repos='dimanche' and extract(dow from dd)=0)
   union all
   select (c.debut + case c.periodicite when 'mois' then make_interval(months=>k) when 'semaine' then make_interval(days=>7*k) else make_interval(days=>k) end)::date
    from generate_series(0,1200) k where c.mode='location'
     and (c.debut + case c.periodicite when 'mois' then make_interval(months=>k) when 'semaine' then make_interval(days=>7*k) else make_interval(days=>k) end)::date <= least(p_upto, coalesce(c.effet,c.fin,p_upto))
  ) x
  where not exists(select 1 from accounting_periods ap where ap.id=to_char(x.dt,'YYYY-MM') and ap.statut='cloturee')
 ), ins as (
  insert into payment_obligations(contract_id,vehicle_id,driver_id,date_ech,montant)
  select cid,vehicle_id,driver_id,dt,app.montant_a(cid,dt) from cand
  on conflict(contract_id,date_ech) do nothing returning id,date_ech,montant,driver_id,vehicle_id
 ) insert into _new select id,date_ech,montant,driver_id,vehicle_id from ins;
 select count(*) into n from _new;
 for d in select distinct dt from _new order by 1 loop
  eid:=app._new_entry('VT',d,'Échéances du '||to_char(d,'DD/MM/YYYY'),'ECH-'||d,jsonb_build_object('type','echeances','date',d));
  insert into journal_lines(entry_id,compte,third_party_id,debit,ob,vehicle_id)
   select eid,'411',dr.third_party_id,x.montant,x.id,x.vehicle from _new x join drivers dr on dr.id=x.driver where x.dt=d and x.montant>0;
  insert into journal_lines(entry_id,compte,credit,ob,vehicle_id) select eid,'706',x.montant,x.id,x.vehicle from _new x where x.dt=d and x.montant>0;
 end loop;
 return n;
end $$;

-- ───────────── Encaissements, reçus (transactions atomiques) ─────────────
create or replace function public.register_payment(p_idem text,p_driver uuid,p_montant numeric,p_mode text,p_ref text,p_date date,p_type text,p_contract uuid,p_obs uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid; plan jsonb:='[]'; rest numeric:=p_montant; o record; s numeric; take numeric; c operating_contracts%rowtype;
begin
 if not app.perm('encaissements','c') then raise exception 'Droits insuffisants'; end if;
 if p_montant is null or p_montant<=0 then raise exception 'Montant invalide'; end if;
 if p_idem is null or length(p_idem)<8 then raise exception 'Clé d''idempotence requise'; end if;
 if p_mode<>'especes' and coalesce(btrim(p_ref),'')='' then raise exception 'Référence de transaction obligatoire (mobile money / virement)'; end if;
 if exists(select 1 from payments where idempotency_key=p_idem) then raise exception 'Paiement déjà enregistré (doublon bloqué)'; end if;
 if coalesce(p_type,'echeances')='depot' then
  select * into c from operating_contracts where id=p_contract and driver_id=p_driver;
  if not found then raise exception 'Contrat invalide'; end if;
  if c.depot_verse+p_montant>c.depot then raise exception 'Dépôt supérieur au montant prévu'; end if;
 else
  for o in select po.id,po.montant,po.exo_motif from payment_obligations po where po.id=any(p_obs) and po.driver_id=p_driver order by po.date_ech,po.num for update loop
   exit when rest<=0;
   s:=app.solde(o.id);
   if s>0 then take:=least(s,rest); plan:=plan||jsonb_build_array(jsonb_build_object('ob',o.id,'m',take)); rest:=rest-take; end if;
  end loop;
  if rest>0 then raise exception 'Montant supérieur aux soldes sélectionnés'; end if;
 end if;
 insert into payments(idempotency_key,driver_id,type,contract_id,montant,mode,ref,date_valeur,plan,created_by)
 values(p_idem,p_driver,coalesce(p_type,'echeances'),p_contract,p_montant,p_mode,p_ref,p_date,plan,auth.uid()) returning id into pid;
 if p_mode='especes' then perform app._confirm_payment(pid); end if;
 perform app.audit('Paiement saisi',jsonb_build_object('payment',pid,'montant',p_montant,'mode',p_mode));
 return pid;
end $$;
create or replace function app._confirm_payment(p_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare p payments%rowtype; d drivers%rowtype; sess uuid; rid uuid; eid uuid; item jsonb; o payment_obligations%rowtype; treso text; num text; aid uuid;
begin
 select * into p from payments where id=p_id for update;
 if not found then raise exception 'Paiement introuvable'; end if;
 if p.statut='confirme' then raise exception 'Paiement déjà confirmé : aucun double encaissement'; end if;
 if p.statut<>'a_verifier' then raise exception 'Paiement non confirmable'; end if;
 select * into d from drivers where id=p.driver_id;
 if p.mode='especes' then
  select id into sess from cash_sessions where statut='ouverte';
  if sess is null then raise exception 'Aucune caisse ouverte : ouvrir la caisse avant d''encaisser en espèces'; end if;
 end if;
 treso:=case p.mode when 'especes' then app.setting('compte_caisse','571') when 'mobile' then app.setting('compte_mobile','521') else app.setting('compte_banque','521') end;
 num:=app.next_number('rc','REC');
 eid:=app._new_entry(case when p.mode='especes' then 'CAI' else 'BQ' end,p.date_valeur,'Encaissement '||num||' — '||d.nom,num,jsonb_build_object('type','payment','id',p.id));
 insert into journal_lines(entry_id,compte,debit) values(eid,treso,p.montant);
 if p.type='depot' then
  insert into journal_lines(entry_id,compte,third_party_id,credit) values(eid,'165',d.third_party_id,p.montant);
  update operating_contracts set depot_verse=depot_verse+p.montant where id=p.contract_id;
 else
  for item in select * from jsonb_array_elements(p.plan) loop
   select * into o from payment_obligations where id=(item->>'ob')::uuid for update;
   if o.exo_motif is not null or app.solde(o.id)<(item->>'m')::numeric then raise exception 'Le solde d''une échéance a changé : ressaisir le paiement'; end if;
   insert into payment_allocations(payment_id,obligation_id,montant) values(p.id,o.id,(item->>'m')::numeric) returning id into aid;
   insert into journal_lines(entry_id,compte,third_party_id,credit,ob,vehicle_id) values(eid,'411',d.third_party_id,(item->>'m')::numeric,o.id,o.vehicle_id);
   perform app.recompute_lettrage(o.id);
  end loop;
 end if;
 insert into receipts(numero,payment_id,driver_id,montant,par) values(num,p.id,p.driver_id,p.montant,auth.uid()) returning id into rid;
 update payments set statut='confirme',receipt_id=rid,entry_id=eid,confirmed_by=auth.uid(),confirmed_at=now() where id=p.id;
 if p.mode='especes' then
  insert into cash_movements(session_id,sens,montant,categorie,motif,source,par) values(sess,'entree',p.montant,'Encaissement',num||' '||d.nom,jsonb_build_object('type','receipt','id',rid),auth.uid());
 else
  insert into bank_transactions(payment_id,date,montant,mode,ref) values(p.id,p.date_valeur,p.montant,p.mode,p.ref);
 end if;
 perform app.audit('Paiement confirmé',jsonb_build_object('payment',p.id,'receipt',num));
 return rid;
end $$;
create or replace function public.confirm_payment(p_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('encaissements','a') then raise exception 'Droits insuffisants'; end if;
 return app._confirm_payment(p_id);
end $$;
create or replace function public.reject_payment(p_id uuid, p_motif text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('encaissements','a') then raise exception 'Droits insuffisants'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 update payments set statut='rejete',motif=p_motif where id=p_id and statut='a_verifier';
 if not found then raise exception 'Paiement non rejetable'; end if;
 perform app.audit('Paiement rejeté',jsonb_build_object('payment',p_id,'motif',p_motif));
end $$;
create or replace function public.cancel_receipt(p_receipt uuid, p_motif text) returns void
language plpgsql security definer set search_path=public as $$
declare r receipts%rowtype; p payments%rowtype; sess uuid; a record;
begin
 if not app.perm('recus','x') then raise exception 'Droits insuffisants'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 select * into r from receipts where id=p_receipt for update;
 if not found or r.statut='annule' then raise exception 'Reçu introuvable ou déjà annulé'; end if;
 select * into p from payments where id=r.payment_id for update;
 if p.mode='especes' then select id into sess from cash_sessions where statut='ouverte'; if sess is null then raise exception 'Ouvrir la caisse pour enregistrer la sortie liée à l''annulation'; end if; end if;
 perform app._reverse_entry(p.entry_id,'Annulation reçu '||r.numero||' : '||p_motif);
 update payment_allocations set actif=false where payment_id=p.id;
 for a in select distinct obligation_id from payment_allocations where payment_id=p.id loop perform app.recompute_lettrage(a.obligation_id); end loop;
 if p.type='depot' then update operating_contracts set depot_verse=depot_verse-p.montant where id=p.contract_id; end if;
 if p.mode='especes' then insert into cash_movements(session_id,sens,montant,categorie,motif,source,par) values(sess,'sortie',p.montant,'Annulation reçu',r.numero||' : '||p_motif,jsonb_build_object('type','annul','id',r.id),auth.uid());
 else update bank_transactions set annule=true where payment_id=p.id; end if;
 update payments set statut='annule' where id=p.id;
 update receipts set statut='annule',motif=p_motif,annule_par=auth.uid() where id=r.id;
 perform app.audit('Reçu annulé',jsonb_build_object('receipt',r.numero,'motif',p_motif));
end $$;

-- ───────────── Caisse, dépenses ─────────────
create or replace function app.cash_theorique(p_session uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select s.fond+coalesce((select sum(case when m.sens='entree' then m.montant else -m.montant end) from cash_movements m where m.session_id=s.id and m.statut='validee'),0)
 from cash_sessions s where s.id=p_session
$$;
create or replace function public.open_cash(p_fond numeric) returns uuid
language plpgsql security definer set search_path=public as $$
declare last_reel numeric; sid uuid;
begin
 if not app.perm('caisse','c') then raise exception 'Droits insuffisants'; end if;
 select reel into last_reel from cash_sessions where statut='cloturee' order by cloturee_le desc limit 1;
 if last_reel is not null and p_fond<>last_reel then raise exception 'Le fond d''ouverture doit égaler le comptage de la dernière clôture (% F)', last_reel; end if;
 insert into cash_sessions(ouverte_par,fond) values(auth.uid(),p_fond) returning id into sid;
 perform app.audit('Caisse ouverte',jsonb_build_object('fond',p_fond)); return sid;
end $$;
create or replace function app._post_cashout(p_mv uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m cash_movements%rowtype; cpt text; eid uuid;
begin
 select * into m from cash_movements where id=p_mv;
 cpt:=case m.categorie when 'Versement en banque' then '521' when 'Remboursement dépôt de garantie' then '165' when 'Frais divers' then '638' end;
 if cpt is null then return; end if;
 eid:=app._new_entry('CAI',current_date,m.categorie||' — '||coalesce(m.motif,''),'MV-'||right(m.id::text,5),jsonb_build_object('type','cashout','id',m.id));
 insert into journal_lines(entry_id,compte,debit) values(eid,cpt,m.montant);
 insert into journal_lines(entry_id,compte,credit) values(eid,app.setting('compte_caisse','571'),m.montant);
end $$;
create or replace function public.cash_out(p_categorie text,p_montant numeric,p_motif text,p_justificatif text) returns uuid
language plpgsql security definer set search_path=public as $$
declare sess uuid; mid uuid; seuil_j numeric:=app.setting('seuil_justificatif','10000')::numeric; seuil_v numeric:=app.setting('seuil_validation','50000')::numeric; st text;
begin
 if not app.perm('caisse','c') then raise exception 'Droits insuffisants'; end if;
 select id into sess from cash_sessions where statut='ouverte'; if sess is null then raise exception 'Aucune caisse ouverte'; end if;
 if p_categorie not in ('Versement en banque','Remboursement dépôt de garantie','Frais divers') then raise exception 'Catégorie invalide'; end if;
 if coalesce(btrim(p_motif),'')='' then raise exception 'Motif obligatoire'; end if;
 if p_montant>seuil_j and coalesce(btrim(p_justificatif),'')='' then raise exception 'Justificatif obligatoire au-delà de % F', seuil_j; end if;
 if p_montant>app.cash_theorique(sess) then raise exception 'Solde théorique insuffisant'; end if;
 st:=case when p_montant>seuil_v then 'a_valider' else 'validee' end;
 insert into cash_movements(session_id,sens,montant,categorie,motif,justificatif,statut,par) values(sess,'sortie',p_montant,p_categorie,p_motif,p_justificatif,st,auth.uid()) returning id into mid;
 if st='validee' then perform app._post_cashout(mid); end if;
 return mid;
end $$;
create or replace function public.validate_cash_out(p_id uuid,p_ok boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('caisse','a') then raise exception 'Droits insuffisants'; end if;
 update cash_movements set statut=case when p_ok then 'validee' else 'rejetee' end,valide_par=auth.uid() where id=p_id and statut='a_valider';
 if not found then raise exception 'Mouvement non validable'; end if;
 if p_ok then perform app._post_cashout(p_id); end if;
end $$;
create or replace function public.close_cash(p_reel numeric,p_explication text) returns void
language plpgsql security definer set search_path=public as $$
declare sess uuid; th numeric;
begin
 if not app.perm('caisse','e') then raise exception 'Droits insuffisants'; end if;
 select id into sess from cash_sessions where statut='ouverte' for update; if sess is null then raise exception 'Aucune caisse ouverte'; end if;
 if exists(select 1 from cash_movements where session_id=sess and statut='a_valider') then raise exception 'Des sorties attendent validation'; end if;
 th:=app.cash_theorique(sess);
 if p_reel<>th and coalesce(btrim(p_explication),'')='' then raise exception 'Écart de % F : explication obligatoire', p_reel-th; end if;
 update cash_sessions set statut='cloturee',theorique=th,reel=p_reel,ecart=p_reel-th,explication=p_explication,cloturee_le=now(),cloturee_par=auth.uid() where id=sess;
 perform app.audit('Caisse clôturée',jsonb_build_object('ecart',p_reel-th));
end $$;
create or replace function public.validate_expense(p_id uuid,p_mode text,p_ok boolean) returns void
language plpgsql security definer set search_path=public as $$
declare e expenses%rowtype; sess uuid; eid uuid; cpt text;
begin
 if not app.perm('depenses','a') then raise exception 'Droits insuffisants'; end if;
 select * into e from expenses where id=p_id for update;
 if not found or e.statut<>'a_valider' then raise exception 'Dépense non validable'; end if;
 if not p_ok then update expenses set statut='rejetee',valide_par=auth.uid() where id=p_id; return; end if;
 if p_mode='caisse' then
  select id into sess from cash_sessions where statut='ouverte'; if sess is null then raise exception 'Aucune caisse ouverte'; end if;
  if e.montant>app.cash_theorique(sess) then raise exception 'Solde de caisse insuffisant'; end if;
 end if;
 cpt:=case e.categorie when 'Carburant' then '604' when 'Entretien et réparations' then '624' when 'Amendes et pénalités' then '658' else '638' end;
 eid:=app._new_entry(case when p_mode='caisse' then 'CAI' else 'BQ' end,least(e.date,current_date),e.categorie||' — '||coalesce(e.fournisseur,e.numero),e.numero,jsonb_build_object('type','expense','id',e.id));
 insert into journal_lines(entry_id,compte,debit,vehicle_id) values(eid,cpt,e.montant,e.vehicle_id);
 insert into journal_lines(entry_id,compte,credit) values(eid,case when p_mode='caisse' then app.setting('compte_caisse','571') else app.setting('compte_banque','521') end,e.montant);
 if p_mode='caisse' then insert into cash_movements(session_id,sens,montant,categorie,motif,source,par) values(sess,'sortie',e.montant,'Dépense',e.numero||' '||e.categorie,jsonb_build_object('type','expense','id',e.id),auth.uid()); end if;
 update expenses set statut='validee',mode=p_mode,entry_id=eid,valide_par=auth.uid() where id=p_id;
 perform app.audit('Dépense validée',jsonb_build_object('expense',e.numero));
end $$;

-- ───────────── GPS (appelé uniquement par l'Edge Function avec la clé service) ─────────────
create or replace function public.ingest_gps_position(p_ident text,p_lat double precision,p_lng double precision,p_t timestamptz,p_vit numeric)
returns text language plpgsql security definer set search_path=public as $$
declare dev gps_devices%rowtype; rej text;
begin
 select * into dev from gps_devices where ident=p_ident;
 rej:=case
  when not found then 'Dispositif inconnu'
  when not dev.actif or dev.vehicle_id is null then 'Dispositif inactif ou non associé'
  when p_lat is null or p_lng is null or abs(p_lat)>90 or abs(p_lng)>180 then 'Coordonnées invalides'
  when p_t is null then 'Horodatage invalide'
  when p_t>now()+interval '5 minutes' then 'Horodatage dans le futur'
  when p_t<now()-interval '7 days' then 'Horodatage trop ancien'
  when coalesce(p_vit,0)<0 or coalesce(p_vit,0)>250 then 'Vitesse aberrante' end;
 if rej is not null then
  insert into gps_quarantine(ident,lat,lng,t,raison) values(p_ident,p_lat::text,p_lng::text,p_t::text,rej); return 'rejected:'||rej;
 end if;
 insert into gps_positions(device_id,vehicle_id,lat,lng,vitesse,t) values(dev.id,dev.vehicle_id,p_lat,p_lng,coalesce(p_vit,0),p_t);
 if exists(select 1 from geofences) and not exists(select 1 from geofences g where app.haversine(p_lat,p_lng,g.lat,g.lng)<=g.rayon_m)
    and not exists(select 1 from gps_alerts a where a.vehicle_id=dev.vehicle_id and a.type='sortie_zone' and a.t>now()-interval '30 minutes') then
  insert into gps_alerts(vehicle_id,type,texte) values(dev.vehicle_id,'sortie_zone','Sortie de zone autorisée');
 end if;
 return 'ok';
end $$;
create or replace function public.purge_gps() returns integer language plpgsql security definer set search_path=public as $$
declare n int;
begin
 delete from gps_positions where t<now()-make_interval(days=>app.setting('gps_retention_jours','90')::int); get diagnostics n=row_count; return n;
end $$;
create or replace function public.log_gps_access(p_action text,p_detail text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not app.perm('gps','v') then raise exception 'Droits insuffisants'; end if;
 insert into gps_access_log(user_id,action,detail) values(auth.uid(),p_action,p_detail);
end $$;

-- ───────────── Vues ─────────────
create or replace view public.v_obligation_balance with (security_invoker=true) as
 select o.*, app.solde(o.id) as solde, greatest(0, case when app.solde(o.id)>0 and o.date_ech<current_date then current_date-o.date_ech else 0 end) as retard_jours
 from payment_obligations o;
create or replace view public.v_driver_balance with (security_invoker=true) as
 select d.id as driver_id, d.nom, coalesce((select sum(l.debit-l.credit) from journal_lines l where l.third_party_id=d.third_party_id and l.compte='411'),0) as solde
 from drivers d;

-- ───────────── Row Level Security ─────────────
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
-- écritures financières : aucune écriture directe (fonctions SECURITY DEFINER uniquement)
revoke insert,update,delete on public.payments,public.payment_allocations,public.receipts,public.cash_sessions,public.cash_movements,
 public.journal_entries,public.journal_lines,public.payment_obligations,public.bank_transactions,public.audit_logs,public.gps_positions,
 public.gps_quarantine,public.gps_alerts,public.gps_access_log,public.accounting_periods,public.numbering_sequences
 from anon, authenticated;
revoke all on function public.ingest_gps_position(text,double precision,double precision,timestamptz,numeric) from public, anon, authenticated;
revoke all on function public.purge_gps() from public, anon, authenticated;
grant execute on function public.ingest_gps_position(text,double precision,double precision,timestamptz,numeric) to service_role;
grant execute on function public.purge_gps() to service_role;

create policy p_profiles_sel on public.profiles for select using (id=auth.uid() or app.perm('users','v'));
create policy p_profiles_mod on public.profiles for all using (app.perm('users','e')) with check (app.perm('users','e'));
create policy p_roleperm_sel on public.role_permissions for select to authenticated using (true);
create policy p_roleperm_mod on public.role_permissions for all using (app.perm('users','e')) with check (app.perm('users','e') and not (role='admin' and module='users'));
create policy p_settings_sel on public.system_settings for select to authenticated using (true);
create policy p_settings_mod on public.system_settings for all using (app.perm('audit','e')) with check (app.perm('audit','e'));
create policy p_numbering_sel on public.numbering_sequences for select using (app.perm('audit','v'));
create policy p_vehicles_sel on public.vehicles for select using (app.perm('vehicules','v') or exists(select 1 from assignments a where a.vehicle_id=vehicles.id and a.driver_id=app.my_driver() and a.fin is null));
create policy p_vehicles_ins on public.vehicles for insert with check (app.perm('vehicules','c'));
create policy p_vehicles_upd on public.vehicles for update using (app.perm('vehicules','e')) with check (app.perm('vehicules','e'));
create policy p_vstat_sel on public.vehicle_status_history for select using (app.perm('vehicules','v'));
create policy p_vstat_ins on public.vehicle_status_history for insert with check (app.perm('vehicules','e'));
create policy p_vdocs_sel on public.vehicle_documents for select using (app.perm('documents','v') or driver_id=app.my_driver());
create policy p_vdocs_mod on public.vehicle_documents for all using (app.perm('documents','e')) with check (app.perm('documents','c'));
create policy p_drivers_sel on public.drivers for select using (app.perm('chauffeurs','v') or id=app.my_driver());
create policy p_drivers_ins on public.drivers for insert with check (app.perm('chauffeurs','c'));
create policy p_drivers_upd on public.drivers for update using (app.perm('chauffeurs','e')) with check (app.perm('chauffeurs','e'));
create policy p_tp_sel on public.third_parties for select using (app.perm('tiers','v') or driver_id=app.my_driver());
create policy p_tp_ins on public.third_parties for insert with check (app.perm('chauffeurs','c') or app.perm('compta','c'));
create policy p_assign_sel on public.assignments for select using (app.perm('chauffeurs','v') or driver_id=app.my_driver());
create policy p_assign_mod on public.assignments for all using (app.perm('vehicules','e')) with check (app.perm('vehicules','e'));
create policy p_ct_sel on public.operating_contracts for select using (app.perm('contrats','v') or driver_id=app.my_driver());
create policy p_cv_sel on public.contract_versions for select using (app.perm('contrats','v') or exists(select 1 from operating_contracts c where c.id=contract_id and c.driver_id=app.my_driver()));
create policy p_ob_sel on public.payment_obligations for select using (app.perm('echeances','v') or app.perm('planning','v') or driver_id=app.my_driver());
create policy p_pay_sel on public.payments for select using (app.perm('encaissements','v') or app.perm('recus','v') or (driver_id=app.my_driver() and statut='confirme'));
create policy p_alloc_sel on public.payment_allocations for select using (app.perm('echeances','v') or exists(select 1 from payments p where p.id=payment_id and p.driver_id=app.my_driver() and p.statut='confirme'));
create policy p_rec_sel on public.receipts for select using (app.perm('recus','v') or (driver_id=app.my_driver() and statut='valide'));
create policy p_cs_sel on public.cash_sessions for select using (app.perm('caisse','v'));
create policy p_cm_sel on public.cash_movements for select using (app.perm('caisse','v'));
create policy p_ba_sel on public.bank_accounts for select using (app.perm('caisse','v'));
create policy p_bt_sel on public.bank_transactions for select using (app.perm('caisse','v'));
create policy p_bt_upd on public.bank_transactions for update using (app.perm('caisse','e')) with check (app.perm('caisse','e'));
grant update(pointe) on public.bank_transactions to authenticated;
create policy p_recon_sel on public.reconciliations for select using (app.perm('caisse','v') or app.perm('etats','v'));
create policy p_recon_ins on public.reconciliations for insert with check (app.perm('compta','c'));
create policy p_coa_sel on public.chart_of_accounts for select using (app.perm('compta','v') or app.perm('etats','v') or app.perm('caisse','v'));
create policy p_coa_ins on public.chart_of_accounts for insert with check (app.perm('compta','c'));
create policy p_per_sel on public.accounting_periods for select using (app.perm('compta','v') or app.perm('audit','v'));
create policy p_jr_sel on public.journals for select using (app.perm('compta','v') or app.perm('etats','v'));
create policy p_je_sel on public.journal_entries for select using (app.perm('compta','v') or app.perm('etats','v'));
create policy p_jl_sel on public.journal_lines for select using (app.perm('compta','v') or app.perm('etats','v') or app.perm('tiers','v') or exists(select 1 from third_parties t where t.id=third_party_id and t.driver_id=app.my_driver()));
create policy p_gd_sel on public.gps_devices for select using (app.perm('gps','v'));
create policy p_gd_ins on public.gps_devices for insert with check (app.perm('gps','c'));
create policy p_gd_upd on public.gps_devices for update using (app.perm('gps','e')) with check (app.perm('gps','e'));
create policy p_gdh_sel on public.gps_device_history for select using (app.perm('gps','v'));
create policy p_gp_sel on public.gps_positions for select using (app.perm('gps','v'));
create policy p_gq_sel on public.gps_quarantine for select using (app.perm('gps','v'));
create policy p_gf_sel on public.geofences for select using (app.perm('gps','v'));
create policy p_gf_ins on public.geofences for insert with check (app.perm('gps','c'));
create policy p_ga_sel on public.gps_alerts for select using (app.perm('gps','v'));
create policy p_gl_sel on public.gps_access_log for select using (app.perm('audit','v'));
create policy p_mo_sel on public.maintenance_orders for select using (app.perm('maintenance','v'));
create policy p_mo_ins on public.maintenance_orders for insert with check (app.perm('maintenance','c'));
create policy p_mo_upd on public.maintenance_orders for update using (app.perm('maintenance','e')) with check (app.perm('maintenance','e'));
create policy p_mh_sel on public.maintenance_history for select using (app.perm('maintenance','v'));
create policy p_mh_ins on public.maintenance_history for insert with check (app.perm('maintenance','e'));
create policy p_ex_sel on public.expenses for select using (app.perm('depenses','v'));
create policy p_ex_ins on public.expenses for insert with check (app.perm('depenses','c') and created_by=auth.uid() and statut='a_valider');
create policy p_inc_sel on public.incidents for select using (app.perm('sinistres','v') or driver_id=app.my_driver());
create policy p_inc_ins on public.incidents for insert with check (app.perm('sinistres','c') or (driver_id=app.my_driver() and source='portail'));
create policy p_inc_upd on public.incidents for update using (app.perm('sinistres','e')) with check (app.perm('sinistres','e'));
create policy p_att_sel on public.attachments for select using (owner=auth.uid() or app.perm('documents','v'));
create policy p_att_ins on public.attachments for insert with check (owner=auth.uid());
create policy p_rq_sel on public.driver_requests for select using (driver_id=app.my_driver() or app.perm('documents','v'));
create policy p_rq_ins on public.driver_requests for insert with check (driver_id=app.my_driver() and statut='ouverte');
create policy p_rq_upd on public.driver_requests for update using (app.perm('documents','e')) with check (app.perm('documents','e'));
create policy p_nt_sel on public.notifications for select using (app.perm('documents','v') or driver_id=app.my_driver() or (audience='all_drivers' and app.my_driver() is not null));
create policy p_nt_ins on public.notifications for insert with check (app.perm('documents','c') or (audience='staff' and app.my_driver() is not null));
create policy p_nr_all on public.notification_reads for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy p_audit_sel on public.audit_logs for select using (app.perm('audit','v'));
