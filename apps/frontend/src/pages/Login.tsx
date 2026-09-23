import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
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
 * 4. Connexion réussie : la carte entière s'efface en douceur, puis on
 *    navigue vers l'espace de l'utilisateur.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

const cascade: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE },
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // État du bouton d'envoi, et « sortie en cours » après la connexion.
    [submitState, setSubmitState] = useState<SubmitState>("idle"),
    [leaving, setLeaving] = useState(false),
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
      // On laisse le temps de voir la coche, puis la carte s'efface avant
      // de changer de page. Sans animation : navigation immédiate.
      if (!reduceMotion) {
        setSubmitState("success");
        await wait(650);
        setLeaving(true);
        await wait(320);
      }
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
    <motion.div
      className="auth-grid"
      animate={
        leaving
          ? { opacity: 0, scale: 0.985, filter: "blur(6px)" }
          : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      transition={{ duration: 0.32, ease: EASE }}
    >
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
