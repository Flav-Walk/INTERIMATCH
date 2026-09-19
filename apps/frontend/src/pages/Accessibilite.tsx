import { usePageSeo } from "../hooks/usePageSeo";

export function Accessibilite() {
  usePageSeo({
    title: "Déclaration d’accessibilité · InteriMatch",
    description:
      "Déclaration d’accessibilité et conformité numérique de la plateforme InteriMatch.",
    robots: "index,follow",
  });
  return (
    <article className="legal-page">
      <div className="eyeline">Conformité numérique</div>
      <h1>Déclaration d’accessibilité</h1>

      <div className="legal-notice-box">
        <strong>Statut de conformité :</strong> Accessibilité : non conforme.
      </div>

      <section>
        <h2>1. Engagement d’accessibilité</h2>
        <p>
          InteriMatch s’engage à rendre son service numérique accessible
          conformément à l’article 47 de la loi n° 2005-102 du 11 février 2005.
        </p>
        <p>
          À cette date, aucun audit formel de conformité selon les critères du
          RGAA (Référentiel Général d’Amélioration de l’Accessibilité) n’a été
          réalisé sur la plateforme.
        </p>
        <p>
          En l’absence d’audit complet permettant d’en évaluer la conformité, le
          site est déclaré : <strong>Accessibilité : non conforme</strong>.
        </p>
      </section>

      <section>
        <h2>2. Dispositions techniques prises en compte</h2>
        <p>
          Dès la phase de développement du prototype, des principes de base de
          l’accessibilité numérique ont été intégrés à l’interface :
        </p>
        <ul>
          <li>
            <strong>Structure sémantique du HTML :</strong> utilisation des
            balises structurelles (<code>header</code>, <code>nav</code>,{" "}
            <code>main</code>, <code>footer</code>, <code>section</code>,{" "}
            <code>article</code>) et respect d’une hiérarchie de titres cohérente
            (<code>h1</code>, <code>h2</code>, <code>h3</code>) ;
          </li>
          <li>
            <strong>Navigation au clavier et repères :</strong> présence d’un
            lien d’évitement (« Aller au contenu ») accessible dès le premier
            point de tabulation pour contourner l’en-tête ;
          </li>
          <li>
            <strong>Indicateurs de focus visibles :</strong> conservation d’un
            contour de focus contrasté sur les éléments interactifs (liens,
            boutons, champs) lors de la navigation au clavier ;
          </li>
          <li>
            <strong>Formulaires accessibles :</strong> association systématique
            de labels explicites aux champs de saisie et signalement des messages
            d’erreur via le rôle ARIA <code>role="alert"</code> ;
          </li>
          <li>
            <strong>Respect des préférences utilisateur :</strong> prise en
            compte du paramètre système <code>prefers-reduced-motion</code> pour
            désactiver les transitions et défilements animés non désirés.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Signalement et contact</h2>
        <p>
          Si vous rencontrez une difficulté pour accéder à un contenu ou à une
          fonctionnalité de l’application, ou si vous constatez un défaut
          d’accessibilité, vous pouvez nous le signaler :
        </p>
        <ul>
          <li>
            <strong>Contact accessibilité :</strong>{" "}
            <span className="legal-placeholder">[Information à compléter]</span>
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Voies de recours</h2>
        <p>
          Si vous constatez un défaut d’accessibilité vous empêchant d’accéder à
          un contenu ou une fonctionnalité du site, que vous nous le signalez et
          que vous ne parvenez pas à obtenir une réponse rapide et satisfaisante,
          vous êtes en droit de faire parvenir vos doléances ou une demande de
          saisine au Défenseur des droits :
        </p>
        <ul>
          <li>
            Écrire un message au Défenseur des droits :{" "}
            <a
              href="https://formulaire.defenseurdesdroits.fr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              formulaire en ligne du Défenseur des droits
            </a>{" "}
            ;
          </li>
          <li>
            Contacter le délégué du Défenseur des droits dans votre région :{" "}
            <a
              href="https://www.defenseurdesdroits.fr/carte-des-delegues"
              target="_blank"
              rel="noopener noreferrer"
            >
              carte des délégués
            </a>{" "}
            ;
          </li>
          <li>
            Envoyer un courrier par la poste (gratuit, sans affranchissement) à :
            <br />
            <em>
              Défenseur des droits — Libre réponse 71120 — 75342 Paris CEDEX 07
            </em>
            .
          </li>
        </ul>
      </section>
    </article>
  );
}
