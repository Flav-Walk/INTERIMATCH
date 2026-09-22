-- Documents contractuels de démonstration liés à une attribution réelle.
-- Migration additive : aucune table ni donnée existante n'est modifiée.

CREATE TABLE contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL UNIQUE REFERENCES applications(id) ON DELETE RESTRICT,
 mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE RESTRICT,
 worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 type text NOT NULL DEFAULT 'mission_agreement'
  CHECK (type = 'mission_agreement'),
 status text NOT NULL DEFAULT 'draft'
  CHECK (status IN (
   'draft',
   'awaiting_worker_signature',
   'awaiting_company_signature',
   'awaiting_finalization',
   'completed',
   'cancelled'
  )),
 document_version integer NOT NULL DEFAULT 1 CHECK (document_version > 0),
 -- Source immuable du PDF. Une modification ultérieure de mission ne doit
 -- jamais réécrire ce qui a été présenté aux signataires.
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
 original_file_path text,
 final_file_path text,
 original_sha256 text CHECK (original_sha256 IS NULL OR original_sha256 ~ '^[a-f0-9]{64}$'),
 final_sha256 text CHECK (final_sha256 IS NULL OR final_sha256 ~ '^[a-f0-9]{64}$'),
 worker_signed_at timestamptz,
 company_signed_at timestamptz,
 completed_at timestamptz,
 last_error_code text CHECK (
  last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
 ),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((original_file_path IS NULL) = (original_sha256 IS NULL)),
 CHECK ((final_file_path IS NULL) = (final_sha256 IS NULL)),
 CHECK (worker_signed_at IS NULL OR status IN (
  'awaiting_company_signature','awaiting_finalization','completed','cancelled'
 )),
 CHECK (status NOT IN ('awaiting_company_signature','awaiting_finalization','completed')
        OR worker_signed_at IS NOT NULL),
 CHECK (company_signed_at IS NULL OR status IN (
  'awaiting_finalization','completed','cancelled'
 )),
 CHECK (status NOT IN ('awaiting_finalization','completed')
        OR company_signed_at IS NOT NULL),
 CHECK (completed_at IS NULL OR status = 'completed'),
 CHECK (status <> 'completed' OR (
  worker_signed_at IS NOT NULL
  AND company_signed_at IS NOT NULL
  AND completed_at IS NOT NULL
  AND final_file_path IS NOT NULL
 ))
);

CREATE INDEX contracts_worker_idx ON contracts(worker_id, created_at DESC);
CREATE INDEX contracts_company_idx ON contracts(company_id, created_at DESC);
CREATE INDEX contracts_status_idx ON contracts(status, updated_at);

CREATE TABLE contract_signature_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 actor_role text NOT NULL CHECK (actor_role IN ('worker','company')),
 action text NOT NULL CHECK (action IN ('worker_signed','company_signed')),
 from_status text NOT NULL,
 to_status text NOT NULL,
 document_version integer NOT NULL CHECK (document_version > 0),
 declaration_version text NOT NULL DEFAULT 'internal-demo-v1',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (contract_id, actor_role)
);

CREATE INDEX contract_signature_events_contract_idx
 ON contract_signature_events(contract_id, created_at);

-- Outbox minimale et idempotente. La transaction métier crée une intention
-- unique ; sa livraison au webhook n8n se fait après commit et peut être reprise.
CREATE TABLE contract_email_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN (
  'contract_available',
  'worker_signed',
  'contract_completed_worker',
  'contract_completed_company'
 )),
 recipient_email text NOT NULL,
 status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 last_error_code text CHECK (
  last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
 ),
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (contract_id, kind)
);

CREATE INDEX contract_email_pending_idx
 ON contract_email_deliveries(status, created_at)
 WHERE status IN ('pending','failed');

-- Une candidature acceptée est l'unique autorité sur le lien
-- mission/worker/company. Les quatre UUID du contrat ne peuvent donc jamais
-- être assemblés librement par l'application.
CREATE FUNCTION contracts_validate_source() RETURNS trigger AS $$
DECLARE
 source_worker uuid;
 source_mission uuid;
 source_company uuid;
 source_status text;
 source_mission_status text;
BEGIN
 SELECT a.worker_id,a.mission_id,m.company_id,a.status,m.status
   INTO source_worker,source_mission,source_company,source_status,source_mission_status
   FROM applications a
   JOIN missions m ON m.id=a.mission_id
  WHERE a.id=NEW.application_id;

 IF NOT FOUND OR source_status <> 'accepted' THEN
  RAISE EXCEPTION 'CONTRACT_REQUIRES_ACCEPTED_APPLICATION'
   USING ERRCODE = '23514';
 END IF;
 IF source_mission_status = 'cancelled' THEN
  RAISE EXCEPTION 'CONTRACT_MISSION_CANCELLED' USING ERRCODE = '23514';
 END IF;
 IF NEW.worker_id <> source_worker
    OR NEW.mission_id <> source_mission
    OR NEW.company_id <> source_company THEN
  RAISE EXCEPTION 'CONTRACT_SOURCE_MISMATCH'
   USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_source
 BEFORE INSERT OR UPDATE OF application_id,mission_id,worker_id,company_id
 ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_validate_source();

-- Le snapshot et sa version sont figés dès la création. Les chemins et états
-- de traitement peuvent évoluer, jamais les données contractuelles.
CREATE FUNCTION contracts_protect_snapshot() RETURNS trigger AS $$
BEGIN
 IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.document_version IS DISTINCT FROM OLD.document_version
    OR NEW.application_id IS DISTINCT FROM OLD.application_id
    OR NEW.mission_id IS DISTINCT FROM OLD.mission_id
    OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
  RAISE EXCEPTION 'CONTRACT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_snapshot_immutable
 BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_protect_snapshot();

CREATE FUNCTION contracts_validate_transition() RETURNS trigger AS $$
BEGIN
 IF NEW.status = OLD.status THEN RETURN NEW; END IF;
 IF NOT (
  (OLD.status = 'draft' AND NEW.status IN ('awaiting_worker_signature','cancelled'))
  OR (OLD.status = 'awaiting_worker_signature' AND NEW.status IN ('awaiting_company_signature','cancelled'))
  OR (OLD.status = 'awaiting_company_signature' AND NEW.status IN ('awaiting_finalization','cancelled'))
  OR (OLD.status = 'awaiting_finalization' AND NEW.status IN ('completed','cancelled'))
 ) THEN
  RAISE EXCEPTION 'CONTRACT_INVALID_TRANSITION' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_transition
 BEFORE UPDATE OF status ON contracts FOR EACH ROW
 EXECUTE FUNCTION contracts_validate_transition();

CREATE TRIGGER contracts_touch BEFORE UPDATE ON contracts
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER contract_email_deliveries_touch BEFORE UPDATE ON contract_email_deliveries
 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY[
  'contracts','contract_signature_events','contract_email_deliveries'
 ] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
   END IF;
  END LOOP;
 END LOOP;
END $$;
