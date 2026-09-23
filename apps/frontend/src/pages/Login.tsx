import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cascade, rise } from "../lib/motion";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination, errorMessage } from "../services/session";
import { getSupabase, supabaseConfigured } from "../services/supabase";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { Logo } from "../components/Logo";
import { PhotoBackdrop } from "../components/PhotoBackdrop";
import { SubmitButton, type SubmitState } from "../components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "../services/password";
/*
 * Animations de la connexion (Motion) :
 * 1. Le texte du panneau photo puis le formulaire arrivent en cascade
 *    (stagger), chaque bloc sortant d'un léger flou.
 * 2. Le bouton passe par 3 états : normal → chargement → coche validée.
 * 3. Une erreur arrive en secouant la ligne, pour attirer l'œil.
 * 4. Connexion réussie : le bouton confirme brièvement l'action et la
 *    navigation reste immédiate.
 */

/** Logo « G » de Google, aux couleurs officielles, pour le bouton. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

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
  const reduceMotion = useReducedMotion();
  const [error, setError] = useState(""),
    // Compteur d'erreurs : change la clé de l'alerte pour rejouer la
    // secousse même si le message est identique.
    [errorCount, setErrorCount] = useState(0),
    [busy, setBusy] = useState(false),
    // État du bouton d'envoi.
    [submitState, setSubmitState] = useState<SubmitState>("idle"),
    // Contrôlés : l'indicateur de force a besoin de la valeur saisie, et la
    // bascule afficher/masquer ne doit jamais la reconstruire.
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const meterId = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    setSubmitState("busy");
    const f = new FormData(event.currentTarget);
    try {
      if (register && password !== confirm)
        throw new Error("Les mots de passe ne correspondent pas.");
      const user = await auth.login(String(f.get("email")), password, register);
      setSubmitState("success");
      navigate(destination(user), { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setErrorCount((n) => n + 1);
      setSubmitState("idle");
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
    <motion.div className="auth-grid">
      <section className="auth-story">
        {/* Photo pleine hauteur, voile sombre en bas sous le texte. Pas de
            parallaxe : ce panneau ne défile pas. */}
        <PhotoBackdrop
          src="/images/hero/connexion.jpg"
          veil="bottom"
          parallax={false}
        />
        <Logo variant="light" className="auth-story__logo" />
        <motion.div
          className="auth-story__copy"
          variants={cascade}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.span className="auth-story__eyeline" variants={rise}>
            Hôtellerie · restauration
          </motion.span>
          <motion.h1 variants={rise}>
            {register
              ? "Faites entrer les bonnes missions dans votre parcours."
              : "Votre prochain service commence ici."}
          </motion.h1>
          <motion.p variants={rise}>
            Compétences, disponibilités et besoins se rencontrent dans un même
            espace professionnel.
          </motion.p>
        </motion.div>
      </section>
      <motion.section
        className="form-panel"
        aria-labelledby={register ? "register-title" : "login-title"}
        variants={cascade}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <motion.p className="form-panel__eyeline" variants={rise}>
          {register ? "Bienvenue" : "Bon retour parmi nous"}
        </motion.p>
        <motion.h2 id={register ? "register-title" : "login-title"} variants={rise}>
          {register ? "Créer mon compte" : "Me connecter"}
        </motion.h2>
        <motion.p variants={rise}>
          {register
            ? "Créez votre profil intérimaire. Les accès établissement sont attribués selon le dispositif prévu par InteriMatch."
            : "Retrouvez votre profil et préparez vos prochains services."}
        </motion.p>
        {/* Connexion Google, toujours affichée. Sans configuration Supabase
            (mode démo, poste local), le bouton est désactivé et une mention
            l'explique : on ne propose pas une action qui finirait en erreur,
            mais l'option reste visible. */}
        <motion.div className="auth-google" variants={rise}>
          <button
            type="button"
            className="secondary-button google-button"
            onClick={() => void google()}
            disabled={busy || !supabaseConfigured}
            aria-describedby={supabaseConfigured ? undefined : "google-note"}
          >
            <GoogleLogo />
            Continuer avec Google
          </button>
          {!supabaseConfigured && (
            <p id="google-note" className="auth-google__note">
              Connexion Google indisponible sur cette version de démonstration.
            </p>
          )}
          <div className="divider">
            <span>ou avec votre email</span>
          </div>
        </motion.div>
        <motion.form onSubmit={(e) => void submit(e)} variants={rise}>
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
          {/* L'erreur arrive en secouant la ligne (x de -8 px à +8 px). */}
          <AnimatePresence>
            {error && (
              <motion.p
                key={errorCount}
                role="alert"
                className="form-error"
                initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <SubmitButton
            state={submitState}
            className="button full"
            busyLabel={register ? "Création du compte…" : "Connexion…"}
            successLabel={register ? "Compte créé" : "Connecté"}
          >
            {register ? "Créer mon compte" : "Me connecter"}
          </SubmitButton>
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
        </motion.form>
        <motion.p className="form-switch" variants={rise}>
          {register ? "Déjà inscrit ?" : "Pas encore de compte ?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Se connecter" : "Créer un compte"}
          </Link>
        </motion.p>
      </motion.section>
    </motion.div>
  );
}
