import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { destination, type Role } from "../services/session";

/**
 * Confort d'interface uniquement : l'autorisation réelle est refaite par le backend
 * à chaque requête, qui relit le rôle en base et répond 403 pour un espace étranger.
 */
export function ProtectedRoute({ role }: { role?: Role }) {
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
  if (loading) return <p role="status">Chargement…</p>;
  return user ? <Navigate to={destination(user)} replace /> : <Outlet />;
}
