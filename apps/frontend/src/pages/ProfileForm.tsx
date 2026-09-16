import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  api,
  errorMessage,
  destination,
  type Skill,
  type ReferenceValue,
} from "../services/session";

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
  defaultValue?: string | number;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} {...rest} />
    </label>
  );
}

/** Format attendu par un input datetime-local, à partir d'une date ISO UTC. */
function localInput(iso: string | undefined) {
  if (!iso) return undefined;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProfileForm({ role }: { role: "worker" | "company" }) {
  const worker = role === "worker",
    auth = useAuth(),
    navigate = useNavigate();
  const p = auth.user?.profile ?? {};
  const [skills, setSkills] = useState<Skill[]>([]),
    [sectors, setSectors] = useState<ReferenceValue[]>([]),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const chosen = new Set((p.skills ?? []).map((s) => s.id));
  const experience = p.experiences?.[0];
  const slot = p.availabilities?.[0];

  useEffect(() => {
    if (worker)
      void api<Skill[]>("/skills")
        .then(setSkills)
        .catch((e) => setError(errorMessage(e)));
    else
      void api<{ sectors: ReferenceValue[] }>("/reference")
        .then((r) => setSectors(r.sectors))
        .catch((e) => setError(errorMessage(e)));
  }, [worker]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
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
      if (auth.user && !auth.user.onboarding_completed)
        navigate(destination(auth.user), { replace: true });
      else setSaved(true);
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
            <Field
              label="Prénom"
              name="first_name"
              maxLength={120}
              defaultValue={auth.user?.first_name}
            />
            <Field
              label="Nom"
              name="last_name"
              maxLength={120}
              defaultValue={auth.user?.last_name}
            />
          </div>
          <p className="quiet">Email du compte : {auth.user?.email}</p>
        </fieldset>
        {worker ? (
          <fieldset>
            <legend>Votre métier</legend>
            <Field
              label="Métier principal"
              name="main_job"
              maxLength={120}
              defaultValue={p.main_job}
            />
            <span id="skills-label">Compétences (au moins une)</span>
            <div
              className="skill-options"
              role="group"
              aria-labelledby="skills-label"
            >
              {skills.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    name="skill_ids"
                    value={s.id}
                    defaultChecked={chosen.has(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <div className="form-grid">
              <Field
                label="Dernier établissement (facultatif)"
                name="employer"
                required={false}
                defaultValue={experience?.employer}
              />
              <Field
                label="Années d’expérience dans cet établissement"
                name="years"
                type="number"
                min={0}
                max={60}
                step="0.5"
                required={false}
                defaultValue={experience?.years}
              />
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend>Votre établissement</legend>
            <div className="form-grid">
              <Field
                label="Raison sociale"
                name="legal_name"
                defaultValue={p.legal_name}
              />
              <Field
                label="Nom de l’établissement"
                name="establishment_name"
                defaultValue={p.establishment_name}
              />
            </div>
            <label>
              Secteur
              <select name="sector" required defaultValue={p.sector}>
                {sectors.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Adresse" name="address" defaultValue={p.address} />
            <Field
              label="Téléphone"
              name="phone"
              type="tel"
              defaultValue={p.phone}
            />
            <label>
              Description (facultative)
              <textarea
                name="description"
                maxLength={1500}
                defaultValue={p.description}
              />
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
            <Field label="Ville" name="city" defaultValue={p.city} />
            <Field
              label="Code postal"
              name="postal_code"
              maxLength={5}
              defaultValue={p.postal_code}
            />
            <Field
              label="Latitude"
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              defaultValue={p.latitude}
            />
            <Field
              label="Longitude"
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              defaultValue={p.longitude}
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
              defaultValue={p.mobility_radius_km}
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
                defaultValue={localInput(slot?.starts_at)}
              />
              <Field
                label="Fin de disponibilité"
                name="ends_at"
                type="datetime-local"
                defaultValue={localInput(slot?.ends_at)}
              />
            </div>
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="form-success" role="status">
            Vos informations ont été enregistrées.
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
