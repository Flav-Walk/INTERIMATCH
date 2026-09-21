import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSupabase } from "../services/supabase";
import { destination, errorMessage, type User } from "../services/session";
import { useAuth } from "../hooks/useAuth";
let completed: Promise<User> | null = null;
let exchange: Promise<string> | null = null;
function providerToken() {
  if (!exchange)
    exchange = (async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.has("error"))
        throw new Error("La connexion Google a été annulée ou refusée.");
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Google non configuré.");
      const code = url.searchParams.get("code");
      if (!code)
        throw new Error("Le retour Google ne contient pas de code valide.");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      window.history.replaceState(null, "", "/auth/callback");
      if (error || !data.session)
        throw new Error("Le retour Google a expiré. Recommencez la connexion.");
      return data.session.access_token;
    })();
  return exchange;
}
export function Callback() {
  const auth = useAuth(),
    navigate = useNavigate(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    completed ??= providerToken().then((jwt) => auth.google(jwt));
    void completed
      .then((user) => {
        if (active) navigate(destination(user), { replace: true });
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="login">
      <h1>Connexion Google</h1>
      {error ? (
        <>
          <p role="alert" className="form-error">
            {error}
          </p>
          <Link
            to="/login"
            onClick={() => {
              exchange = null;
              completed = null;
            }}
          >
            Revenir à la connexion
          </Link>
        </>
      ) : (
        <p role="status">Vérification de votre connexion…</p>
      )}
    </section>
  );
}
