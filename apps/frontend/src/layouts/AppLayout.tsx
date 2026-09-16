import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { destination, errorMessage } from "../services/session";
export function AppLayout() {
  const auth = useAuth(),
    navigate = useNavigate(),
    [error, setError] = useState("");
  async function logout() {
    try {
      await auth.logout();
      navigate("/login");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <a className="skip" href="#content">
        Aller au contenu
      </a>
      <header className="site-header">
        <NavLink className="brand" to="/">
          <Sprout aria-hidden="true" />
          InteriMatch
        </NavLink>
        {auth.user ? (
          <>
            <nav aria-label="Navigation principale">
              <NavLink to={destination(auth.user)}>Mon espace</NavLink>
              {auth.user.onboarding_completed && (
                <NavLink to={"/" + auth.user.role + "/profile"}>
                  Mon profil
                </NavLink>
              )}
            </nav>
            <button
              className="account-link text-button"
              onClick={() => void logout()}
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <nav className="account-link" aria-label="Compte">
            <NavLink to="/login">Connexion</NavLink>
            <NavLink to="/register">Créer un compte</NavLink>
          </nav>
        )}
      </header>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <main id="content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span className="brand">
          <Sprout size={19} aria-hidden="true" />
          InteriMatch
        </span>
        <span>Les talents d’aujourd’hui, vos réussites de demain.</span>
        <span>Prototype · Hôtellerie & restauration</span>
      </footer>
    </>
  );
}
