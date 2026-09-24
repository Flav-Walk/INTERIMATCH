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
  CalendarDays,
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
import { ProfileShowcase } from "../components/da/ProfileShowcase";
import { MobilityMap } from "../components/da/MobilityMap";
import { useCommuneSync, type EditedField } from "../hooks/useCommuneSync";
import { useUnsavedChanges } from "../components/form/Field";
import { workerRequirementProgress } from "../services/completion";
import "../styles/profile.css";
// Nouvelle DA du formulaire (retour de revue : « pas refait ») :
// - champs texte : Animated Input (SmoothUI), le libellé remonte en orange ;
// - métiers et compétences : Animated Tags (SmoothUI), les étiquettes
//   glissent entre « sélection » et « disponibles » ;
// - permis : segment d'Animated Tabs (SmoothUI) ;
// - véhicule et recherche : Animated Toggle (SmoothUI).
// Les vrais <input> sont gardés dessous : formulaire et tests inchangés.
import AnimatedInput from "../components/ui/animated-input";
import {
  ChoiceGrid,
  SegmentedChoice,
  SwitchField,
} from "../components/da/FormControls";
import { usePageSeo } from "../hooks/usePageSeo";

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
/** "12" → 12, "" → null : les champs numériques du brouillon sont des textes. */
const toNumber = (value: string) => {
  const number = Number(value.trim());
  return value.trim() === "" || !Number.isFinite(number) ? null : number;
};
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
  hint,
  missing = [],
  className = "",
  children,
}: {
  id?: string;
  title: string;
  /** Plus affichée (nouvelle DA), gardée pour ne pas toucher aux appels. */
  icon?: ReactNode;
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
      {/* Plus d'icône dans un rond teinté : un numéro de rubrique en
          Fraunces (compteur CSS, voir profile.css). */}
      <legend>
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
  // Titre d'onglet propre à la page (RGAA 8.6) ; espace privé non indexé.
  usePageSeo({
    title: "Mon profil · InteriMatch",
    description: "Votre profil professionnel, votre mobilité et vos disponibilités.",
    robots: "noindex,nofollow",
  });
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

  // Ville ⇄ code postal : l'un complète l'autre (voir useCommuneSync).
  const [placeEdited, setPlaceEdited] = useState<EditedField>(null);
  const commune = useCommuneSync({
    city: draft.city,
    postalCode: draft.postal_code,
    edited: placeEdited,
    apply: (values, rerun) => {
      setDraft((current) => ({ ...current, ...values }));
      setSaved(false);
      setPlaceEdited(rerun ?? null);
    },
  });

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
  // Le libellé du métier (« Serveur ») plutôt que sa valeur (« serveur »).
  // Données de la vitrine du haut de page (ProfileShowcase).
  const displayName =
    draft.first_name || draft.last_name
      ? `${draft.first_name} ${draft.last_name}`.trim()
      : "Complétez vos informations";
  const initials =
    [draft.first_name, draft.last_name]
      .map((part) => part.trim()[0]?.toUpperCase() ?? "")
      .join("") || "?";
  // Prochain créneau « Disponible » encore à venir.
  const nextSlot = [...slots]
    .filter(
      (slot) =>
        slot.status === "available" && Date.parse(slot.ends_at) > Date.now(),
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const jobLabel =
    jobOptions.find((job) => job.value === draft.main_job)?.label ??
    draft.main_job;

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
      {/* Haut de page « waouh » : la carte pro + l'aperçu recruteur, qui se
          mettent à jour EN DIRECT pendant la saisie (voir ProfileShowcase). */}
      <ProfileShowcase
        name={displayName}
        initials={initials}
        jobLabel={jobLabel}
        city={draft.city}
        radiusKm={toNumber(draft.mobility_radius_km)}
        years={toNumber(draft.years_experience)}
        skills={skills
          .filter((skill) => draft.skill_ids.includes(skill.id))
          .map((skill) => skill.name)}
        secondaryJobs={jobs
          .filter((job) => draft.secondary_jobs.includes(job.value))
          .map((job) => job.label)}
        nextSlot={nextSlot ? formatSlot(nextSlot) : null}
        progress={requirementProgress}
        missingCount={missing.length}
      />

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {/* Mise en page : une seule colonne pleine largeur sous la vitrine.
          Les rubriques s'enchaînent DANS L'ORDRE où le rapprochement en a
          besoin, puis les facultatives. Ce qui manque est signalé dans
          chaque rubrique (« À compléter ») et le % est dans la vitrine.
          La barre d'enregistrement reste collée en bas de l'écran. */}
      <div className="profile-layout">
        <div className="profile-main">
          {/* Formulaire 1 : les rubriques exigées par le rapprochement. */}
          <form
            id="worker-profile-form"
            className="profile-editor"
            onSubmit={(event) => void saveProfile(event)}
          >
            <ProfileSection
              id="identite"
              title="Votre identité"
              icon={<UserRound size={18} />}
              className="profile-section--identity"
              missing={missingIn(user.missing_requirements, "Votre identité")}
            >
              <div className="form-grid profile-float-fields">
                <AnimatedInput
                  className="da-scope"
                  inputClassName="profile-float-input"
                  label="Prénom"
                  value={draft.first_name}
                  onChange={(value) => update("first_name", value)}
                  inputProps={{ name: "first_name", maxLength: 120 }}
                />
                <AnimatedInput
                  className="da-scope"
                  inputClassName="profile-float-input"
                  label="Nom"
                  value={draft.last_name}
                  onChange={(value) => update("last_name", value)}
                  inputProps={{ name: "last_name", maxLength: 120 }}
                />
              </div>
              <AnimatedInput
                className="da-scope profile-float-fields"
                inputClassName="profile-float-input"
                label="Téléphone (facultatif)"
                value={draft.phone}
                onChange={(value) => update("phone", value)}
                inputProps={{ name: "phone", type: "tel" }}
              />
              <p className="quiet profile-account-email">
                Email du compte · {user.email}
              </p>
            </ProfileSection>

            <ProfileSection
              id="metier"
              title="Votre métier"
              icon={<BriefcaseBusiness size={18} />}
              className="profile-section--job"
              missing={missingIn(user.missing_requirements, "Votre métier")}
              hint="Le métier principal sert au rapprochement avec les missions."
            >
              <div className="profile-job-fields">
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
              </div>
            </ProfileSection>

            <ProfileSection
              id="recherche"
              title="Votre recherche"
              icon={<Search size={18} />}
              className="profile-section--wide profile-section--search"
              hint="Mettez votre recherche en pause sans perdre votre profil."
            >
              {/* Carte étroite du bento : l'interrupteur seul porte l'état
                  (plus de pastille « Recherche active », jugée « trop IA »).
                  La description change avec l'état pour rester explicite. */}
              <SwitchField
                name="open_to_missions"
                label="Je recherche des missions"
                description={
                  draft.open_to_missions
                    ? "Votre profil est proposé aux établissements."
                    : "En pause : votre profil n’est plus proposé."
                }
                checked={draft.open_to_missions}
                onChange={(checked) => update("open_to_missions", checked)}
              />
            </ProfileSection>

            {/* Carte Bento large « Compétences & Métiers » : toutes les
                options visibles d'un coup d'œil, en grille régulière.
                Compétences (exigées) puis métiers secondaires (facultatifs),
                séparés par un fin divider plutôt que deux petits blocs. */}
            <ProfileSection
              id="competences"
              title="Compétences & Métiers"
              icon={<Sparkles size={18} />}
              className="profile-section--wide profile-section--skills"
              missing={missingIn(user.missing_requirements, "Vos compétences")}
            >
              <ChoiceGrid
                name="skill_ids"
                legend="Vos compétences"
                hint="Au moins une : c’est le critère principal du rapprochement."
                options={skills.map((skill) => ({
                  value: skill.id,
                  label: skill.name,
                }))}
                selected={draft.skill_ids}
                onToggle={(value, checked) =>
                  update("skill_ids", toggle(draft.skill_ids, value, checked))
                }
              />
              <hr className="profile-divider" />
              <ChoiceGrid
                name="secondary_jobs"
                legend="Autres métiers exercés"
                optional
                options={jobs}
                selected={draft.secondary_jobs}
                onToggle={(value, checked) =>
                  update(
                    "secondary_jobs",
                    toggle(draft.secondary_jobs, value, checked),
                  )
                }
              />
            </ProfileSection>

            <ProfileSection
              id="mobilite"
              title="Votre mobilité"
              icon={<MapPin size={18} />}
              className="profile-section--wide profile-section--mobility"
              missing={missingIn(user.missing_requirements, "Votre mobilité")}
              hint="Votre ville et votre rayon servent à proposer des missions accessibles."
            >
              <div className="profile-mobility-fields profile-float-fields">
                <AnimatedInput
                  className="da-scope"
                  inputClassName="profile-float-input"
                  label="Ville"
                  value={draft.city}
                  onChange={(value) => {
                    update("city", value);
                    setPlaceEdited("city");
                  }}
                  inputProps={{ name: "city" }}
                />
                <AnimatedInput
                  className="da-scope"
                  inputClassName="profile-float-input"
                  label="Code postal"
                  value={draft.postal_code}
                  onChange={(value) => {
                    update("postal_code", value);
                    setPlaceEdited("postal_code");
                  }}
                  inputProps={{
                    name: "postal_code",
                    inputMode: "numeric",
                    pattern: "[0-9]{5}",
                    maxLength: 5,
                  }}
                />
                <AnimatedInput
                  className="da-scope"
                  inputClassName="profile-float-input"
                  label="Rayon de mobilité (km)"
                  value={draft.mobility_radius_km}
                  onChange={(value) => update("mobility_radius_km", value)}
                  inputProps={{
                    name: "mobility_radius_km",
                    type: "number",
                    min: 0,
                    max: 250,
                  }}
                />
              </div>
              {/* Ville ⇄ code postal : message + propositions en un clic. */}
              {(commune.message || commune.choices.length > 0) && (
                <div className="commune-sync" aria-live="polite">
                  {commune.message && (
                    <p className="commune-sync__message">{commune.message}</p>
                  )}
                  {commune.choices.length > 0 && (
                    <div className="commune-sync__choices">
                      {commune.choices.map((choice) => (
                        <button
                          key={`${choice.city}-${choice.postalCode}`}
                          type="button"
                          className="commune-sync__choice"
                          onClick={() => commune.choose(choice)}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Vraie carte : le cercle suit le rayon et la ville, en direct. */}
              <MobilityMap
                city={draft.city}
                postalCode={draft.postal_code}
                radiusKm={toNumber(draft.mobility_radius_km)}
                saved={
                  profile.latitude != null && profile.longitude != null
                    ? { lat: profile.latitude, lon: profile.longitude }
                    : null
                }
              />
              <SegmentedChoice
                name="licence"
                legend="Permis de conduire"
                legendId="licence-label"
                value={draft.has_driving_licence ? "yes" : "no"}
                options={[
                  { value: "yes", label: "J’ai le permis" },
                  { value: "no", label: "Je n’ai pas le permis" },
                ]}
                onChange={(value) =>
                  value === "yes"
                    ? update("has_driving_licence", true)
                    : setDraft((current) => ({
                        ...current,
                        has_driving_licence: false,
                        has_vehicle: false,
                      }))
                }
              />
              <SwitchField
                label="J’ai un véhicule"
                description={
                  draft.has_driving_licence
                    ? undefined
                    : "Disponible une fois le permis indiqué."
                }
                checked={draft.has_driving_licence && draft.has_vehicle}
                disabled={!draft.has_driving_licence}
                onChange={(checked) => update("has_vehicle", checked)}
              />
            </ProfileSection>
          </form>

          {/* Les disponibilités s'enregistrent seules, créneau par créneau :
              elles gardent leur propre formulaire, placé ici, juste après la
              mobilité, car c'est le dernier prérequis. */}
          <AvailabilitySection
            slots={slots}
            missing={missingIn(user.missing_requirements, "Vos disponibilités")}
          />

          {/* Formulaire 2 : les rubriques facultatives. Même enregistrement
              que le formulaire 1 (la barre du bas enregistre tout). */}
          <form
            className="profile-editor"
            onSubmit={(event) => void saveProfile(event)}
          >
            <ProfileSection
              id="experiences"
              title="Vos expériences"
              icon={<BriefcaseBusiness size={18} />}
              className="profile-section--records"
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
                    <label className="profile-repeat__primary">
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
              id="diplomes"
              title="Vos diplômes et certifications"
              icon={<Award size={18} />}
              className="profile-section--records"
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
                    <label className="profile-repeat__primary">
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

          </form>

          {/* Barre d'enregistrement collée en bas de l'écran : visible quelle
              que soit la rubrique. Le bouton vise le formulaire 1 (attribut
              form), qui enregistre toutes les rubriques modifiées. */}
          <div
            className={`profile-savebar${dirty ? " is-dirty" : ""}`}
          >
            <div className="profile-savebar__message" aria-live="polite">
              <strong>Modifications du profil</strong>
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
                <p className="quiet">Des changements restent à enregistrer.</p>
              )}
              {!saveError && !saved && !dirty && (
                <p className="quiet">Votre profil est à jour.</p>
              )}
            </div>
            <button
              className="button"
              form="worker-profile-form"
              disabled={!dirty || busy}
            >
              {busy ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
      </div>
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
            <CalendarDays size={18} />
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
              <ul className="slot-list editable-slots profile-slot-list">
                {orderedSlots.map((slot) => (
                  <li key={slot.id}>
                    <span className="profile-slot-date">
                      <CalendarDays size={17} aria-hidden="true" />
                      <strong>{formatSlot(slot)}</strong>
                    </span>
                    <span
                      className={`profile-slot-status is-${slot.status}`}
                    >
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
