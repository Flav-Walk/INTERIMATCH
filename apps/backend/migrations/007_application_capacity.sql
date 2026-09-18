-- Refonte produit : la capacité d'une mission devient une contrainte réelle.
--
-- `missions.headcount` existait depuis la migration 004, mais rien ne le lisait :
-- une mission à un poste pouvait accepter dix candidatures. Cette migration en
-- fait un invariant de la base, et non plus une simple donnée d'affichage.
--
-- Pourquoi un déclencheur plutôt qu'une contrainte. Le nombre de postes vit dans
-- `missions`, le nombre de places prises se compte dans `applications` : aucune
-- contrainte CHECK ne peut porter sur deux tables, et aucun index unique ne peut
-- exprimer « au plus N lignes ». Un déclencheur est ici la seule forme qui place
-- la garantie dans la base plutôt que dans la discipline du code appelant.
--
-- Pourquoi il verrouille la mission. `SELECT ... FOR UPDATE` sur la ligne mission
-- sérialise toutes les acceptations d'une même mission, y compris celles de
-- transactions concurrentes. Sans ce verrou, deux acceptations simultanées
-- liraient toutes deux « une place libre » et la prendraient toutes deux — la
-- course exacte qu'il s'agit d'éliminer. Le verrou porte sur la mission, jamais
-- sur la table : deux missions différentes ne se gênent pas.
--
-- Migration strictement additive : aucune colonne, aucune donnée, aucun statut
-- n'est modifié. Les candidatures déjà acceptées restent telles quelles, même si
-- une mission dépassait déjà sa capacité — corriger l'existant est une décision
-- métier, pas un effet de bord de migration.

CREATE FUNCTION applications_enforce_capacity() RETURNS trigger AS $$
DECLARE
 capacity integer;
 taken integer;
BEGIN
 -- Seule l'entrée dans l'état « accepté » consomme un poste. Un refus, une
 -- candidature en attente ou une acceptation déjà enregistrée ne coûtent rien.
 IF NEW.status <> 'accepted' THEN
  RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN
  RETURN NEW;
 END IF;

 SELECT m.headcount INTO capacity
   FROM missions m WHERE m.id = NEW.mission_id
   FOR UPDATE;
 IF NOT FOUND THEN
  RETURN NEW; -- la clé étrangère tranchera ; ce n'est pas le rôle du déclencheur.
 END IF;

 SELECT count(*) INTO taken
   FROM applications
  WHERE mission_id = NEW.mission_id
    AND status = 'accepted'
    AND id <> NEW.id;

 IF taken >= capacity THEN
  RAISE EXCEPTION
   'mission % is full: % of % seats already taken', NEW.mission_id, taken, capacity
   USING ERRCODE = '23514';
 END IF;

 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER applications_capacity
 BEFORE INSERT OR UPDATE OF status ON applications
 FOR EACH ROW EXECUTE FUNCTION applications_enforce_capacity();

-- Le décompte des postes pris et la recherche des engagements d'un intérimaire
-- filtrent tous deux sur le statut : sans cet index, chaque décision parcourt
-- l'ensemble des candidatures de la mission.
CREATE INDEX applications_accepted_idx
 ON applications(mission_id) WHERE status = 'accepted';
CREATE INDEX applications_worker_accepted_idx
 ON applications(worker_id) WHERE status = 'accepted';

-- Les missions offertes sont filtrées sur `status = 'open' AND ends_at > now()`.
-- L'index existant missions_status_idx(status, starts_at) ne couvre pas la
-- borne de fin, qui est celle qui écarte les missions passées.
CREATE INDEX missions_open_idx ON missions(ends_at) WHERE status = 'open';
