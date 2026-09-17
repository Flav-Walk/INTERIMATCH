import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  api,
  errorMessage,
  type ReferenceValue,
  type Skill,
  type User,
} from "../services/session";
import {
  addAvailability,
  formatSlot,
  patchWorker,
  putCertifications,
  putExperiences,
  putSkills,
  removeAvailability,
  requirementLabels,
  upcomingAvailabilities,
} from "../services/profile";

/**
 * Chaque section s'enregistre seule : l'utilisateur peut remplir une partie,
 * quitter, revenir et retrouver ses données. `onboarding_completed` reste faux
 * tant que le serveur n'a pas constaté que tout le nécessaire est présent.
 */
function Section({
  title,
  hint,
  onSave,
  children,
}: {
  title: string;
  hint?: string;
  onSave: (form: FormData) => Promise<User | void>;
  children: ReactNode;
}) {
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const updated = await onSave(new FormData(event.currentTarget));
      if (updated) setUser(updated);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <fieldset>
        <legend>{title}</legend>
        {hint && <p className="quiet">{hint}</p>}
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="form-success" role="status">
            Enregistré.
          </p>
        )}
        <div className="section-actions">
          <button className="button" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const str = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const optionalNumber = (f: FormData, n: string) => {
  const raw = str(f, n);
  return raw === "" ? null : Number(raw);
};

