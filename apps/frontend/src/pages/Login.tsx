import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination, errorMessage } from "../services/session";
import { getSupabase, supabaseConfigured } from "../services/supabase";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { Logo } from "../components/Logo";
import { MatchyMascot } from "../components/MatchyMascot";
import { DotTexture } from "../components/ui/Texture";
import { MIN_PASSWORD_LENGTH } from "../services/password";

/**
 * Connexion et création de compte.
 *
 * CE QUI N'ALLAIT PAS. Une carte flottante de 1 120 px, centrée dans un vide,
 * avec un coin arrondi de 18 px et une ombre portée. Le panneau de formulaire
 * tenait dans le tiers supérieur et laissait 300 px de blanc en dessous, la
 * mascotte était coupée par le bas du panneau vert, et le bouton principal
 * était orange vif — la seule occurrence de cette couleur dans tout le produit.
 *
 * CE QUI LE REMPLACE. Deux moitiés PLEINE HAUTEUR, sans cadre ni ombre : le
 * récit de marque à gauche, le formulaire à droite, chacun centré dans sa
 * moitié. Une page d'entrée n'a pas à se présenter comme un objet posé sur un
 * fond ; elle EST l'écran.
 *
 * LES TROIS PREUVES à gauche ne sont pas des arguments commerciaux : ce sont
 * les trois choses que le produit fait réellement, et elles sont vérifiables
 * dans le reste de l'interface. Aucun chiffre d'usage, aucun témoignage.
 */

const PROOFS = [
  "Des missions classées sur des critères visibles",
  "Vos disponibilités décident de ce qu'on vous propose",
  "Chaque candidature suivie jusqu'à sa décision",
];

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
    <div className="auth-grid im-page grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
      {/* ── Récit de marque ─────────────────────────────────────────────── */}
      {/*
       * Le récit de marque N'EST PAS MASQUÉ sur mobile, il se compacte.
       * Le masquer ferait disparaître le mot-symbole et Matchy de l'écran
       * d'entrée sur téléphone — c'est-à-dire l'identité, précisément là où un
       * visiteur arrive par un lien. Il devient une bande haute, et retrouve sa
       * colonne pleine hauteur à partir de `lg`.
       */}
      <section className="auth-story relative isolate flex flex-col justify-between gap-8 overflow-hidden bg-forest-deep px-5 py-8 text-white sm:px-8 lg:gap-0 lg:px-10 lg:py-12 xl:px-16">
        <DotTexture className="text-sage/16" gap={22} />

        <Logo variant="light" className="auth-story__logo relative" />

        <div className="auth-story__copy relative max-w-lg">
          <p className="im-eyebrow im-eyebrow--light">
            Hôtellerie · Restauration
          </p>
          <h1 className="mt-4 text-white text-[clamp(1.75rem,1.2rem+1.6vw,2.75rem)]">
            {register
              ? "Faites entrer les bonnes missions dans votre parcours."
              : "Votre prochain service commence ici."}
          </h1>
          <ul className="im-bare mt-6 hidden space-y-3 sm:block lg:mt-8">
            {PROOFS.map((proof) => (
              <li
                key={proof}
                className="flex items-start gap-3 text-[0.9375rem] text-white/72"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-sage"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                {proof}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end gap-4">
          {/* UNE SEULE mascotte, redimensionnée en CSS. En rendre deux — une
              par point de rupture — placerait deux nœuds sous le même sélecteur
              et rendrait toute vérification ambiguë. */}
          <MatchyMascot
            pose={register ? "profile" : "dashboard"}
            size={116}
            className="shrink-0 size-[84px] lg:size-[116px]"
          />
          <p className="hidden pb-2 text-[0.8125rem] text-white/55 leading-relaxed sm:block">
            Matchy vous accompagne, du profil jusqu’à la mission confirmée.
          </p>
        </div>
      </section>

      {/* ── Formulaire ──────────────────────────────────────────────────── */}
      <section
        className="form-panel flex items-center justify-center bg-surface px-5 py-12 sm:px-10"
        aria-labelledby={register ? "register-title" : "login-title"}
      >
        <div className="w-full max-w-sm">
          <p className="form-panel__eyeline im-eyebrow">
            {register ? "Bienvenue" : "Bon retour parmi nous"}
          </p>
          <h2
            id={register ? "register-title" : "login-title"}
            className="mt-3 text-ink text-[clamp(1.5rem,1.3rem+0.8vw,1.875rem)]"
          >
            {register ? "Créer mon compte" : "Me connecter"}
          </h2>
          <p className="mt-3 text-[0.9375rem] text-ink-soft leading-relaxed">
            {register
              ? "Créez votre profil intérimaire. Les accès établissement sont attribués selon le dispositif prévu par InteriMatch."
              : "Retrouvez votre profil et préparez vos prochains services."}
          </p>

          {/* Sans configuration Google, ce bouton ne menait qu'à un message
              d'erreur au clic. Mieux vaut ne pas proposer ce qui n'existe pas. */}
          {supabaseConfigured && (
            <>
              <button
                type="button"
                className="im-btn im-btn--outline google-button mt-7 w-full"
                onClick={() => void google()}
                disabled={busy}
              >
                Continuer avec Google
              </button>
              <p className="im-rule my-6">ou avec votre email</p>
            </>
          )}

          <form className="mt-7 space-y-5" onSubmit={(e) => void submit(e)}>
            <label htmlFor="login-email" className="block">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="vous@exemple.fr"
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

            <button
              className="im-btn im-btn--primary im-btn--lg full w-full"
              disabled={busy}
            >
              {busy
                ? "Veuillez patienter…"
                : register
                  ? "Créer mon compte"
                  : "Me connecter"}
              {!busy && <ArrowRight size={17} aria-hidden="true" />}
            </button>

            {register && (
              <p className="legal-notice text-left text-[0.75rem] text-ink-faint leading-relaxed">
                En créant un compte, vous reconnaissez avoir pris connaissance
                de notre{" "}
                <Link
                  className="text-forest underline underline-offset-2"
                  to="/politique-confidentialite"
                >
                  Politique de confidentialité
                </Link>{" "}
                et de nos{" "}
                <Link
                  className="text-forest underline underline-offset-2"
                  to="/mentions-legales"
                >
                  Mentions légales
                </Link>
                .
              </p>
            )}
          </form>

          <p className="form-switch mt-8 border-rule border-t pt-6 text-[0.875rem] text-ink-soft">
            {register ? "Déjà inscrit ?" : "Pas encore de compte ?"}{" "}
            <Link
              className="font-semibold text-forest underline underline-offset-2"
              to={register ? "/login" : "/register"}
            >
              {register ? "Se connecter" : "Créer un compte"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
