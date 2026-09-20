-- Photo d'une mission InteriMatch. Migration strictement additive.
--
-- POURQUOI UNE COLONNE JSONB PLUTÔT QUE NEUF COLONNES.
-- Le média a deux formes, et elles n'ont presque aucun champ en commun : une
-- photo importée porte un chemin de stockage, une photo Unsplash porte un
-- identifiant externe et l'attribution due au photographe. Neuf colonnes
-- laisseraient chaque ligne avec la moitié d'entre elles nulles, sans qu'aucune
-- contrainte ne puisse dire laquelle doit l'être. Le document, lui, se décrit
-- entièrement d'un seul CHECK — et rien n'interroge jamais ce contenu, qui
-- n'est lu que pour être affiché.
ALTER TABLE missions ADD COLUMN media jsonb;

-- Forme exacte du document, par fournisseur.
--
-- `download_location` est explicitement interdit : Unsplash le décrit comme un
-- point de comptage à appeler au moment où la photo est retenue, pas comme une
-- donnée à conserver. Le serveur le déclenche à l'enregistrement puis l'oublie ;
-- l'interdire ici garantit qu'aucun chemin ne le persistera par mégarde.
ALTER TABLE missions ADD CONSTRAINT missions_media_shape CHECK (
  media IS NULL
  OR (
    jsonb_typeof(media) = 'object'
    AND media ->> 'provider' IN ('upload', 'unsplash')
    -- `https://` pour une ressource distante, ou un chemin ABSOLU de même
    -- origine pour les jeux de recette locaux, qui écrivent ici directement.
    -- `^/[^/]` et non `^/` : `//ailleurs.example` est une URL protocole-relative,
    -- donc distante, et se glisserait sous une règle plus permissive.
    AND media ->> 'url' ~ '^(https://|/[^/])'
    AND length(media ->> 'url') <= 1000
    AND (media ->> 'alt' IS NULL OR length(media ->> 'alt') <= 300)
    AND NOT media ? 'download_location'
    AND (
      (
        media ->> 'provider' = 'upload'
        AND length(media ->> 'storage_path') BETWEEN 1 AND 300
        AND NOT media ? 'author_name'
      )
      OR (
        media ->> 'provider' = 'unsplash'
        AND length(media ->> 'external_id') BETWEEN 1 AND 100
        AND length(media ->> 'author_name') BETWEEN 1 AND 200
        AND media ->> 'author_url' ~ '^https://unsplash\.com/'
        AND media ->> 'thumb_url' ~ '^https://'
      )
    )
  )
);

/*
 * Une mission ne peut être publiée sans photo.
 *
 * COMPATIBILITÉ AVEC L'EXISTANT — c'est tout l'objet de ce déclencheur.
 * Des missions sont déjà publiées et n'ont évidemment pas de média. Un CHECK,
 * même `NOT VALID`, serait réévalué à la première écriture sur ces lignes :
 * annuler une mission publiée avant cette migration échouerait. Une contrainte
 * de table juge un état ; or la règle porte sur une TRANSITION.
 *
 * Le déclencheur ne se réveille donc qu'au passage vers « publiée » — à
 * l'insertion directe d'une ligne déjà `open`, ou à la bascule d'un brouillon.
 * Une mission publiée avant cette migration reste modifiable, annulable et
 * lisible telle quelle ; seule une NOUVELLE publication exige la photo.
 */
CREATE FUNCTION missions_require_media_on_publish() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'open'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'open')
     AND NEW.media IS NULL THEN
    RAISE EXCEPTION 'MISSION_MEDIA_REQUIRED'
      USING HINT = 'Ajoutez une photo pour publier cette mission.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER missions_media_required
 BEFORE INSERT OR UPDATE OF status, media ON missions
 FOR EACH ROW EXECUTE FUNCTION missions_require_media_on_publish();
