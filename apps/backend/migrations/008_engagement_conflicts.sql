-- Un intérimaire ne peut pas être engagé deux fois sur le même créneau.
--
-- La règle existait déjà dans le service : `decide()` refuse une acceptation
-- qui chevaucherait une mission déjà acceptée (`WORKER_ENGAGED`). Elle était
-- juste, mais elle n'était pas une garantie.
--
-- POURQUOI ELLE NE SUFFISAIT PAS. `decide()` verrouille la ligne **mission**.
-- Deux entreprises qui acceptent la même personne au même instant, sur deux
-- missions différentes qui se chevauchent, verrouillent deux lignes
-- différentes : rien ne les sérialise. Les deux vérifications passent avant que
-- l'une ou l'autre n'écrive, et la base termine avec deux engagements
-- impossibles à honorer. Aucun contrôle applicatif ne peut fermer ce trou :
-- c'est la base seule qui voit les deux transactions.
--
-- CE QUE FAIT LE DÉCLENCHEUR. Il verrouille la ligne de l'**intérimaire** avant
-- de chercher un conflit. Toutes les acceptations visant la même personne se
-- sérialisent donc, quelle que soit la mission et quelle que soit l'entreprise.
-- La seconde attend, voit l'engagement pris, et échoue.
--
-- ORDRE DES VERROUS. Le déclencheur de capacité (007) verrouille `missions`, et
-- son nom le fait s'exécuter avant celui-ci, qui verrouille `profiles`. Le
-- service prend lui aussi la mission avant l'intérimaire, et `create()` lit
-- `missions` puis `profiles`. Un seul ordre partout : mission, puis personne —
-- donc aucune inversion possible, donc aucun interblocage.
--
-- BORNES. Semi-ouvertes [début, fin), exactement comme `engagedElsewhere` dans
-- le service et `overlaps` dans le moteur de rapprochement : deux missions qui
-- se touchent bout à bout se cumulent. Un service du midi suivi d'un service du
-- soir est le quotidien du métier, pas un conflit.
--
-- Migration strictement additive : aucune colonne, aucune donnée, aucun statut
-- n'est modifié. Un double engagement déjà présent en base y reste — le corriger
-- est une décision métier, pas un effet de bord de migration.

CREATE FUNCTION applications_enforce_engagement() RETURNS trigger AS $$
DECLARE
 conflicting uuid;
BEGIN
 -- Seule l'entrée dans l'état « accepté » réserve un créneau. Un refus, une
 -- candidature en attente ou une acceptation déjà enregistrée ne réservent rien.
 IF NEW.status <> 'accepted' THEN
  RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN
  RETURN NEW;
 END IF;

 -- Le verrou qui sérialise. Il porte sur la personne, parce que c'est elle qui
 -- ne peut pas être à deux endroits : verrouiller la mission ne dirait rien de
 -- ce qui se décide au même moment sur une autre.
 PERFORM 1 FROM profiles WHERE id = NEW.worker_id FOR UPDATE;

 SELECT a2.id INTO conflicting
   FROM applications a2
   JOIN missions m2 ON m2.id = a2.mission_id
   JOIN missions target ON target.id = NEW.mission_id
  WHERE a2.worker_id = NEW.worker_id
    AND a2.status = 'accepted'
    AND a2.id <> NEW.id
    -- Une mission annulée ne réserve plus rien : l'entreprise a retiré son
    -- offre, l'intérimaire récupère son créneau.
    AND m2.status <> 'cancelled'
    AND m2.starts_at < target.ends_at
    AND target.starts_at < m2.ends_at
  LIMIT 1;

 IF conflicting IS NOT NULL THEN
  RAISE EXCEPTION
   'worker % is already engaged during mission % (conflicting application %)',
   NEW.worker_id, NEW.mission_id, conflicting
   USING ERRCODE = '23514';
 END IF;

 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER applications_engagement
 BEFORE INSERT OR UPDATE OF status ON applications
 FOR EACH ROW EXECUTE FUNCTION applications_enforce_engagement();

-- La recherche d'un conflit part des missions acceptées de la personne, puis
-- compare leurs bornes. L'index sur `worker_id` filtré par statut existe depuis
-- la 007 ; il manquait celui qui rend la comparaison de dates efficace.
CREATE INDEX missions_window_idx ON missions(starts_at, ends_at);
