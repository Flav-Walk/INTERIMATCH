import { Link } from "react-router-dom";
import { BriefcaseBusiness, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

/**
 * Destination réelle des propositions et des offres. Le contenu viendra des lots
 * Missions et Matching ; l'écran annonce explicitement ce qui n'existe pas encore
 * plutôt que d'afficher des données fictives.
 */
export function Missions() {
  const { user } = useAuth();
  if (!user || user.role === "admin") return null;
  const worker = user.role === "worker";
  const steps = worker
    ? [
        "Compléter votre profil et vos disponibilités",
        "Recevoir les missions compatibles avec votre zone",
        "Accepter ou refuser chaque proposition",
      ]
    : [
        "Décrire le poste, les horaires et les compétences attendues",
        "Consulter les profils compatibles et leur score",
        "Choisir et attribuer la mission",
      ];

  return (
    <section className="page">
      <span className="eyeline">
        Espace {worker ? "intérimaire" : "entreprise"}
      </span>
      <h1>{worker ? "Vos propositions de mission" : "Vos missions"}</h1>
      <p>
        {worker
          ? "Vous retrouverez ici chaque mission proposée, avec l’explication du score qui l’a retenue pour vous."
          : "Vous créerez ici vos missions et suivrez les réponses des candidats."}
      </p>

      <div className="empty">
        <BriefcaseBusiness aria-hidden="true" />
        <h2>
          {worker
            ? "Aucune mission proposée pour le moment"
            : "Aucune mission créée pour le moment"}
        </h2>
        <p>
          {worker
            ? "La recherche de missions sera disponible au prochain lot. En attendant, un profil complet est ce qui déterminera les propositions que vous recevrez."
            : "La création de missions sera disponible au prochain lot."}
        </p>
        {worker ? (
          <Link className="button" to="/worker/profile">
            Compléter mon profil
          </Link>
        ) : (
          <button
            className="button"
            disabled
            title="Disponible au prochain lot"
          >
            Créer une mission
          </button>
        )}
      </div>

      <section className="section">
        <h2>Comment cela fonctionnera</h2>
        <ol className="steps-list">
          {steps.map((label) => (
            <li key={label}>
              <Check size={16} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
