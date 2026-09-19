-- SL2e : Modèle dédié aux offres publiques externes France Travail.
-- Séparation stricte avec les missions InteriMatch : aucune table existante n'est altérée.

CREATE TABLE public_job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'france_travail' CHECK (source = 'france_travail'),
  external_id text NOT NULL CHECK (length(btrim(external_id)) BETWEEN 1 AND 200),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  rome_code text NOT NULL,
  rome_label text NOT NULL,
  company_name text,
  contract_type text NOT NULL,
  contract_label text NOT NULL,
  experience_label text,
  postal_code text,
  city text NOT NULL,
  latitude double precision CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude double precision CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  salary_label text,
  working_time text,
  positions integer NOT NULL DEFAULT 1 CHECK (positions >= 1),
  skills jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(skills) = 'array'),
  professional_qualities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(professional_qualities) = 'array'),
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https?://'),
  created_at_source timestamptz,
  updated_at_source timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  raw_checksum text NOT NULL CHECK (raw_checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_job_offers_source_external_id_key UNIQUE (source, external_id)
);

-- La contrainte UNIQUE crée déjà l'index btree (source, external_id).
CREATE INDEX public_job_offers_rome_code_idx ON public_job_offers(rome_code);
CREATE INDEX public_job_offers_postal_code_idx ON public_job_offers(postal_code);
CREATE INDEX public_job_offers_city_idx ON public_job_offers(city);
CREATE INDEX public_job_offers_imported_at_idx ON public_job_offers(imported_at DESC);

DO $$ DECLARE t text; r text; BEGIN
  FOREACH t IN ARRAY ARRAY['public_job_offers'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
      END IF;
    END LOOP;
  END LOOP;
END $$;