export function WorkerProfile() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]),
    [jobs, setJobs] = useState<ReferenceValue[]>([]),
    [loadError, setLoadError] = useState("");
  const p = user?.profile ?? {};
  const [experiences, setExperiences] = useState(
    () => p.experiences ?? [{ job_title: "", employer: "", years: 0 }],
  );
  const [certifications, setCertifications] = useState(
    () => p.certifications ?? [],
  );

  useEffect(() => {
    void Promise.all([
      api<Skill[]>("/skills"),
      api<{ jobs: ReferenceValue[] }>("/reference"),
    ])
      .then(([s, r]) => {
        setSkills(s);
        setJobs(r.jobs);
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  if (!user) return null;
  const chosen = new Set((p.skills ?? []).map((s) => s.id));
  const missing = user.missing_requirements ?? [];
  const slots = p.availabilities ?? [];

  return (
    <section className="onboarding">
      <span className="eyeline">Votre espace intérimaire</span>
      <h1>Votre profil professionnel</h1>
      <p>
        Ces informations décident des missions qui vous seront proposées. Chaque
        bloc s’enregistre séparément : vous pouvez revenir le compléter plus
        tard.
      </p>

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {missing.length > 0 ? (
        <section className="side-panel pale" role="status">
          <h2>Il reste à renseigner</h2>
          <ul className="steps-list">
            {missing.map((rule) => (
              <li key={rule}>{requirementLabels[rule]}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="form-success" role="status">
          <Check size={16} aria-hidden="true" /> Votre profil est complet.
        </p>
      )}

      <Section
        title="Votre identité"
        onSave={(f) =>
          patchWorker({
            first_name: str(f, "first_name"),
            last_name: str(f, "last_name"),
            phone: str(f, "phone") || null,
          })
        }
      >
        <div className="form-grid">
          <label>
            Prénom
            <input
              name="first_name"
              required
              maxLength={120}
              defaultValue={user.first_name}
            />
          </label>
          <label>
            Nom
            <input
              name="last_name"
              required
              maxLength={120}
              defaultValue={user.last_name}
            />
          </label>
        </div>
        <label>
          Téléphone (facultatif)
          <input name="phone" type="tel" defaultValue={p.phone ?? ""} />
        </label>
        <p className="quiet">Email du compte : {user.email}</p>
      </Section>

      <Section
        title="Votre métier"
        hint="Le métier principal sert au rapprochement avec les missions."
        onSave={(f) =>
          patchWorker({
            main_job: str(f, "main_job"),
            secondary_jobs: f.getAll("secondary_jobs").map(String),
            years_experience: optionalNumber(f, "years_experience"),
          })
        }
      >
        <label>
          Métier principal
          <select name="main_job" required defaultValue={p.main_job ?? ""}>
            <option value="" disabled>
              Choisissez un métier
            </option>
            {jobs.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <span id="secondary-label">Autres métiers exercés (facultatif)</span>
        <div
          className="skill-options"
          role="group"
          aria-labelledby="secondary-label"
        >
          {jobs.map((j) => (
            <label key={j.value}>
              <input
                type="checkbox"
                name="secondary_jobs"
                value={j.value}
                defaultChecked={(p.secondary_jobs ?? []).includes(j.value)}
              />
              {j.label}
            </label>
          ))}
        </div>
        <label>
          Années d’expérience du métier (facultatif)
          <input
            name="years_experience"
            type="number"
            min={0}
            max={60}
            step="0.5"
            defaultValue={p.years_experience ?? ""}
          />
        </label>
      </Section>

      <Section
        title="Vos compétences"
        hint="Au moins une compétence est nécessaire : c’est le critère le plus important du rapprochement."
        onSave={(f) => putSkills(f.getAll("skill_ids").map(String))}
      >
        <div className="skill-options" role="group" aria-label="Compétences">
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
      </Section>

      <Section
        title="Vos expériences"
        hint="Facultatif, mais une expérience détaillée renforce votre profil."
        onSave={() =>
          putExperiences(
            experiences
              .filter((e) => e.job_title.trim() && e.employer.trim())
              .map((e) => ({
                job_title: e.job_title.trim(),
                employer: e.employer.trim(),
                years: Number(e.years) || 0,
              })),
          )
        }
      >
        {experiences.map((e, i) => (
          <div className="repeat-row" key={i}>
            <label>
              Poste
              <input
                value={e.job_title}
                maxLength={120}
                onChange={(ev) =>
                  setExperiences(
                    experiences.map((x, j) =>
                      j === i ? { ...x, job_title: ev.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Établissement
              <input
                value={e.employer}
                maxLength={120}
                onChange={(ev) =>
                  setExperiences(
                    experiences.map((x, j) =>
                      j === i ? { ...x, employer: ev.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Années
              <input
                type="number"
                min={0}
                max={60}
                step="0.5"
                value={e.years}
                onChange={(ev) =>
                  setExperiences(
                    experiences.map((x, j) =>
                      j === i ? { ...x, years: Number(ev.target.value) } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Retirer l’expérience ${i + 1}`}
              onClick={() =>
                setExperiences(experiences.filter((_, j) => j !== i))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            setExperiences([
              ...experiences,
              { job_title: "", employer: "", years: 0 },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" /> Ajouter une expérience
        </button>
      </Section>

      <Section
        title="Vos diplômes et certifications"
        hint="Facultatif. HACCP, permis d’exploitation, mention complémentaire…"
        onSave={() =>
          putCertifications(
            certifications
              .filter((c) => c.name.trim())
              .map((c) => ({
                name: c.name.trim(),
                issuer: (c.issuer ?? "").trim(),
                obtained_on: c.obtained_on || null,
              })),
          )
        }
      >
        {certifications.map((c, i) => (
          <div className="repeat-row" key={i}>
            <label>
              Intitulé
              <input
                value={c.name}
                maxLength={120}
                onChange={(ev) =>
                  setCertifications(
                    certifications.map((x, j) =>
                      j === i ? { ...x, name: ev.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Organisme
              <input
                value={c.issuer ?? ""}
                maxLength={120}
                onChange={(ev) =>
                  setCertifications(
                    certifications.map((x, j) =>
                      j === i ? { ...x, issuer: ev.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Obtenu le
              <input
                type="date"
                value={c.obtained_on ?? ""}
                onChange={(ev) =>
                  setCertifications(
                    certifications.map((x, j) =>
                      j === i ? { ...x, obtained_on: ev.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Retirer la certification ${i + 1}`}
              onClick={() =>
                setCertifications(certifications.filter((_, j) => j !== i))
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            setCertifications([
              ...certifications,
              { name: "", issuer: "", obtained_on: null },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" /> Ajouter une certification
        </button>
      </Section>

      <Section
        title="Votre mobilité"
        hint="Indiquez simplement votre ville : les coordonnées nécessaires au rapprochement sont retrouvées automatiquement."
        onSave={(f) =>
          patchWorker({
            city: str(f, "city"),
            postal_code: str(f, "postal_code"),
            mobility_radius_km: Number(str(f, "mobility_radius_km")),
            has_driving_licence: f.get("has_driving_licence") === "on",
            has_vehicle: f.get("has_vehicle") === "on",
          })
        }
      >
        <div className="form-grid">
          <label>
            Ville
            <input name="city" required defaultValue={p.city ?? ""} />
          </label>
          <label>
            Code postal
            <input
              name="postal_code"
              required
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              defaultValue={p.postal_code ?? ""}
            />
          </label>
        </div>
        <label>
          Rayon de mobilité (km)
          <input
            name="mobility_radius_km"
            type="number"
            min={0}
            max={250}
            required
            defaultValue={p.mobility_radius_km ?? ""}
          />
        </label>
        <div className="skill-options">
          <label>
            <input
              type="checkbox"
              name="has_driving_licence"
              defaultChecked={p.has_driving_licence ?? false}
            />
            J’ai le permis
          </label>
          <label>
            <input
              type="checkbox"
              name="has_vehicle"
              defaultChecked={p.has_vehicle ?? false}
            />
            J’ai un véhicule
          </label>
        </div>
      </Section>

      <AvailabilitySection slots={slots} />

      <Section
        title="Votre recherche"
        hint="Mettez votre recherche en pause sans perdre votre profil."
        onSave={(f) =>
          patchWorker({ open_to_missions: f.get("open_to_missions") === "on" })
        }
      >
        <div className="skill-options">
          <label>
            <input
              type="checkbox"
              name="open_to_missions"
              defaultChecked={p.open_to_missions ?? true}
            />
            Je recherche actuellement des missions
          </label>
        </div>
      </Section>
    </section>
  );
}

/** Les créneaux s'ajoutent et se suppriment un par un, sans bouton global. */
function AvailabilitySection({
  slots,
}: {
  slots: { id: string; starts_at: string; ends_at: string; status: string }[];
}) {
  const { setUser } = useAuth();
  const refresh = async () => setUser(await api<User>("/workers/me"));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const upcoming = upcomingAvailabilities(
    slots as Parameters<typeof upcomingAvailabilities>[0],
  );

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await addAvailability({
        starts_at: new Date(str(f, "starts_at")).toISOString(),
        ends_at: new Date(str(f, "ends_at")).toISOString(),
        status: "available",
      });
      await refresh();
      form.reset();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    setError("");
    try {
      await removeAvailability(id);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <form onSubmit={(e) => void add(e)}>
      <fieldset>
        <legend>Vos disponibilités</legend>
        <p className="quiet">
          Au moins un créneau à venir est nécessaire. Les heures sont celles de
          votre navigateur.
        </p>
        {upcoming.length > 0 ? (
          <ul className="slot-list">
            {upcoming.map((slot) => (
              <li key={slot.id}>
                <span>{formatSlot(slot)}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Retirer le créneau ${formatSlot(slot)}`}
                  onClick={() => void drop(slot.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet">Aucun créneau à venir pour le moment.</p>
        )}
        <div className="form-grid">
          <label>
            Début
            <input name="starts_at" type="datetime-local" required />
          </label>
          <label>
            Fin
            <input name="ends_at" type="datetime-local" required />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="section-actions">
          <button className="secondary-button" disabled={busy}>
            <Plus size={16} aria-hidden="true" />
            {busy ? "Ajout…" : "Ajouter ce créneau"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
