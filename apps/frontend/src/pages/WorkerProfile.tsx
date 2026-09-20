import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  Award,
  BriefcaseBusiness,
  Check,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  api,
  errorMessage,
  type Availability,
  type Certification,
  type Experience,
  type ReferenceValue,
  type Skill,
  type User,
} from "../services/session";
import {
  addAvailability,
  formatSlot,
  humaniseError,
  missingIn,
  partial,
  patchWorker,
  putCertifications,
  putExperiences,
  putSkills,
  removeAvailability,
  requirementLabels,
  toLocalInput,
  updateAvailability,
} from "../services/profile";
import { HeroBanner } from "../components/HeroBanner";
import { CircularGauge } from "../components/CircularGauge";
import { useUnsavedChanges } from "../components/form/Field";
import { workerRequirementProgress } from "../services/completion";
import "../styles/profile.css";

type DraftExperience = Omit<Experience, "id">;
type DraftCertification = Omit<Certification, "id">;

export interface WorkerProfileDraft {
  first_name: string;
  last_name: string;
  phone: string;
  main_job: string;
  secondary_jobs: string[];
  years_experience: string;
  skill_ids: string[];
  experiences: DraftExperience[];
  certifications: DraftCertification[];
  city: string;
  postal_code: string;
  mobility_radius_km: string;
  has_driving_licence: boolean;
  has_vehicle: boolean;
  open_to_missions: boolean;
}

type SaveGroup = "worker" | "skills" | "experiences" | "certifications";

const EMPTY_DRAFT: WorkerProfileDraft = {
  first_name: "",
  last_name: "",
  phone: "",
  main_job: "",
  secondary_jobs: [],
  years_experience: "",
  skill_ids: [],
  experiences: [],
  certifications: [],
  city: "",
  postal_code: "",
  mobility_radius_km: "",
  has_driving_licence: false,
  has_vehicle: false,
  open_to_missions: true,
};

export function workerProfileDraft(user: User | null): WorkerProfileDraft {
  if (!user) return { ...EMPTY_DRAFT };
  const profile = user.profile;
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: profile.phone ?? "",
    main_job: profile.main_job ?? "",
    secondary_jobs: [...(profile.secondary_jobs ?? [])],
    years_experience:
      profile.years_experience === null ||
      profile.years_experience === undefined
        ? ""
        : String(profile.years_experience),
    skill_ids: (profile.skills ?? []).map((skill) => skill.id),
    experiences: (profile.experiences ?? []).map(
      ({ job_title, employer, years }) => ({
        job_title,
        employer,
        years: Number(years),
      }),
    ),
    certifications: (profile.certifications ?? []).map(
      ({ name, issuer, obtained_on }) => ({
        name,
        issuer: issuer ?? "",
        obtained_on,
      }),
    ),
    city: profile.city ?? "",
    postal_code: profile.postal_code ?? "",
    mobility_radius_km:
      profile.mobility_radius_km === null ||
      profile.mobility_radius_km === undefined
        ? ""
        : String(profile.mobility_radius_km),
    has_driving_licence: profile.has_driving_licence ?? false,
    has_vehicle: profile.has_vehicle ?? false,
    open_to_missions: profile.open_to_missions ?? true,
  };
}

const stable = (value: unknown) => JSON.stringify(value);
const sorted = (values: string[]) => [...values].sort();

export function changedProfileGroups(
  baseline: WorkerProfileDraft,
  draft: WorkerProfileDraft,
): SaveGroup[] {
  const workerKeys: (keyof WorkerProfileDraft)[] = [
    "first_name",
    "last_name",
    "phone",
    "main_job",
    "secondary_jobs",
    "years_experience",
    "city",
    "postal_code",
    "mobility_radius_km",
    "has_driving_licence",
    "has_vehicle",
    "open_to_missions",
  ];
  const groups: SaveGroup[] = [];
  if (
    workerKeys.some((key) => {
      const before = baseline[key];
      const after = draft[key];
      const normalise = (value: WorkerProfileDraft[typeof key]) =>
        Array.isArray(value)
          ? [...value].sort((a, b) =>
              stable(a).localeCompare(stable(b)),
            )
          : value;
      return stable(normalise(before)) !== stable(normalise(after));
    })
  )
    groups.push("worker");
  if (stable(sorted(baseline.skill_ids)) !== stable(sorted(draft.skill_ids)))
    groups.push("skills");
  if (stable(baseline.experiences) !== stable(draft.experiences))
    groups.push("experiences");
  if (stable(baseline.certifications) !== stable(draft.certifications))
    groups.push("certifications");
  return groups;
}

