import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  api,
  errorMessage,
  type ReferenceValue,
  type Skill,
} from "../services/session";
import { SkillPicker } from "../components/mission/SkillPicker";
import {
  createMission,
  emptyMission,
  formToMission,
  getMission,
  missionDiff,
  missionToForm,
  updateMission,
  validateMission,
  type MissionFormValues,
} from "../services/missions";

/** Champ de saisie : libellé, erreur et liaison ARIA au même endroit. */
function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const described = [hint && `${name}-hint`, error && `${name}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {hint && (
        <p className="quiet field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {children({
        id: name,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(described ? { "aria-describedby": described } : {}),
      })}
      {error && (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Création et modification d'une mission, par le même écran. Les deux gestes
 * décrivent le même objet : les séparer en deux formulaires ferait diverger
 * deux fois les mêmes règles.
 *
 * La publication n'est pas ici. Enregistrer produit — ou laisse — un brouillon ;
 * publier est une décision distincte, prise depuis le détail de la mission.
 */
export function CompanyMissionForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<MissionFormValues>(emptyMission);
  const [initial, setInitial] = useState<MissionFormValues | null>(null);
  const [jobs, setJobs] = useState<ReferenceValue[]>([]);
  const [payUnits, setPayUnits] = useState<ReferenceValue[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<keyof MissionFormValues, string>>
  >({});
  const [apiError, setApiError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void Promise.all([
      api<Skill[]>("/skills"),
      api<{ jobs: ReferenceValue[]; pay_units: ReferenceValue[] }>(
        "/reference",
      ),
      id ? getMission(id) : Promise.resolve(null),
    ])
      .then(([loadedSkills, reference, mission]) => {
        if (!live) return;
        setSkills(loadedSkills);
        setJobs(reference.jobs);
        setPayUnits(reference.pay_units);
        if (mission) {
          const form = missionToForm(mission);
          setValues(form);
          setInitial(form);
        }
        setApiError("");
      })
      .catch((e) => live && setApiError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  const set = <K extends keyof MissionFormValues>(
    key: K,
    value: MissionFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setNote("");
    // L'erreur disparaît dès qu'on corrige, pas seulement au prochain envoi :
    // sinon le message contredit ce qu'on vient de saisir. Une règle portant
    // sur deux champs s'efface en touchant l'un ou l'autre — choisir l'unité
    // de rémunération règle bien le reproche fait au montant.
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "pay_amount" || key === "pay_unit") delete next.pay_amount;
      if (key === "starts_at" || key === "ends_at") delete next.ends_at;
      return next;
    });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError("");
    setNote("");
    const found = validateMission(values);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current
        ?.querySelector<HTMLElement>(`[id="${CSS.escape(first)}"]`)
        ?.focus();
      return;
    }

    setBusy(true);
    try {
      const payload = formToMission(values);
      if (editing && id) {
        // `PATCH` est partiel : n'envoyer que l'écart évite de réécrire des
        // colonnes intactes, et de déclencher un géocodage pour rien.
        const patch = missionDiff(formToMission(initial ?? values), payload);
        if (!Object.keys(patch).length) {
          setNote("Aucune modification à enregistrer.");
          return;
        }
        const saved = await updateMission(id, patch);
        navigate("/company/missions/" + saved.id, {
          state: { flash: "Modifications enregistrées." },
        });
      } else {
        const created = await createMission(payload);
        navigate("/company/missions/" + created.id, {
          state: {
            flash:
              "Mission enregistrée en brouillon. Publiez-la quand elle est prête.",
          },
        });
      }
    } catch (e) {
      setApiError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="page-form">
        <p role="status" className="quiet">
          Chargement du formulaire…
        </p>
      </section>
    );

  return (
    <section className="page-form">
      <Link
        className="link-back"
        to={editing ? "/company/missions/" + id : "/company/missions"}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        {editing ? "Retour à la mission" : "Vos missions"}
      </Link>

      <h1>{editing ? "Modifier la mission" : "Créer une mission"}</h1>
      <p className="quiet page-lead">
        {editing
          ? "Vos modifications remplacent les informations enregistrées. Le statut de la mission ne change pas."
          : "La mission est enregistrée en brouillon. Elle ne sera visible des intérimaires qu’une fois publiée."}
      </p>

      {apiError && (
        <p className="form-error" role="alert">
          {apiError}
        </p>
      )}

      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate>
        <fieldset disabled={busy}>
          <legend>Informations générales</legend>
          <Field
            name="title"
            label="Intitulé de la mission"
            error={errors.title}
          >
            {(props) => (
              <input
                {...props}
                name="title"
                maxLength={120}
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
              />
            )}
          </Field>
          <Field name="job" label="Métier recherché" error={errors.job}>
            {(props) => (
              <select
                {...props}
                name="job"
                value={values.job}
                onChange={(e) => set("job", e.target.value)}
              >
                <option value="">Choisissez un métier</option>
                {jobs.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            name="description"
            label="Description (facultatif)"
            hint="Le déroulé du service, la tenue attendue, le contexte de l’établissement."
          >
            {(props) => (
              <textarea
                {...props}
                name="description"
                maxLength={2000}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            )}
          </Field>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Date et horaires</legend>
          <p className="quiet">
            Les heures sont celles de votre navigateur. Une mission qui se
            termine après minuit se saisit normalement.
          </p>
          <div className="form-grid">
            <Field name="starts_at" label="Début" error={errors.starts_at}>
              {(props) => (
                <input
                  {...props}
                  name="starts_at"
                  type="datetime-local"
                  value={values.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                />
              )}
            </Field>
            <Field name="ends_at" label="Fin" error={errors.ends_at}>
              {(props) => (
                <input
                  {...props}
                  name="ends_at"
                  type="datetime-local"
                  value={values.ends_at}
                  onChange={(e) => set("ends_at", e.target.value)}
                />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Lieu</legend>
          <p className="quiet">
            Indiquez la ville : les coordonnées nécessaires au rapprochement
            sont retrouvées automatiquement.
          </p>
          <Field name="address" label="Adresse (facultatif)">
            {(props) => (
              <input
                {...props}
                name="address"
                maxLength={250}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
            )}
          </Field>
          <div className="form-grid">
            <Field name="city" label="Ville" error={errors.city}>
              {(props) => (
                <input
                  {...props}
                  name="city"
                  maxLength={120}
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              )}
            </Field>
            <Field
              name="postal_code"
              label="Code postal"
              error={errors.postal_code}
            >
              {(props) => (
                <input
                  {...props}
                  name="postal_code"
                  inputMode="numeric"
                  maxLength={5}
                  value={values.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Profil recherché</legend>
          <div className="form-grid">
            <Field
              name="headcount"
              label="Nombre de personnes"
              error={errors.headcount}
            >
              {(props) => (
                <input
                  {...props}
                  name="headcount"
                  type="number"
                  min={1}
                  max={50}
                  value={values.headcount}
                  onChange={(e) => set("headcount", e.target.value)}
                />
              )}
            </Field>
            <Field
              name="min_years_experience"
              label="Expérience minimale en années (facultatif)"
            >
              {(props) => (
                <input
                  {...props}
                  name="min_years_experience"
                  type="number"
                  min={0}
                  max={60}
                  step="0.5"
                  value={values.min_years_experience}
                  onChange={(e) => set("min_years_experience", e.target.value)}
                />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Compétences</legend>
          <p className="quiet">
            Une compétence <strong>obligatoire</strong> écarte les profils qui
            ne l’ont pas. Une compétence <strong>souhaitée</strong> les fait
            remonter sans les exclure.
          </p>
          <SkillPicker
            skills={skills}
            value={values.skills}
            onChange={(next) => set("skills", next)}
          />
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Rémunération</legend>
          <p className="quiet">
            Facultative, mais elle doit être complète : un montant va toujours
            avec son unité.
          </p>
          <div className="form-grid">
            <Field
              name="pay_amount"
              label="Montant en euros"
              error={errors.pay_amount}
            >
              {(props) => (
                <input
                  {...props}
                  name="pay_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.pay_amount}
                  onChange={(e) => set("pay_amount", e.target.value)}
                />
              )}
            </Field>
            <Field name="pay_unit" label="Unité">
              {(props) => (
                <select
                  {...props}
                  name="pay_unit"
                  value={values.pay_unit}
                  onChange={(e) => set("pay_unit", e.target.value)}
                >
                  <option value="">Non précisée</option>
                  {payUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </fieldset>

        {note && (
          <p className="form-success" role="status">
            {note}
          </p>
        )}

        <div className="form-actions">
          <Link
            className="secondary-button"
            to={editing ? "/company/missions/" + id : "/company/missions"}
          >
            Annuler
          </Link>
          <button className="button" disabled={busy}>
            {busy
              ? "Enregistrement…"
              : editing
                ? "Enregistrer les modifications"
                : "Enregistrer le brouillon"}
          </button>
        </div>
      </form>
    </section>
  );
}
