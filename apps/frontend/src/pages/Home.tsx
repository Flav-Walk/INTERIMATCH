import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { destination } from "../services/session";
export function Home() {
  const { user } = useAuth();
  return (
    <section className="welcome public-welcome">
      <span>Hôtellerie & restauration</span>
      <h1>Les bonnes personnes, au bon moment.</h1>
      <p>
        Un espace pour les professionnels qui font vivre l’hôtellerie et la
        restauration. Présentez votre talent ou votre établissement, préparez la
        suite.
      </p>
      <Link className="button" to={user ? destination(user) : "/register"}>
        {user ? "Retrouver mon espace" : "Rejoindre InteriMatch"}
      </Link>
      {!user && (
        <Link className="home-login" to="/login">
          J’ai déjà un compte
        </Link>
      )}
    </section>
  );
}
