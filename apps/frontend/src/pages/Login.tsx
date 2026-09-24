import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination, errorMessage } from "../services/session";
import { getSupabase, supabaseConfigured } from "../services/supabase";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { Logo } from "../components/Logo";
import { Check } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../services/password";
export function Login({ register = false }: { register?: boolean }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [register]);

  usePageSeo({
    title: register
      ? "Créer un compte · InteriMatch"
      : "Connexion · InteriMatch",
    description: register
      ? "Créer votre compte professionnel sur la plateforme InteriMatch."
      : "Connexion à votre espace professionnel InteriMatch.",
    robots: "noindex,nofollow",
  });
  const auth = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    // Contrôlés : l'indicateur de force a besoin de la valeur saisie, et la
    // bascule afficher/masquer ne doit jamais la reconstruire.
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const meterId = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(event.currentTarget);
    try {
      if (register && password !== confirm)
        throw new Error("Les mots de passe ne correspondent pas.");
      const user = await auth.login(String(f.get("email")), password, register);
      navigate(destination(user), { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Google n’est pas configuré.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/callback" },
      });
      if (error)
        throw new Error(
          "La connexion Google n’est pas disponible. Utilisez email et mot de passe.",
        );
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="auth-grid">
      <section className="auth-story">
        <Logo variant="light" className="auth-story__logo" />
        <div className="auth-story__copy">
          <span className="auth-story__eyeline">
            Hôtellerie · restauration
          </span>
          <h1>
            {register
              ? "Faites entrer les bonnes missions dans votre parcours."
              : "Votre prochain service commence ici."}
          </h1>
          <p>
            Compétences, disponibilités et besoins se rencontrent dans un même
            espace professionnel.
          </p>
        </div>
        {/* Repères tirés des promesses de l'accueil : aucun chiffre, aucune
            donnée inventée. Décor lu une seule fois : la liste reste du vrai
            texte, seules les coches sont masquées. */}
        <ul className="auth-story__points">
          <li>
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            Des missions dans votre zone
          </li>
          <li>
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            Un rapprochement expliqué
          </li>
          <li>
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            Le suivi de chaque candidature
          </li>
        </ul>
        <p className="auth-story__signature" aria-hidden="true">
          Les bonnes personnes, au bon moment.
        </p>
      </section>
      <section
        className="form-panel"
        aria-labelledby={register ? "register-title" : "login-title"}
      >
        <p className="form-panel__eyeline">
          {register ? "Bienvenue" : "Bon retour parmi nous"}
        </p>
        <h2 id={register ? "register-title" : "login-title"}>
          {register ? "Créer mon compte" : "Me connecter"}
        </h2>
        <p>
          {register
            ? "Créez votre profil intérimaire. Les accès établissement sont attribués selon le dispositif prévu par InteriMatch."
            : "Retrouvez votre profil et préparez vos prochains services."}
        </p>
        {/* Sans configuration Google, ce bouton ne menait qu'à un message
            d'erreur au clic. Mieux vaut ne pas proposer ce qui n'existe pas. */}
        {supabaseConfigured && (
          <>
            <button
              className="secondary-button google-button"
              onClick={() => void google()}
              disabled={busy}
            >
              Continuer avec Google
            </button>
            <div className="divider">ou avec votre email</div>
          </>
        )}
        <form onSubmit={(e) => void submit(e)}>
          <label htmlFor="login-email">
            Email
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <PasswordField
            name="password"
            label="Mot de passe"
            toggleFor="le mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? MIN_PASSWORD_LENGTH : 1}
            describedBy={register ? meterId : undefined}
          />
          {register && (
            <>
              <PasswordStrength password={password} id={meterId} />
              <PasswordField
                name="confirm"
                label="Confirmer le mot de passe"
                toggleFor="la confirmation du mot de passe"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy}>
            {busy
              ? "Veuillez patienter…"
              : register
                ? "Créer mon compte"
                : "Me connecter"}
          </button>
          {register && (
            <p className="legal-notice">
              En créant un compte, vous reconnaissez avoir pris connaissance de
              notre{" "}
              <Link to="/politique-confidentialite">
                Politique de confidentialité
              </Link>{" "}
              et de nos <Link to="/mentions-legales">Mentions légales</Link>.
            </p>
          )}
        </form>
        <p className="form-switch">
          {register ? "Déjà inscrit ?" : "Pas encore de compte ?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Se connecter" : "Créer un compte"}
          </Link>
        </p>
      </section>
    </div>
  );
}
