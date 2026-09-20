import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { Check, Plus, Trash2, Pencil } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  api,
  errorMessage,
  type Availability,
  type ReferenceValue,
  type Skill,
  type User,
} from "../services/session";
import {
  addAvailability,
  formatSlot,
  missingIn,
  patchWorker,
  putCertifications,
  putExperiences,
  putSkills,
  humaniseError,
  partial,
  removeAvailability,
  requirementLabels,
  updateAvailability,
  toLocalInput,
} from "../services/profile";
import { HeroBanner } from "../components/HeroBanner";
import { CircularGauge } from "../components/CircularGauge";
import { workerRequirementProgress } from "../services/completion";

/**
 * Chaque section s'enregistre seule : l'utilisateur peut remplir une partie,
 * quitter, revenir et retrouver ses données. `onboarding_completed` reste faux
 * tant que le serveur n'a pas constaté que tout le nécessaire est présent.
 */
function Section({
  id,
  title,
  hint,
  missing = [],
  onSave,
  children,
}: {
  /** Ancre, pour qu'un lien puisse mener droit à ce bloc. */
  id?: string;
  title: string;
  hint?: string;
  /** Exigences de complétion que ce bloc porte et qui ne sont pas remplies. */
  missing?: (keyof typeof requirementLabels)[];
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
      setError(humaniseError(errorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id={id}
      onSubmit={(e) => void submit(e)}
      onInput={() => saved && setSaved(false)}
    >
      <fieldset>
        <legend>
          {title}
          {/* Dire ici ce qui manque évite de renvoyer à la liste du haut, puis
              de laisser chercher le bloc concerné parmi six. */}
          {missing.length > 0 && (
            <span className="section-todo">À compléter</span>
          )}
        </legend>
        {missing.length > 0 && (
          <p className="quiet section-todo-detail">
            Il reste à renseigner :{" "}
            {missing
              .map((rule) =>
                requirementLabels[rule].replace(/^Votre |^Au /, ""),
              )
              .join(", ")}
            .
          </p>
        )}
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
          <button className="secondary-button" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

const str = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
/** Champ numérique effaçable : le serveur accepte null (expérience, téléphone). */
const optionalNumber = (f: FormData, n: string) => {
  const raw = str(f, n);
  return raw === "" ? null : Number(raw);
};

/**
 * Champ numérique non effaçable : le serveur n'accepte pas null pour le rayon
 * de mobilité. Laissé vide, il est simplement omis de la modification partielle
 * plutôt qu'envoyé comme une valeur invalide.
 */
const numberOrOmit = (f: FormData, n: string) => {
  const raw = str(f, n);
  return raw === "" ? undefined : Number(raw);
};

export function WorkerProfile() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const [skills, setSkills] = useState<Skill[]>([]),
    [jobs, setJobs] = useState<ReferenceValue[]>([]),
    [loadError, setLoadError] = useState("");
  const p = user?.profile ?? {};
  // Les options arrivent après le profil : defaultValue ne réappliquerait pas
  // le métier enregistré lors de leur chargement. Garder le select contrôlé.
  const [mainJob, setMainJob] = useState(p.main_job ?? "");
  const [experiences, setExperiences] = useState(
    () => p.experiences ?? [{ job_title: "", employer: "", years: 0 }],
  );
  const [certifications, setCertifications] = useState(
    () => p.certifications ?? [],
  );
  // Permis et véhicule sont liés par une règle métier : le véhicule suppose le
  // permis. Deux cases à cocher indépendantes laissaient exprimer l'inverse.
  const [licence, setLicence] = useState(p.has_driving_licence ?? false);
  const [vehicle, setVehicle] = useState(p.has_vehicle ?? false);

  /**
   * Un lien peut viser un bloc précis — « modifier mes disponibilités » depuis
   * un écran vide, par exemple. React Router ne suit pas les ancres de
   * lui-même : sans cela, on atterrirait en haut d'un long formulaire, à
   * charge de retrouver le bloc annoncé.
   */
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [hash]);

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
  const requirementProgress = workerRequirementProgress(
    user.missing_requirements,
  );
  const slots = p.availabilities ?? [];
  // Un profil ancien peut porter un métier absent du référentiel actuel. Sans
  // cette option, le sélecteur s'afficherait vide et la valeur semblerait perdue.
  const jobOptions =
    !mainJob || jobs.some((j) => j.value === mainJob)
      ? jobs
      : [...jobs, { value: mainJob, label: mainJob }];

  return (
    <section className="onboarding worker-profile">
      <HeroBanner
        compact
        eyeline="Votre espace intérimaire"
        title="Votre profil professionnel"
        subtitle="Enregistrez chaque rubrique à votre rythme. Les prérequis indiqués servent à déterminer votre accès aux propositions de mission."
        mascotPose="profile"
        gauge={
          requirementProgress !== null ? (
            <CircularGauge
              value={requirementProgress}
              label="Prérequis missions"
              subtitle={
                missing.length === 0
                  ? "Tous réunis"
                  : `${missing.length} à compléter`
              }
              variant="on-dark"
            />
          ) : undefined
        }
      />

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {/* Le bandeau dit déjà que chaque rubrique s'enregistre seule : ne
          reste ici que ce qu'il n'énonce pas, le sort des champs facultatifs. */}
      <p className="quiet form-legend">
        Les champs marqués « facultatif » peuvent rester vides.
      </p>

      {user.missing_requirements === undefined ? null : missing.length > 0 ? (
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
          <Check size={16} aria-hidden="true" /> Tous les prérequis pour
          recevoir des missions sont réunis. Vous pouvez continuer à enrichir
          les rubriques facultatives.
        </p>
      )}

      <Section
        title="Votre identité"
        missing={missingIn(user.missing_requirements, "Votre identité")}
        onSave={(f) =>
          patchWorker({
            ...partial({
              first_name: str(f, "first_name"),
              last_name: str(f, "last_name"),
            }),
            phone: str(f, "phone") || null,
          })
        }
      >
        <div className="form-grid">
          <label>
            Prénom
            <input
              name="first_name"
              maxLength={120}
              defaultValue={user.first_name}
            />
          </label>
          <label>
            Nom
            <input
              name="last_name"
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
        missing={missingIn(user.missing_requirements, "Votre métier")}
        hint="Le métier principal sert au rapprochement avec les missions."
        onSave={(f) =>
          patchWorker({
            // Le métier principal n'est envoyé que s'il est choisi : on peut
            // ainsi modifier les seuls métiers secondaires sans être bloqué,
            // et la valeur déjà enregistrée reste intacte.
            ...partial({ main_job: mainJob }),
            secondary_jobs: f.getAll("secondary_jobs").map(String),
            years_experience: optionalNumber(f, "years_experience"),
          })
        }
      >
        <label>
          Métier principal
          <select
            name="main_job"
            value={mainJob}
            onChange={(event) => setMainJob(event.target.value)}
          >
            <option value="">Choisissez un métier</option>
            {jobOptions.map((j) => (
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
        id="competences"
        title="Vos compétences"
        missing={missingIn(user.missing_requirements, "Vos compétences")}
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
        onSave={() => {
          if (
            experiences.some((e) => !e.job_title.trim() || !e.employer.trim())
          )
            throw new Error(
              "Renseignez le poste et l’établissement de chaque expérience, ou retirez la ligne.",
            );
          return putExperiences(
            experiences.map((e) => ({
              job_title: e.job_title.trim(),
              employer: e.employer.trim(),
              years: Number(e.years),
            })),
          );
        }}
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
        onSave={() => {
          if (certifications.some((c) => !c.name.trim()))
            throw new Error(
              "Renseignez l’intitulé de chaque certification, ou retirez la ligne.",
            );
          return putCertifications(
            certifications.map((c) => ({
              name: c.name.trim(),
              issuer: (c.issuer ?? "").trim(),
              obtained_on: c.obtained_on || null,
            })),
          );
        }}
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
        id="mobilite"
        title="Votre mobilité"
        missing={missingIn(user.missing_requirements, "Votre mobilité")}
        hint="Indiquez simplement votre ville : les coordonnées nécessaires au rapprochement sont retrouvées automatiquement."
        onSave={(f) =>
          patchWorker({
            ...partial({
              city: str(f, "city"),
              postal_code: str(f, "postal_code"),
              mobility_radius_km: numberOrOmit(f, "mobility_radius_km"),
            }),
            has_driving_licence: licence,
            has_vehicle: licence && vehicle,
          })
        }
      >
        <div className="form-grid">
          <label>
            Ville
            <input name="city" defaultValue={p.city ?? ""} />
          </label>
          <label>
            Code postal
            <input
              name="postal_code"
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
            defaultValue={p.mobility_radius_km ?? ""}
          />
        </label>

        <div
          className="choice-group"
          role="radiogroup"
          aria-labelledby="licence-label"
        >
          <span id="licence-label" className="choice-label">
            Permis de conduire
          </span>
          <label>
            <input
              type="radio"
              name="licence"
              checked={licence}
              onChange={() => setLicence(true)}
            />
            J’ai le permis
          </label>
          <label>
            <input
              type="radio"
              name="licence"
              checked={!licence}
              onChange={() => {
                // Le véhicule suppose le permis : on retire l'un avec l'autre
                // plutôt que de laisser deux réponses contradictoires.
                setLicence(false);
                setVehicle(false);
              }}
            />
            Je n’ai pas le permis
          </label>
        </div>
        <label className="choice-single">
          <input
            type="checkbox"
            checked={licence && vehicle}
            disabled={!licence}
            onChange={(event) => setVehicle(event.target.checked)}
          />
          J’ai un véhicule
        </label>
        {!licence && (
          <p className="quiet">
            Le véhicule suppose le permis. Indiquez « J’ai le permis » pour
            pouvoir le signaler.
          </p>
        )}
      </Section>

      <AvailabilitySection
        slots={slots}
        missing={missingIn(user.missing_requirements, "Vos disponibilités")}
      />

      <Section
        id="recherche"
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

/** Chaque créneau se gère individuellement, quel que soit son statut. */
function AvailabilitySection({
  slots,
  missing,
}: {
  slots: Availability[];
  missing: string[];
}) {
  const { setUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const refresh = async () => setUser(await api<User>("/workers/me"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Availability | null>(null);
  const sorted = [...slots].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );

  function edit(slot: Availability) {
    setEditing(slot);
    setError("");
    setMessage("");
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>('[name="starts_at"]')
        ?.focus(),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const starts_at = new Date(str(f, "starts_at")).toISOString();
      const ends_at = new Date(str(f, "ends_at")).toISOString();
      if (Date.parse(ends_at) <= Date.parse(starts_at))
        throw new Error("La fin doit suivre le début du créneau.");
      const slot = {
        starts_at,
        ends_at,
        status: str(f, "status") as Availability["status"],
      };
      if (editing) await updateAvailability(editing.id, slot);
      else await addAvailability(slot);
      await refresh();
      setMessage(editing ? "Créneau modifié." : "Créneau ajouté.");
      setEditing(null);
      form.reset();
    } catch (e) {
      setError(humaniseError(errorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await removeAvailability(id);
      await refresh();
      if (editing?.id === id) setEditing(null);
      setMessage("Créneau supprimé.");
    } catch (e) {
      setError(humaniseError(errorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="disponibilites" ref={formRef} onSubmit={(e) => void save(e)}>
      <fieldset disabled={busy}>
        <legend>
          Vos disponibilités
          {missing.length > 0 && (
            <span className="section-todo">À compléter</span>
          )}
        </legend>
        <p className="quiet">
          Au moins un créneau disponible à venir est nécessaire. Les heures sont
          celles de votre navigateur.
        </p>
        {sorted.length > 0 ? (
          <ul className="slot-list editable-slots">
            {sorted.map((slot) => (
              <li key={slot.id}>
                <span>
                  {formatSlot(slot)} ·{" "}
                  {slot.status === "available" ? "Disponible" : "Indisponible"}
                  {Date.parse(slot.ends_at) <= Date.now() ? " · Terminé" : ""}
                </span>
                <div className="slot-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Modifier le créneau ${formatSlot(slot)}`}
                    onClick={() => edit(slot)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Retirer le créneau ${formatSlot(slot)}`}
                    onClick={() => void drop(slot.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet">Aucun créneau enregistré pour le moment.</p>
        )}
        <div key={editing?.id ?? "new"}>
          {editing && <p>Modification du créneau sélectionné</p>}
          <div className="form-grid">
            <label>
              Début
              <input
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={toLocalInput(editing?.starts_at)}
              />
            </label>
            <label>
              Fin
              <input
                name="ends_at"
                type="datetime-local"
                required
                defaultValue={toLocalInput(editing?.ends_at)}
              />
            </label>
          </div>
          <label>
            Statut
            <select
              aria-label="Statut"
              name="status"
              defaultValue={editing?.status ?? "available"}
            >
              <option value="available">Disponible</option>
              <option value="unavailable">Indisponible</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        <div className="section-actions">
          <button className="secondary-button" disabled={busy}>
            {busy
              ? "Enregistrement…"
              : editing
                ? "Enregistrer le créneau"
                : "Ajouter ce créneau"}
          </button>
          {editing && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
