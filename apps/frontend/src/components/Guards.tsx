import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination, type Role } from "../services/session";

/**
 * Confort d'interface uniquement : l'autorisation réelle est refaite par le backend
 * à chaque requête, qui relit le rôle en base et répond 403 pour un espace étranger.
 */
export function ProtectedRoute({ role }: { role?: Role }) {
  usePageSeo({ robots: "noindex,nofollow" });
  const { user, loading, loadError } = useAuth();
  if (loading) return <p role="status">Chargement de votre espace…</p>;
  if (loadError)
    return (
      <section className="login">
        <h1>Connexion interrompue</h1>
        <p>Le service ne répond pas. Vos données n’ont pas été modifiées.</p>
        <button onClick={() => window.location.reload()}>Réessayer</button>
      </section>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role)
    return <Navigate to={destination(user)} replace />;
  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading } = useAuth();
  // On retient si la personne est arrivée DÉCONNECTÉE sur la page publique.
  // - Déjà connectée en arrivant : on la renvoie vers son espace, comme avant.
  // - Connectée À L'INSTANT depuis la page de connexion : on ne redirige pas
  //   ici. C'est la page qui navigue, après avoir joué son animation
  //   (coche validée puis fondu). Sinon la redirection couperait l'animation.
  const [arrivedLoggedOut, setArrivedLoggedOut] = useState<boolean | null>(
    null,
  );
  if (!loading && arrivedLoggedOut === null) setArrivedLoggedOut(!user);
  if (loading) return <p role="status">Chargement…</p>;
  return user && !arrivedLoggedOut ? (
    <Navigate to={destination(user)} replace />
  ) : (
    <Outlet />
  );
}
