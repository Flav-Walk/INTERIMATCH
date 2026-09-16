-- Lot 2 : le rôle n'est plus choisi par l'utilisateur, et la visite guidée est versionnée.

-- Comptes autorisés à l'espace Entreprise. Table de données : ajouter une entreprise
-- consiste à insérer une ligne, sans modifier ni redéployer le code.
CREATE TABLE company_accounts (
 email text PRIMARY KEY CHECK (email = lower(email)),
 label text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO company_accounts(email, label)
VALUES ('neotravel257@gmail.com', 'Compte entreprise de référence InteriMatch');

-- Le rôle est attribué par le serveur à la création du compte : intérimaire par défaut,
-- entreprise si l'email figure dans company_accounts. Aucune entrée utilisateur.
CREATE FUNCTION assign_default_role() RETURNS trigger AS $$
BEGIN
 IF NEW.role IS NULL THEN
  NEW.role := CASE
   WHEN EXISTS (SELECT 1 FROM company_accounts WHERE email = NEW.email) THEN 'company'
   ELSE 'worker'
  END;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_default_role BEFORE INSERT ON profiles
 FOR EACH ROW EXECUTE FUNCTION assign_default_role();

-- Comptes existants : aligner sur la même règle avant de rendre la colonne obligatoire.
UPDATE profiles p SET role = 'company'
 WHERE p.role IS DISTINCT FROM 'admin'
   AND EXISTS (SELECT 1 FROM company_accounts c WHERE c.email = p.email);
UPDATE profiles SET role = 'worker' WHERE role IS NULL;
ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;

-- Visite guidée : version la plus haute réellement terminée par le compte.
-- 0 = jamais terminée. Remettre à 0 relance la visite (« Revoir la visite guidée »).
ALTER TABLE profiles ADD COLUMN tour_version integer NOT NULL DEFAULT 0
 CHECK (tour_version >= 0 AND tour_version <= 1000);

ALTER TABLE company_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE company_accounts FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON TABLE company_accounts FROM %I', r);
  END IF;
 END LOOP;
END $$;
