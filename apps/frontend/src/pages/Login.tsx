import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { destination, errorMessage } from "../services/session";
import { supabase } from "../services/supabase";
export function Login({ register = false }: { register?: boolean }) {
  const auth = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(event.currentTarget);
    try {
      if (register && f.get("password") !== f.get("confirm"))
        throw new Error("Les mots de passe ne correspondent pas.");
      const user = await auth.login(
        String(f.get("email")),
        String(f.get("password")),
        register,
      );
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
        <span>Hôtellerie & restauration</span>
        <h1>
          {register
            ? "Votre prochain chapitre commence ici."
            : "Heureux de vous retrouver."}
        </h1>
        <p>
          Les bons talents. Les bonnes missions. Et le plaisir de travailler
          ensemble.
        </p>
        <div className="story-line">
          InteriMatch / Votre espace professionnel
        </div>
      </section>
      <section className="form-panel">
        <h2>{register ? "Créer mon compte" : "Me connecter"}</h2>
        <p>
          {register
            ? "Quelques informations pour commencer. Vous choisirez ensuite votre espace."
            : "Retrouvez votre profil et préparez vos prochains services."}
        </p>
        <button
          className="secondary-button google-button"
          onClick={() => void google()}
          disabled={busy}
        >
          Continuer avec Google
        </button>
        <div className="divider">ou avec votre email</div>
        <form onSubmit={(e) => void submit(e)}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 12 : 1}
              maxLength={128}
              required
            />
          </label>
          {register && (
            <>
              <small>Au moins 12 caractères.</small>
              <label>
                Confirmer le mot de passe
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
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
