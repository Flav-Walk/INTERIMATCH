import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  api,
  errorMessage,
  destination,
  type ReferenceValue,
} from "../services/session";

/**
 * Profil de l'établissement. L'espace entreprise sera repris dans son propre lot :
 * ce formulaire conserve pour l'instant le fonctionnement en une seule fois.
 */
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

export function ProfileForm() {
  const auth = useAuth(),
    navigate = useNavigate();
  const p = auth.user?.profile ?? {};
  const [sectors, setSectors] = useState<ReferenceValue[]>([]),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ sectors: ReferenceValue[] }>("/reference")
      .then((r) => setSectors(r.sectors))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const str = (n: string) => String(f.get(n) ?? "");
    const num = (n: string) => Number(f.get(n));
    try {
      await api("/onboarding/company", {
        method: "PUT",
        body: JSON.stringify({
          first_name: str("first_name"),
          last_name: str("last_name"),
          city: str("city"),
          postal_code: str("postal_code"),
          latitude: num("latitude"),
          longitude: num("longitude"),
          legal_name: str("legal_name"),
          establishment_name: str("establishment_name"),
          sector: str("sector"),
          address: str("address"),
          phone: str("phone"),
          description: str("description"),
        }),
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
      <span className="eyeline">Votre espace Entreprise</span>
      <h1>Présentons votre établissement.</h1>
      <p>
        Ces informations aideront les intérimaires à connaître votre
        établissement.
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <fieldset>
          <legend>Le contact de votre établissement</legend>
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
            defaultValue={p.phone ?? ""}
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
        <fieldset>
          <legend>Localisation de l’établissement</legend>
          <div className="form-grid">
            <Field label="Ville" name="city" defaultValue={p.city ?? ""} />
            <Field
              label="Code postal"
              name="postal_code"
              maxLength={5}
              defaultValue={p.postal_code ?? ""}
            />
            <Field
              label="Latitude"
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              defaultValue={p.latitude ?? ""}
            />
            <Field
              label="Longitude"
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              defaultValue={p.longitude ?? ""}
            />
          </div>
          <p className="quiet">
            Indiquez les coordonnées du centre de votre ville ou de votre
            établissement. Exemple Lyon : latitude 45.75, longitude 4.85.
          </p>
        </fieldset>
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