function workerPayload(draft: WorkerProfileDraft) {
  const years = draft.years_experience.trim();
  const radius = draft.mobility_radius_km.trim();
  return {
    ...partial({
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      main_job: draft.main_job,
      city: draft.city.trim(),
      postal_code: draft.postal_code.trim(),
      mobility_radius_km: radius === "" ? undefined : Number(radius),
    }),
    phone: draft.phone.trim() || null,
    secondary_jobs: draft.secondary_jobs,
    years_experience: years === "" ? null : Number(years),
    has_driving_licence: draft.has_driving_licence,
    has_vehicle: draft.has_driving_licence && draft.has_vehicle,
    open_to_missions: draft.open_to_missions,
  };
}

function ProfileSection({
  id,
  title,
  icon,
  hint,
  missing = [],
  className = "",
  children,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  hint?: string;
  missing?: (keyof typeof requirementLabels)[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      id={id}
      className={`profile-section ${className}`.trim()}
    >
      <legend>
        <span className="profile-section__icon" aria-hidden="true">
          {icon}
        </span>
        <span>{title}</span>
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
      {hint && <p className="quiet profile-section__hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

function toggle(values: string[], value: string, checked: boolean) {
  return checked
    ? values.includes(value)
      ? values
      : [...values, value]
    : values.filter((item) => item !== value);
}

export function WorkerProfile() {
  const { user, setUser } = useAuth();
  const { hash } = useLocation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [jobs, setJobs] = useState<ReferenceValue[]>([]);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(() => workerProfileDraft(user));
  const [baseline, setBaseline] = useState(() => workerProfileDraft(user));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const initialisedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user || initialisedUser.current === user.id) return;
    const initial = workerProfileDraft(user);
    setDraft(initial);
    setBaseline(initial);
    initialisedUser.current = user.id;
  }, [user]);

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({
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
      .then(([skillList, reference]) => {
        setSkills(skillList);
        setJobs(reference.jobs);
      })
      .catch((error) => setLoadError(errorMessage(error)));
  }, []);

  const dirtyGroups = useMemo(
    () => changedProfileGroups(baseline, draft),
    [baseline, draft],
  );
  const dirty = dirtyGroups.length > 0;
  useUnsavedChanges(dirty && !busy);

  if (!user) return null;
  const profile = user.profile;
  const missing = user.missing_requirements ?? [];
  const requirementProgress = workerRequirementProgress(
    user.missing_requirements,
  );
  const slots = profile.availabilities ?? [];
  const jobOptions =
    !draft.main_job || jobs.some((job) => job.value === draft.main_job)
      ? jobs
      : [
          ...jobs,
          { value: draft.main_job, label: draft.main_job },
        ];

  function update<K extends keyof WorkerProfileDraft>(
    key: K,
    value: WorkerProfileDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSaveError("");
  }

  function validate() {
    if (
      draft.experiences.some(
        (experience) =>
          !experience.job_title.trim() || !experience.employer.trim(),
      )
    )
      throw new Error(
        "Renseignez le poste et l’établissement de chaque expérience, ou retirez la ligne.",
      );
    if (
      draft.certifications.some(
        (certification) => !certification.name.trim(),
      )
    )
      throw new Error(
        "Renseignez l’intitulé de chaque certification, ou retirez la ligne.",
      );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setSaveError("");
    setSaved(false);
    const pending = [...dirtyGroups];
    let nextBaseline = baseline;
    let completed = 0;
    try {
      validate();
      for (const group of pending) {
        let updated: User;
        if (group === "worker") {
          updated = await patchWorker(workerPayload(draft));
        } else if (group === "skills") {
          updated = await putSkills(draft.skill_ids);
        } else if (group === "experiences") {
          updated = await putExperiences(
            draft.experiences.map((experience) => ({
              job_title: experience.job_title.trim(),
              employer: experience.employer.trim(),
              years: Number(experience.years),
            })),
          );
        } else {
          updated = await putCertifications(
            draft.certifications.map((certification) => ({
              name: certification.name.trim(),
              issuer: certification.issuer.trim(),
              obtained_on: certification.obtained_on || null,
            })),
          );
        }
        completed += 1;
        setUser(updated);
        const persisted = workerProfileDraft(updated);
        const savedExperiences = draft.experiences.map((experience) => ({
          job_title: experience.job_title.trim(),
          employer: experience.employer.trim(),
          years: Number(experience.years),
        }));
        const savedCertifications = draft.certifications.map(
          (certification) => ({
            name: certification.name.trim(),
            issuer: certification.issuer.trim(),
            obtained_on: certification.obtained_on || null,
          }),
        );
        nextBaseline = {
          ...nextBaseline,
          ...(group === "worker"
            ? {
                first_name: persisted.first_name,
                last_name: persisted.last_name,
                phone: persisted.phone,
                main_job: persisted.main_job,
                secondary_jobs: persisted.secondary_jobs,
                years_experience: persisted.years_experience,
                city: persisted.city,
                postal_code: persisted.postal_code,
                mobility_radius_km: persisted.mobility_radius_km,
                has_driving_licence: persisted.has_driving_licence,
                has_vehicle: persisted.has_vehicle,
                open_to_missions: persisted.open_to_missions,
              }
            : group === "skills"
              ? { skill_ids: [...draft.skill_ids] }
              : group === "experiences"
                ? { experiences: savedExperiences }
                : { certifications: savedCertifications }),
        };
        setBaseline(nextBaseline);
      }
      setSaved(true);
    } catch (error) {
      const message = humaniseError(errorMessage(error));
      setSaveError(
        completed > 0
          ? `Certaines modifications ont été enregistrées. Il reste des changements à sauvegarder. ${message}`
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding worker-profile">
      <HeroBanner
        compact
        eyeline="Votre espace intérimaire"
        title="Votre profil professionnel"
        subtitle="Un profil clair aide InteriMatch à rapprocher vos compétences, votre mobilité et vos disponibilités des bonnes missions."
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

      <div className="profile-overview">
        <div>
          <p className="eyeline">Votre profil en un coup d’œil</p>
          <h2>
            {draft.first_name || draft.last_name
              ? `${draft.first_name} ${draft.last_name}`.trim()
              : "Complétez vos informations"}
          </h2>
          <p className="quiet">
            {draft.main_job || "Métier principal à renseigner"}
            {draft.city ? ` · ${draft.city}` : ""}
          </p>
        </div>
        {user.missing_requirements === undefined ? null : missing.length > 0 ? (
          <div className="profile-overview__todo" role="status">
            <strong>{missing.length} prérequis à compléter</strong>
            <span>Ils sont signalés dans les rubriques concernées.</span>
            <div className="profile-overview__missing">
              {missing.map((rule) => (
                <span key={rule}>{requirementLabels[rule]}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="profile-overview__ready" role="status">
            <Check size={17} aria-hidden="true" />
            Tous les prérequis pour recevoir des missions sont réunis.
          </p>
        )}
      </div>

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      <form
        className="profile-editor"
        onSubmit={(event) => void saveProfile(event)}
      >
        <div className="profile-grid">
          <ProfileSection
            title="Votre identité"
            icon={<UserRound size={18} />}
            missing={missingIn(user.missing_requirements, "Votre identité")}
          >
            <div className="form-grid">
              <label>
                Prénom
                <input
                  name="first_name"
                  maxLength={120}
                  value={draft.first_name}
                  onChange={(event) => update("first_name", event.target.value)}
                />
              </label>
              <label>
                Nom
                <input
                  name="last_name"
                  maxLength={120}
                  value={draft.last_name}
                  onChange={(event) => update("last_name", event.target.value)}
                />
              </label>
            </div>
            <label>
              Téléphone <span className="field-optional">(facultatif)</span>
              <input
                name="phone"
                type="tel"
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <p className="quiet profile-account-email">
              Email du compte · {user.email}
            </p>
          </ProfileSection>

          <ProfileSection
            title="Votre métier"
            icon={<BriefcaseBusiness size={18} />}
            missing={missingIn(user.missing_requirements, "Votre métier")}
            hint="Le métier principal sert au rapprochement avec les missions."
          >
            <label>
              Métier principal
              <select
                name="main_job"
                value={draft.main_job}
                onChange={(event) => update("main_job", event.target.value)}
              >
                <option value="">Choisissez un métier</option>
                {jobOptions.map((job) => (
                  <option key={job.value} value={job.value}>
                    {job.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Années d’expérience du métier{" "}
              <span className="field-optional">(facultatif)</span>
              <input
                name="years_experience"
                type="number"
                min={0}
                max={60}
                step="0.5"
                value={draft.years_experience}
                onChange={(event) =>
                  update("years_experience", event.target.value)
                }
              />
            </label>
            <span id="secondary-label" className="choice-label">
              Autres métiers exercés{" "}
              <span className="field-optional">(facultatif)</span>
            </span>
            <div
              className="profile-chip-options"
              role="group"
              aria-labelledby="secondary-label"
            >
              {jobs.map((job) => (
                <label key={job.value}>
                  <input
                    type="checkbox"
                    name="secondary_jobs"
                    value={job.value}
                    checked={draft.secondary_jobs.includes(job.value)}
                    onChange={(event) =>
                      update(
                        "secondary_jobs",
                        toggle(
                          draft.secondary_jobs,
                          job.value,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  <span>{job.label}</span>
                </label>
              ))}
            </div>
          </ProfileSection>

          <ProfileSection
            id="competences"
            title="Vos compétences"
            icon={<Sparkles size={18} />}
            className="profile-section--wide"
            missing={missingIn(user.missing_requirements, "Vos compétences")}
            hint="Au moins une compétence est nécessaire : c’est le critère principal du rapprochement."
          >
            <div
              className="profile-chip-options"
              role="group"
              aria-label="Compétences"
            >
              {skills.map((skill) => (
                <label key={skill.id}>
                  <input
                    type="checkbox"
                    name="skill_ids"
                    value={skill.id}
                    checked={draft.skill_ids.includes(skill.id)}
                    onChange={(event) =>
                      update(
                        "skill_ids",
                        toggle(
                          draft.skill_ids,
                          skill.id,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  <span>{skill.name}</span>
                </label>
              ))}
            </div>
          </ProfileSection>

          <ProfileSection
            title="Vos expériences"
            icon={<BriefcaseBusiness size={18} />}
            hint="Facultatif, mais une expérience détaillée renforce votre profil."
          >
            <div className="profile-repeat-list">
              {draft.experiences.map((experience, index) => (
                <div className="profile-repeat" key={index}>
                  <div className="profile-repeat__head">
                    <strong>Expérience {index + 1}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Retirer l’expérience ${index + 1}`}
                      onClick={() =>
                        update(
                          "experiences",
                          draft.experiences.filter((_, item) => item !== index),
                        )
                      }
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <label>
                    Poste
                    <input
                      value={experience.job_title}
                      maxLength={120}
                      onChange={(event) =>
                        update(
                          "experiences",
                          draft.experiences.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, job_title: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Établissement
                    <input
                      value={experience.employer}
                      maxLength={120}
                      onChange={(event) =>
                        update(
                          "experiences",
                          draft.experiences.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, employer: event.target.value }
                              : item,
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
                      value={experience.years}
                      onChange={(event) =>
                        update(
                          "experiences",
                          draft.experiences.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, years: Number(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                update("experiences", [
                  ...draft.experiences,
                  { job_title: "", employer: "", years: 0 },
                ])
              }
            >
              <Plus size={16} aria-hidden="true" /> Ajouter une expérience
            </button>
          </ProfileSection>

          <ProfileSection
            title="Vos diplômes et certifications"
            icon={<Award size={18} />}
            hint="Facultatif · HACCP, permis d’exploitation, mention complémentaire…"
          >
            <div className="profile-repeat-list">
              {draft.certifications.map((certification, index) => (
                <div className="profile-repeat" key={index}>
                  <div className="profile-repeat__head">
                    <strong>Certification {index + 1}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Retirer la certification ${index + 1}`}
                      onClick={() =>
                        update(
                          "certifications",
                          draft.certifications.filter(
                            (_, item) => item !== index,
                          ),
                        )
                      }
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <label>
                    Intitulé
                    <input
                      value={certification.name}
                      maxLength={120}
                      onChange={(event) =>
                        update(
                          "certifications",
                          draft.certifications.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Organisme
                    <input
                      value={certification.issuer}
                      maxLength={120}
                      onChange={(event) =>
                        update(
                          "certifications",
                          draft.certifications.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, issuer: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Obtenu le
                    <input
                      type="date"
                      value={certification.obtained_on ?? ""}
                      onChange={(event) =>
                        update(
                          "certifications",
                          draft.certifications.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  obtained_on: event.target.value || null,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() =>
                update("certifications", [
                  ...draft.certifications,
                  { name: "", issuer: "", obtained_on: null },
                ])
              }
            >
              <Plus size={16} aria-hidden="true" /> Ajouter une certification
            </button>
          </ProfileSection>

          <ProfileSection
            id="mobilite"
            title="Votre mobilité"
            icon={<MapPin size={18} />}
            missing={missingIn(user.missing_requirements, "Votre mobilité")}
            hint="Votre ville et votre rayon servent à proposer des missions accessibles."
          >
            <div className="form-grid">
              <label>
                Ville
                <input
                  name="city"
                  value={draft.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </label>
              <label>
                Code postal
                <input
                  name="postal_code"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={draft.postal_code}
                  onChange={(event) =>
                    update("postal_code", event.target.value)
                  }
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
                value={draft.mobility_radius_km}
                onChange={(event) =>
                  update("mobility_radius_km", event.target.value)
                }
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
                  checked={draft.has_driving_licence}
                  onChange={() => update("has_driving_licence", true)}
                />
                J’ai le permis
              </label>
              <label>
                <input
                  type="radio"
                  name="licence"
                  checked={!draft.has_driving_licence}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      has_driving_licence: false,
                      has_vehicle: false,
                    }))
                  }
                />
                Je n’ai pas le permis
              </label>
            </div>
            <label className="choice-single">
              <input
                type="checkbox"
                checked={draft.has_driving_licence && draft.has_vehicle}
                disabled={!draft.has_driving_licence}
                onChange={(event) =>
                  update("has_vehicle", event.target.checked)
                }
              />
              J’ai un véhicule
            </label>
          </ProfileSection>

          <ProfileSection
            id="recherche"
            title="Votre recherche"
            icon={<Search size={18} />}
            className="profile-section--compact"
            hint="Mettez votre recherche en pause sans perdre votre profil."
          >
            <label className="profile-search-toggle">
              <input
                type="checkbox"
                name="open_to_missions"
                checked={draft.open_to_missions}
                onChange={(event) =>
                  update("open_to_missions", event.target.checked)
                }
              />
              <span>
                <strong>Je recherche des missions</strong>
                <small>
                  Votre profil peut être rapproché des besoins publiés.
                </small>
              </span>
            </label>
          </ProfileSection>
        </div>

        <div
          className={`profile-savebar${dirty ? " is-dirty" : ""}`}
        >
          <div className="profile-savebar__message" aria-live="polite">
            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
            {saved && !dirty && (
              <p className="form-success" role="status">
                <Check size={16} aria-hidden="true" /> Profil enregistré.
              </p>
            )}
            {!saveError && !saved && dirty && (
              <p className="quiet">Modifications non enregistrées</p>
            )}
          </div>
          <button className="button" disabled={!dirty || busy}>
            {busy ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </form>

      <AvailabilitySection
        slots={slots}
        missing={missingIn(user.missing_requirements, "Vos disponibilités")}
      />
    </section>
  );
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

/** Les disponibilités restent autonomes : chacune est persistée immédiatement. */
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
  const orderedSlots = [...slots].sort(
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
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const starts_at = new Date(
        formValue(values, "starts_at"),
      ).toISOString();
      const ends_at = new Date(formValue(values, "ends_at")).toISOString();
      if (Date.parse(ends_at) <= Date.parse(starts_at))
        throw new Error("La fin doit suivre le début du créneau.");
      const slot = {
        starts_at,
        ends_at,
        status: formValue(values, "status") as Availability["status"],
      };
      if (editing) await updateAvailability(editing.id, slot);
      else await addAvailability(slot);
      await refresh();
      setMessage(editing ? "Créneau modifié." : "Créneau ajouté.");
      setEditing(null);
      form.reset();
    } catch (caught) {
      setError(humaniseError(errorMessage(caught)));
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
    } catch (caught) {
      setError(humaniseError(errorMessage(caught)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="disponibilites"
      className="profile-availability"
      ref={formRef}
      onSubmit={(event) => void save(event)}
    >
      <fieldset className="profile-section" disabled={busy}>
        <legend>
          <span className="profile-section__icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span>Vos disponibilités</span>
          {missing.length > 0 && (
            <span className="section-todo">À compléter</span>
          )}
        </legend>
        <p className="quiet profile-section__hint">
          Ces créneaux sont enregistrés séparément et immédiatement. Les heures
          affichées sont celles de votre navigateur.
        </p>
        <div className="availability-layout">
          <div>
            {orderedSlots.length > 0 ? (
              <ul className="slot-list editable-slots">
                {orderedSlots.map((slot) => (
                  <li key={slot.id}>
                    <span>
                      {formatSlot(slot)} ·{" "}
                      {slot.status === "available"
                        ? "Disponible"
                        : "Indisponible"}
                      {Date.parse(slot.ends_at) <= Date.now()
                        ? " · Terminé"
                        : ""}
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
          </div>
          <div className="availability-editor" key={editing?.id ?? "new"}>
            {editing && <strong>Modifier le créneau sélectionné</strong>}
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
