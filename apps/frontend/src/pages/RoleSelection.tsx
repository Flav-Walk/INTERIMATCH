import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { BriefcaseBusiness, Users, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api, errorMessage } from "../services/session";
export function RoleSelection() {
  const auth = useAuth(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (auth.user?.role)
    return <Navigate to={"/onboarding/" + auth.user.role} replace />;
  async function choose(role: "worker" | "company") {
    setBusy(true);
    setError("");
    try {
      await api("/me/role", { method: "PUT", body: JSON.stringify({ role }) });
      await auth.reload();
      navigate("/onboarding/" + role);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="onboarding">
      <span className="eyeline">Bienvenue chez InteriMatch</span>
      <h1>Quel est votre prochain objectif ?</h1>
      <p>
        Choisissez votre espace professionnel. Ce choix détermine votre
        parcours.
      </p>
      <div className="role-grid">
        <button
          className="role-card"
          onClick={() => void choose("worker")}
          disabled={busy}
        >
          <BriefcaseBusiness />
          <strong>Je cherche des missions</strong>
          <span>
            Intérimaire · Faites connaître votre métier, vos compétences et vos
            disponibilités.
          </span>
          <ArrowRight />
        </button>
        <button
          className="role-card"
          onClick={() => void choose("company")}
          disabled={busy}
        >
          <Users />
          <strong>Je cherche des talents</strong>
          <span>
            Entreprise · Présentez votre établissement et préparez vos
            recrutements.
          </span>
          <ArrowRight />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
