-- Un même identifiant d'action (cid) ne peut être enregistré qu'une fois par livraison : double appui ou rejeu simultané sans doublon.
create unique index if not exists pg_evenements_cid_uniq on public.pg_evenements (livraison_ref, (donnees->>'cid')) where donnees ? 'cid';
