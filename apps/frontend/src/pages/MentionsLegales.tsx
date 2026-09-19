import { Link } from "react-router-dom";
import { usePageSeo } from "../hooks/usePageSeo";

export function MentionsLegales() {
  usePageSeo({
    title: "Mentions légales · InteriMatch",
    description:
      "Mentions légales et informations éditoriales de la plateforme InteriMatch.",
    robots: "index,follow",
  });
  return (
    <article className="legal-page">
      <div className="eyeline">Informations légales</div>
      <h1>Mentions légales</h1>

      <div className="legal-notice-box">
        <strong>Information :</strong> Ce service est un prototype applicatif
        dédié au secteur de l’hôtellerie et de la restauration. Les informations
        administratives et juridiques ci-dessous sont en cours de validation et
        signalées par la mention <em>[Information à compléter]</em>.
      </div>

      <section>
        <h2>1. Éditeur de la plateforme</h2>
        <p>
          La plateforme <strong>InteriMatch</strong> est éditée par :
        </p>
        <ul>
          <li>
            <strong>Raison sociale / Dénomination :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
          <li>
            <strong>Forme juridique :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
          <li>
            <strong>Numéro SIRET / RCS :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
          <li>
            <strong>Adresse du siège :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
          <li>
            <strong>Directeur de la publication :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
          <li>
            <strong>Contact :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Hébergement</h2>
        <p>
          L’infrastructure technique de la plateforme (application web, API et
          base de données) est hébergée par des prestataires d’hébergement
          infonuagique (notamment Render et Supabase) :
        </p>
        <ul>
          <li>
            <strong>Hébergement applicatif (backend / API) :</strong>{" "}
            <span className="legal-placeholder">
              [Information juridique précise sur l’hébergeur à compléter]
            </span>
          </li>
          <li>
            <strong>Hébergement base de données et authentification :</strong>{" "}
            <span className="legal-placeholder">
              [Information juridique précise sur l’hébergeur à compléter]
            </span>
          </li>
          <li>
            <strong>Domaine et diffusion web :</strong>{" "}
            <span className="legal-placeholder">
              [Domaine définitif à confirmer]
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          L’ensemble des éléments constituant la plateforme InteriMatch
          (notamment l’ergonomie, les composants graphiques, les textes, les
          fonctionnalités logicielles, les logos et la marque) est protégé par le
          droit d’auteur et les dispositions relatives à la propriété
          intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, adaptation ou exploitation
          partielle ou totale de ces contenus, par quelque procédé que ce soit,
          sans autorisation préalable expresse de l’éditeur, est interdite.
        </p>
      </section>

      <section>
        <h2>4. Données personnelles et cookies</h2>
        <p>
          Le traitement des données à caractère personnel réalisé dans le cadre
          de l’utilisation de la plateforme est soumis au Règlement Général sur
          la Protection des Données (RGPD).
        </p>
        <p>
          Pour prendre connaissance des modalités de collecte, d’utilisation, de
          conservation des données et de l’exercice de vos droits, veuillez
          consulter notre{" "}
          <Link to="/politique-confidentialite">
            Politique de confidentialité
          </Link>
          .
        </p>
        <p>
          <strong>Cookies et traceurs :</strong> La plateforme utilise
          exclusivement les cookies techniques strictement nécessaires au
          fonctionnement de la session d’authentification sécurisée (cookie
          HttpOnly <code>im_refresh</code>). Aucun cookie tiers de profilage, de
          suivi publicitaire ou d’analyse d’audience n’est déposé lors de votre
          navigation.
        </p>
      </section>

      <section>
        <h2>5. Contact</h2>
        <p>
          Pour toute question concernant l’utilisation de la plateforme ou les
          présentes mentions légales, vous pouvez adresser votre demande à :{" "}
          <span className="legal-placeholder">[Information à compléter]</span>.
        </p>
      </section>
    </article>
  );
}
