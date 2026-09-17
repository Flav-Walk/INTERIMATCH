-- SL3B : candidature volontaire d'un intérimaire à une mission.
-- Le matching reste un domaine distinct : aucune note ni proposition automatique
-- n'est stockée ici.

CREATE TABLE applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
 worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (mission_id, worker_id)
);

CREATE INDEX applications_worker_idx
 ON applications(worker_id, created_at DESC);
CREATE INDEX applications_mission_idx
 ON applications(mission_id, created_at DESC);

CREATE TRIGGER applications_touch BEFORE UPDATE ON applications
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE applications FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON TABLE applications FROM %I', r);
  END IF;
 END LOOP;
END $$;
