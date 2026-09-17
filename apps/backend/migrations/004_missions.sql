-- SL1 du lot Matching : modèle des missions et de leurs compétences.
-- Migration strictement additive : aucune table existante n'est modifiée.

CREATE TABLE missions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- L'entreprise propriétaire. Le rôle 'company' est vérifié par le service :
 -- une contrainte SQL ne peut pas lire une autre table de façon fiable.
 company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
 -- Valeur du référentiel métiers, comme worker_profiles.main_job : c'est ce qui
 -- rend le rapprochement comparable des deux côtés.
 job text NOT NULL,
 -- Intervalle semi-ouvert [starts_at, ends_at), en UTC. Une mission passant
 -- minuit est donc gérée nativement.
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 address text NOT NULL DEFAULT '' CHECK (length(address) <= 250),
 city text NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 120),
 postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
 -- Coordonnées dérivées du géocodage serveur, jamais saisies par l'utilisateur.
 -- Nulles tant que le service n'a pas répondu : une panne ne bloque pas la saisie.
 latitude double precision CHECK (latitude BETWEEN -90 AND 90),
 longitude double precision CHECK (longitude BETWEEN -180 AND 180),
 geocoded_at timestamptz,
 pay_amount numeric(8, 2) CHECK (pay_amount IS NULL OR pay_amount >= 0),
 pay_unit text CHECK (pay_unit IS NULL OR pay_unit IN ('hour', 'day', 'mission')),
 headcount integer NOT NULL DEFAULT 1 CHECK (headcount BETWEEN 1 AND 50),
 min_years_experience numeric
  CHECK (min_years_experience IS NULL
      OR (min_years_experience >= 0 AND min_years_experience <= 60)),
 status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'open', 'filled', 'completed', 'cancelled')),
 published_at timestamptz,
 demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at > starts_at),
 -- Une mission publiée a forcément une date de publication.
 CHECK (status = 'draft' OR published_at IS NOT NULL)
);

CREATE INDEX missions_company_idx ON missions(company_id, starts_at DESC);
CREATE INDEX missions_status_idx ON missions(status, starts_at);

-- Compétences attendues. `required` distingue les compétences obligatoires,
-- qui pèsent 45 points au scoring, des compétences souhaitées, qui pèsent 10.
CREATE TABLE mission_skills (
 mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
 skill_id uuid NOT NULL REFERENCES skills(id),
 required boolean NOT NULL DEFAULT true,
 PRIMARY KEY (mission_id, skill_id)
);

CREATE INDEX mission_skills_mission_idx ON mission_skills(mission_id);

-- touch_updated_at() est créée par la migration 003.
CREATE TRIGGER missions_touch BEFORE UPDATE ON missions
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['missions','mission_skills'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
   END IF;
  END LOOP;
 END LOOP;
END $$;
