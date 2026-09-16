CREATE TABLE profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id uuid UNIQUE,
 role text CHECK (role IN ('worker','company','admin')), first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '',
 email text NOT NULL UNIQUE CHECK (email = lower(email)), avatar_url text,
 onboarding_completed boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credentials (profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, password_hash text NOT NULL);
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 access_hash text NOT NULL UNIQUE, refresh_hash text NOT NULL UNIQUE, access_expires_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_profile_idx ON sessions(profile_id);
CREATE TABLE worker_profiles (
 profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, city text NOT NULL, postal_code text NOT NULL,
 latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 mobility_radius_km integer NOT NULL CHECK (mobility_radius_km BETWEEN 0 AND 250), main_job text NOT NULL
);
CREATE TABLE company_profiles (
 profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, legal_name text NOT NULL, establishment_name text NOT NULL,
 sector text NOT NULL, address text NOT NULL, city text NOT NULL, postal_code text NOT NULL,
 latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 phone text NOT NULL, description text NOT NULL DEFAULT ''
);
CREATE TABLE skills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE);
CREATE TABLE worker_skills (profile_id uuid NOT NULL REFERENCES worker_profiles(profile_id) ON DELETE CASCADE, skill_id uuid NOT NULL REFERENCES skills(id), PRIMARY KEY(profile_id,skill_id));
CREATE TABLE experiences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES worker_profiles(profile_id) ON DELETE CASCADE, job_title text NOT NULL, employer text NOT NULL, years numeric NOT NULL CHECK(years BETWEEN 0 AND 60));
CREATE TABLE availabilities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES worker_profiles(profile_id) ON DELETE CASCADE, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at > starts_at));
CREATE INDEX availabilities_profile_idx ON availabilities(profile_id);
DO $$ BEGIN
 IF to_regclass('auth.users') IS NOT NULL THEN ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL; END IF;
END $$;
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','credentials','sessions','worker_profiles','company_profiles','skills','worker_skills','experiences','availabilities'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM %I',t,r); END IF;
  END LOOP;
 END LOOP;
END $$;
INSERT INTO skills(name) VALUES ('Service en salle'),('Prise de commande'),('Mise en place'),('Encaissement'),('Relation client'),('Hygiène alimentaire'),('Cuisine'),('Accueil');
