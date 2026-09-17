-- Lot 3 : profil intérimaire réellement exploitable, enregistrable section par section.
-- Migration strictement additive : aucune colonne supprimée, aucun renommage,
-- aucune donnée existante perdue. Les seules contraintes touchées sont élargies.

-- 1. Enregistrement partiel : un profil se construit en plusieurs fois, donc les
-- champs métier deviennent facultatifs au niveau SQL. L'obligation métier est
-- portée par completion.ts, qui décide de profiles.onboarding_completed.
ALTER TABLE worker_profiles ALTER COLUMN city DROP NOT NULL;
ALTER TABLE worker_profiles ALTER COLUMN postal_code DROP NOT NULL;
ALTER TABLE worker_profiles ALTER COLUMN mobility_radius_km DROP NOT NULL;
ALTER TABLE worker_profiles ALTER COLUMN main_job DROP NOT NULL;

-- 2. latitude/longitude sont des données techniques dérivées du géocodage, jamais
-- saisies par l'utilisateur : elles peuvent rester absentes si le service est
-- momentanément indisponible, sans bloquer l'enregistrement du profil.
ALTER TABLE worker_profiles ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE worker_profiles ALTER COLUMN longitude DROP NOT NULL;

-- 3. Champs métier du profil intérimaire.
ALTER TABLE worker_profiles
 ADD COLUMN phone text,
 ADD COLUMN secondary_jobs text[] NOT NULL DEFAULT '{}',
 ADD COLUMN years_experience numeric,
 ADD COLUMN has_driving_licence boolean NOT NULL DEFAULT false,
 ADD COLUMN has_vehicle boolean NOT NULL DEFAULT false,
 -- Recherche active de missions. Distinct de profiles.active, qui reste
 -- l'activation du COMPTE et sert à l'authentification.
 ADD COLUMN open_to_missions boolean NOT NULL DEFAULT true,
 -- Horodatage du dernier géocodage réussi ; NULL = coordonnées à recalculer.
 ADD COLUMN geocoded_at timestamptz,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE worker_profiles
 ADD CONSTRAINT worker_profiles_postal_code_format
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
 ADD CONSTRAINT worker_profiles_years_experience_range
  CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 60)),
 ADD CONSTRAINT worker_profiles_secondary_jobs_size
  CHECK (cardinality(secondary_jobs) <= 5),
 -- Un véhicule sans permis n'a pas de sens pour une mission.
 ADD CONSTRAINT worker_profiles_vehicle_requires_licence
  CHECK (has_vehicle = false OR has_driving_licence = true);

CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
 NEW.updated_at := now();
 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER worker_profiles_touch BEFORE UPDATE ON worker_profiles
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 4. Disponibilités : un créneau peut désormais marquer une indisponibilité.
-- Le modèle reste volontairement unique — un seul endroit décrit « quand » :
--   open_to_missions  = interrupteur général « je cherche des missions » ;
--   availabilities    = créneaux datés, disponibles ou non.
-- La « date de disponibilité » n'est PAS stockée : elle se déduit du premier
-- créneau disponible à venir, ce qui évite deux sources contradictoires.
ALTER TABLE availabilities
 ADD COLUMN status text NOT NULL DEFAULT 'available'
  CHECK (status IN ('available', 'unavailable')),
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

-- 5. Diplômes et certifications utiles (cahier des charges §7.2).
CREATE TABLE certifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES worker_profiles(profile_id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 issuer text NOT NULL DEFAULT '' CHECK (length(issuer) <= 120),
 obtained_on date,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX certifications_profile_idx ON certifications(profile_id);

ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE certifications FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON TABLE certifications FROM %I', r);
  END IF;
 END LOOP;
END $$;

-- 6. Recalcul de onboarding_completed avec les règles de completion.ts.
-- Aucun profil n'est passé à true arbitrairement : seuls ceux qui satisfont
-- réellement les six règles le deviennent, les autres repassent à false.
-- Les coordonnées ne comptent pas : ce sont des données dérivées.
UPDATE profiles p SET onboarding_completed = (
 p.role = 'worker'
 AND btrim(p.first_name) <> ''
 AND btrim(p.last_name) <> ''
 AND EXISTS (
  SELECT 1 FROM worker_profiles w
  WHERE w.profile_id = p.id
    AND btrim(coalesce(w.city, '')) <> ''
    AND w.postal_code ~ '^[0-9]{5}$'
    AND w.mobility_radius_km IS NOT NULL
    AND btrim(coalesce(w.main_job, '')) <> ''
 )
 AND EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.profile_id = p.id)
 AND EXISTS (
  SELECT 1 FROM availabilities a
  WHERE a.profile_id = p.id AND a.status = 'available' AND a.ends_at > now()
 )
), updated_at = now()
WHERE p.role = 'worker';
