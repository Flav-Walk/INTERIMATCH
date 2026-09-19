import { usePageSeo } from "../hooks/usePageSeo";

export function PolitiqueConfidentialite() {
  usePageSeo({
    title: "Politique de confidentialité · InteriMatch",
    description:
      "Politique de confidentialité et protection des données personnelles sur InteriMatch (RGPD).",
    robots: "index,follow",
  });
  return (
    <article className="legal-page">
      <div className="eyeline">Protection des données personnelles</div>
      <h1>Politique de confidentialité</h1>

      <div className="legal-notice-box">
        <strong>Information :</strong> La présente politique décrit les
        traitements de données personnelles réellement mis en œuvre au sein du
        prototype InteriMatch. Les informations juridiques administratives
        restant à valider sont identifiées par la mention{" "}
        <em>[Information à compléter]</em>.
      </div>

      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des données personnelles collectées sur la
          plateforme InteriMatch est :
        </p>
        <ul>
          <li>
            <strong>Identité / Organisme :</strong>{" "}
            <span className="legal-placeholder">
              [Responsable du traitement à compléter]
            </span>
          </li>
          <li>
            <strong>Contact pour les données personnelles :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Données collectées et traitements réellement opérés</h2>
        <p>
          Dans le cadre du fonctionnement de l’application, les catégories de
          données suivantes sont collectées et traitées :
        </p>

        <h3>A. Données de compte et d’authentification</h3>
        <ul>
          <li>
            Adresse email et mot de passe (chiffré via le service Supabase Auth) ;
          </li>
          <li>
            Identifiant unique utilisateur (UUID) et rôle applicatif attribué
            (intérimaire ou entreprise) ;
          </li>
          <li>
            Progression de la visite guidée d’accueil (indicateur technique de
            version).
          </li>
        </ul>

        <h3>B. Profil Intérimaire (Candidat)</h3>
        <ul>
          <li>Nom et prénom ;</li>
          <li>Numéro de téléphone de contact (si renseigné) ;</li>
          <li>
            Localisation de référence : commune, code postal et coordonnées
            géographiques (latitude et longitude) déterminées via l’API publique
            de géocodage <code>api-adresse.data.gouv.fr</code> ;
          </li>
          <li>Rayon géographique de mobilité (en kilomètres) ;</li>
          <li>
            Compétences professionnelles sélectionnées dans le référentiel métier ;
          </li>
          <li>
            Expériences professionnelles déclarées (intitulé, établissement,
            dates) ;
          </li>
          <li>
            Disponibilités hebdomadaires par créneau (matin, après-midi, soir) ;
          </li>
          <li>
            Certifications professionnelles (titre, organisme, date d’obtention).
          </li>
        </ul>

        <h3>C. Profil Entreprise (Établissement)</h3>
        <ul>
          <li>Raison sociale et nom de l’établissement ;</li>
          <li>Secteur d’activité (hôtellerie, restauration, etc.) ;</li>
          <li>
            Adresse postale, commune, code postal et coordonnées géographiques
            associées ;
          </li>
          <li>Numéro de téléphone de contact ;</li>
          <li>Description de l’établissement.</li>
        </ul>

        <h3>D. Missions et suivi des candidatures</h3>
        <ul>
          <li>
            Offres de mission publiées par les entreprises (intitulé, secteur,
            dates, horaires, compétences requises, localisation) ;
          </li>
          <li>
            Statut des propositions de mission et des candidatures associées
            (mise en relation, acceptation, refus).
          </li>
        </ul>

        <h3>E. Données de session et cookies techniques</h3>
        <p>
          L’application utilise un jeton d’accès temporaire (Bearer) conservé en
          mémoire vive dans le navigateur (aucun stockage du jeton de session
          dans le <code>localStorage</code>). La continuité de session repose sur
          un cookie d’authentification <code>im_refresh</code> émis par le
          serveur, doté de l’attribut <code>HttpOnly</code>. Aucun cookie tiers
          publicitaire ou traceur n’est employé.
        </p>
      </section>

      <section>
        <h2>3. Finalités et bases légales des traitements</h2>
        <p>
          Les traitements de données sont mis en œuvre pour les finalités
          suivantes :
        </p>
        <ul>
          <li>
            <strong>Création et gestion des comptes utilisateurs :</strong>{" "}
            authentification sécurisée, attribution des accès aux espaces
            intérimaire ou entreprise (exécution des conditions d’utilisation).
          </li>
          <li>
            <strong>
              Mise en relation professionnelle et calcul d’adéquation (matching) :
            </strong>{" "}
            évaluation algorithmique de la pertinence entre les compétences,
            disponibilités et la proximité géographique des intérimaires et les
            besoins exprimés dans les missions.
          </li>
          <li>
            <strong>Gestion et suivi des missions et candidatures :</strong> mise
            à disposition des profils pertinents aux établissements recruteurs
            dans le cadre strict d’une mission.
          </li>
          <li>
            <strong>Notifications de suivi de parcours :</strong> transmission
            d’événements applicatifs (via webhook ou email transactionnel lorsque
            activé).
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Destinataires des données et sous-traitants</h2>
        <p>Les données sont accessibles exclusivement :</p>
        <ul>
          <li>
            Aux établissements recruteurs, pour les profils d’intérimaires
            pertinents mis en relation dans le cadre d’une recherche de mission ;
          </li>
          <li>
            Aux prestataires techniques sous-traitants indispensables au
            fonctionnement de l’infrastructure :
            <ul>
              <li>
                <strong>Supabase :</strong> gestion de l’authentification et
                hébergement de la base de données PostgreSQL ;
              </li>
              <li>
                <strong>Render :</strong> hébergement du serveur d’application
                (backend) ;
              </li>
              <li>
                <strong>api-adresse.data.gouv.fr :</strong> service public
                français de géocodage (uniquement nom de commune et code postal
                transmis pour le positionnement géographique) ;
              </li>
              <li>
                <strong>Brevo / n8n :</strong> envoi d’emails transactionnels et
                orchestration d’événements applicatifs (le cas échéant).
              </li>
            </ul>
          </li>
          <li>
            <span className="legal-placeholder">
              [Informations juridiques précises sur les sous-traitants à
              compléter]
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Durées de conservation des données</h2>
        <p>
          <span className="legal-placeholder">
            [Durées de conservation à définir et valider]
          </span>
        </p>
        <p>
          <strong>Précision technique :</strong> L’application prototype ne met
          pas en œuvre de purge ou d’effacement automatique programmé des
          comptes ou des données de profil. Les données demeurent enregistrées
          jusqu’à demande explicite de suppression formulée par l’utilisateur.
        </p>
      </section>

      <section>
        <h2>6. Vos droits et modalités d’exercice</h2>
        <p>
          Conformément aux dispositions des articles 15 à 21 du RGPD, vous
          disposez des droits suivants concernant vos données personnelles :
        </p>
        <ul>
          <li>Droit d’accès à vos données ;</li>
          <li>Droit de rectification des informations inexactes ;</li>
          <li>Droit à l’effacement (« droit à l’oubli ») ;</li>
          <li>Droit à la limitation du traitement ;</li>
          <li>Droit d’opposition au traitement.</li>
        </ul>
        <div className="legal-notice-box">
          <strong>Fonctionnalités du prototype :</strong> L’application ne
          dispose pas à ce stade d’une interface d’export automatisé de données
          au format portable, ni d’un bouton de suppression autonome du compte
          en libre-service. L’exercice de vos droits s’effectue donc sur demande
          directe.
        </div>
        <p>
          Pour exercer vos droits ou demander la suppression de votre compte,
          vous pouvez contacter :{" "}
          <span className="legal-placeholder">
            [Contact pour l’exercice des droits à renseigner]
          </span>
          .
        </p>
        <p>
          Si vous estimez, après nous avoir contactés, que vos droits ne sont pas
          respectés, vous pouvez adresser une réclamation auprès de la{" "}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
          >
            CNIL (Commission Nationale de l’Informatique et des Libertés)
            <span className="sr-only"> (nouvelle fenêtre)</span>
          </a>
          .
        </p>
      </section>

      <section>
        <h2>7. Sécurité des données</h2>
        <p>
          Des mesures techniques et organisationnelles sont mises en œuvre pour
          préserver la sécurité et la confidentialité des données : mots de
          passe chiffrés, jeton d’accès volatile en mémoire, cookie de
          rafraîchissement protégé par l’attribut HttpOnly, échanges sécurisés
          via protocole HTTPS, et contrôle d’accès strict aux endpoints
          applicatifs selon le rôle de l’utilisateur.
        </p>
      </section>
    </article>
  );
}
