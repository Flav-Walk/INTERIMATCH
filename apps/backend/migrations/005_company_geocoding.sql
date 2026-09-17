-- Aligne l'établissement sur le modèle déjà retenu pour l'intérimaire (003) et
-- pour la mission (004) : la localisation est décrite par une adresse, et les
-- coordonnées en sont dérivées par le serveur.
--
-- 1. latitude/longitude étaient NOT NULL parce que le formulaire les demandait à
--    l'utilisateur. Elles deviennent des données techniques : nulles tant que le
--    géocodeur n'a pas répondu, pour qu'une panne du service d'adresses
--    n'empêche jamais une entreprise d'enregistrer son établissement.
-- 2. geocoded_at distingue « pas encore situé » de « situé à cet instant », ce
--    qui permet de reprendre plus tard les adresses restées sans coordonnées.
--
-- Migration strictement additive : aucune donnée existante n'est modifiée, et
-- les établissements déjà géocodés conservent leurs coordonnées.

ALTER TABLE company_profiles ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE company_profiles ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- Les établissements enregistrés avant cette migration ont forcément des
-- coordonnées, puisque la colonne les exigeait : on date leur géocodage pour
-- qu'ils ne soient pas confondus avec des adresses jamais situées.
UPDATE company_profiles
   SET geocoded_at = now()
 WHERE geocoded_at IS NULL
   AND latitude IS NOT NULL
   AND longitude IS NOT NULL;
