import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api, errorMessage, type Skill } from "../services/session";
function Field({
  label,
  name,
  type = "text",
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} {...rest} />
    </label>
  );
}
export function Onboarding({ role }: { role: "worker" | "company" }) {
  const worker = role === "worker",
    auth = useAuth(),
    navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (worker)
      void api<Skill[]>("/skills")
        .then(setSkills)
        .catch((e) => setError(errorMessage(e)));
  }, [worker]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const str = (n: string) => String(f.get(n) ?? "");
    const num = (n: string) => Number(f.get(n));
    try {
      const common = {
        first_name: str("first_name"),
        last_name: str("last_name"),
        city: str("city"),
        postal_code: str("postal_code"),
        latitude: num("latitude"),
        longitude: num("longitude"),
      };
      const body = worker
        ? {
            ...common,
            main_job: str("main_job"),
            mobility_radius_km: num("mobility_radius_km"),
            skill_ids: f.getAll("skill_ids"),
            experiences: str("employer")
              ? [
                  {
                    job_title: str("main_job"),
                    employer: str("employer"),
                    years: num("years"),
                  },
                ]
              : [],
            availabilities: [
              {
                starts_at: new Date(str("starts_at")).toISOString(),
                ends_at: new Date(str("ends_at")).toISOString(),
              },
            ],
          }
        : {
            ...common,
            legal_name: str("legal_name"),
            establishment_name: str("establishment_name"),
            sector: str("sector"),
            address: str("address"),
            phone: str("phone"),
            description: str("description"),
          };
      await api("/onboarding/" + role, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await auth.reload();
      navigate("/" + role, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="onboarding">
      <span className="eyeline">
        Votre espace {worker ? "Intérimaire" : "Entreprise"}
      </span>
      <h1>
        {worker
          ? "Votre talent, en quelques mots."
          : "Présentons votre établissement."}
      </h1>
      <p>
        {worker
          ? "Ces informations permettront de vous proposer des missions pertinentes."
          : "Ces informations aideront les intérimaires à connaître votre établissement."}
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <fieldset>
          <legend>
            {worker ? "Votre identité" : "Le contact de votre établissement"}
          </legend>
          <div className="form-grid">
            <Field label="Prénom" name="first_name" maxLength={120} />
            <Field label="Nom" name="last_name" maxLength={120} />
          </div>
          <p className="quiet">Email du compte : {auth.user?.email}</p>
        </fieldset>
        {worker ? (
          <fieldset>
            <legend>Votre métier</legend>
            <Field label="Métier principal" name="main_job" maxLength={120} />
            <span id="skills-label">Compétences (au moins une)</span>
            <div
              className="skill-options"
              role="group"
              aria-labelledby="skills-label"
            >
              {skills.map((s) => (
                <label key={s.id}>
                  <input type="checkbox" name="skill_ids" value={s.id} />
                  {s.name}
                </label>
              ))}
            </div>
            <div className="form-grid">
              <Field
                label="Dernier établissement (facultatif)"
                name="employer"
                required={false}
              />
              <Field
                label="Années d’expérience dans cet établissement"
                name="years"
                type="number"
                min={0}
                max={60}
                step="0.5"
                required={false}
              />
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend>Votre établissement</legend>
            <div className="form-grid">
              <Field label="Raison sociale" name="legal_name" />
              <Field label="Nom de l’établissement" name="establishment_name" />
            </div>
            <label>
              Secteur
              <select name="sector" required>
                <option value="restaurant">Restaurant</option>
                <option value="brasserie">Brasserie</option>
                <option value="hotel">Hôtel</option>
                <option value="traiteur">Traiteur</option>
              </select>
            </label>
            <Field label="Adresse" name="address" />
            <Field label="Téléphone" name="phone" type="tel" />
            <label>
              Description (facultative)
              <textarea name="description" maxLength={1500} />
            </label>
          </fieldset>
        )}
        <fieldset>
          <legend>
            {worker
              ? "Votre localisation et votre mobilité"
              : "Localisation de l’établissement"}
          </legend>
          <div className="form-grid">
            <Field label="Ville" name="city" />
            <Field label="Code postal" name="postal_code" maxLength={5} />
            <Field
              label="Latitude"
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
            />
            <Field
              label="Longitude"
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
            />
          </div>
          <p className="quiet">
            Indiquez les coordonnées du centre de votre ville ou de votre
            établissement. Exemple Lyon : latitude 45.75, longitude 4.85.
          </p>
          {worker && (
            <Field
              label="Rayon de mobilité (km)"
              name="mobility_radius_km"
              type="number"
              min={0}
              max={250}
            />
          )}
        </fieldset>
        {worker && (
          <fieldset>
            <legend>Une première disponibilité</legend>
            <p className="quiet">
              Les heures sont celles de votre navigateur. Vous pourrez compléter
              votre planning dans une prochaine version.
            </p>
            <div className="form-grid">
              <Field
                label="Début de disponibilité"
                name="starts_at"
                type="datetime-local"
              />
              <Field
                label="Fin de disponibilité"
                name="ends_at"
                type="datetime-local"
              />
            </div>
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer et découvrir mon espace"}
        </button>
      </form>
    </section>
  );
}
