import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileSignature,
  Globe,
  MapPin,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { MatchyMascot } from "../components/MatchyMascot";
import { useAuth } from "../hooks/useAuth";
import { usePageSeo } from "../hooks/usePageSeo";
import { destination } from "../services/session";
import { BeamFrame, DotTexture } from "../components/ui/Texture";
import { Reveal } from "../components/ui/Reveal";
import { Ticker } from "../components/ui/Ticker";
import { StatusMark, CapacityMeter } from "../components/ui/Status";
import { cn } from "../lib/cn";

/**
 * Page d'accueil.
 *
 * CE QU'ELLE ÉTAIT. Un bandeau, puis six blocs « icône + titre + phrase »
 * répartis en deux rangées de trois, puis trois étapes numérotées, puis un
 * appel à l'action. La structure ne disait rien de particulier sur InteriMatch :
 * elle aurait servi à l'identique pour un logiciel de comptabilité.
 *
 * CE QU'ELLE EST. Une page qui montre le produit et explique ce qu'il fait de
 * singulier — le rapprochement. Trois choix de fond :
 *
 * 1. LE BANDEAU MONTRE L'INTERFACE, pas une illustration. Les composants de la
 *    colonne droite sont les VRAIS composants du produit — même carte de
 *    statut, même jauge de postes, même typographie. Ils ne peuvent donc pas
 *    diverger de ce que le visiteur trouvera après inscription, et la page se
 *    met à jour toute seule quand le design system bouge.
 *
 * 2. LE RAPPROCHEMENT EST DÉTAILLÉ AVEC SES VRAIS POIDS. 45 / 25 / 20 / 10 sont
 *    les pondérations réellement appliquées par `matching/score.ts`, et les
 *    cinq critères bloquants sont ceux que le moteur vérifie. Annoncer « un
 *    algorithme intelligent » n'engage à rien ; annoncer les poids engage, et
 *    c'est ce qui rend la promesse crédible.
 *
 * 3. AUCUN CHIFFRE D'USAGE, AUCUN TÉMOIGNAGE, AUCUN PARTENAIRE. Le produit n'a
 *    pas d'utilisateurs à citer. Une page qui en inventerait serait démentie
 *    par la première question posée en soutenance.
 */

/** Pondérations réelles de `matching/score.ts`. Aucune n'est arrondie ici. */
const CRITERIA = [
  {
    weight: 45,
    name: "Compétences souhaitées",
    detail:
      "Celles que l’établissement a désignées comme faisant la différence sur le poste.",
  },
  {
    weight: 25,
    name: "Proximité",
    detail:
      "La distance réelle entre la mission et le rayon de mobilité déclaré.",
  },
  {
    weight: 20,
    name: "Métier",
    detail: "Métier principal, puis métiers secondaires renseignés au profil.",
  },
  {
    weight: 10,
    name: "Expérience",
    detail: "Les années demandées par la mission, face à celles du profil.",
  },
];

/** Critères bloquants de `matching/score.ts` : ils ne se compensent jamais. */
const BLOCKERS = [
  "Recherche en pause",
  "Compétence obligatoire absente",
  "Aucun créneau disponible",
  "Hors du rayon de mobilité",
  "Déjà engagé sur ce créneau",
];

const WORKER_STEPS = [
  {
    title: "Vous décrivez votre situation",
    body: "Métier, compétences, ville, rayon de mobilité et créneaux disponibles. Six informations, enregistrables une par une.",
  },
  {
    title: "Les missions viennent à vous",
    body: "Seules celles qui correspondent apparaissent, avec le score et le détail de ce qui l’explique.",
  },
  {
    title: "Vous suivez chaque candidature",
    body: "De l’envoi à la décision de l’établissement, puis jusqu’au contrat lorsqu’il est émis.",
  },
];

const COMPANY_STEPS = [
  {
    title: "Vous publiez un besoin précis",
    body: "Poste, dates, horaires, lieu, effectif, rémunération, compétences obligatoires et souhaitées.",
  },
  {
    title: "Vous recevez des profils classés",
    body: "Le rapprochement écarte les incompatibles et ordonne les autres, critère par critère.",
  },
  {
    title: "Vous attribuez les postes",
    body: "Chaque acceptation consomme une place et bloque le créneau de la personne retenue.",
  },
];

/**
 * Ce que contient le produit.
 *
 * CHAQUE LIGNE MONTRE LE COMPOSANT RÉEL, elle ne le décrit pas. La tuile
 * « Candidatures » affiche les vraies marques de statut, la tuile « Postes »
 * la vraie jauge de capacité. C'est la différence entre une page qui affirme
 * qu'un produit existe et une page qui en donne la preuve — et c'est ce qui
 * interdit à cette section de vieillir : elle est rendue par le design system,
 * donc elle suit ses évolutions sans être retouchée.
 *
 * C'est aussi ce qui remplace le motif « icône + titre + phrase » répété six
 * fois : chaque ligne a une forme propre, dictée par ce qu'elle a à montrer.
 */
const CAPABILITIES: {
  title: string;
  body: string;
  specimen: ReactNode;
  span?: string;
}[] = [
  {
    title: "Un état par candidature",
    body: "Trois issues possibles, et chacune se lit à sa forme autant qu'à sa couleur.",
    span: "sm:col-span-2",
    specimen: (
      <div className="flex flex-wrap gap-2">
        <StatusMark form="live" tone="sage">
          En attente
        </StatusMark>
        <StatusMark form="seal" tone="forest">
          Acceptée
        </StatusMark>
        <StatusMark form="struck" tone="neutral">
          Non retenue
        </StatusMark>
      </div>
    ),
  },
  {
    title: "Des postes, pas un pourcentage",
    body: "Le remplissage d'une mission se voit avant de se lire.",
    specimen: <CapacityMeter filled={2} headcount={4} />,
  },
  {
    title: "Le cycle d'une mission",
    body: "Du brouillon à la clôture, en passant par l'annulation.",
    specimen: (
      <div className="flex flex-wrap gap-2">
        <StatusMark form="draft">Brouillon</StatusMark>
        <StatusMark form="live" tone="clay">
          En cours
        </StatusMark>
        <StatusMark form="quiet">Terminée</StatusMark>
      </div>
    ),
  },
  {
    title: "Des contrats signés en ligne",
    body: "Générés à l'attribution, puis signés par les deux parties depuis l'espace documents.",
    span: "sm:col-span-2",
    specimen: (
      <div className="flex items-center gap-3 rounded-[10px] border border-rule bg-paper px-3 py-2.5">
        <FileSignature
          size={16}
          aria-hidden="true"
          className="shrink-0 text-forest"
        />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
          Contrat · Chef de rang
        </span>
        <StatusMark form="seal" tone="forest">
          Finalisé
        </StatusMark>
      </div>
    ),
  },
  {
    title: "Les offres France Travail, sans confusion possible",
    body: "Les offres publiques du secteur sont consultables à côté des missions InteriMatch. Leur provenance est signalée sur chaque carte, et elles ne se candidatent pas ici.",
    span: "sm:col-span-2",
    specimen: (
      <div className="flex items-center gap-2.5 rounded-[10px] border border-rule bg-paper px-3 py-2.5">
        <Globe size={16} aria-hidden="true" className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
          Serveur / Serveuse — Lyon
        </span>
        <span className="shrink-0 rounded-[5px] border border-rule-strong px-2 py-1 text-[0.6875rem] font-semibold text-ink-soft">
          Source France Travail
        </span>
      </div>
    ),
  },
];

export function Home() {
  usePageSeo({
    title: "InteriMatch · Missions et recrutement en hôtellerie-restauration",
    description:
      "Plateforme de mise en relation entre professionnels et établissements de l’hôtellerie-restauration. Missions adaptées, compétences et disponibilités.",
    robots: "index,follow",
  });
  const { user } = useAuth();

  return (
    <div className="im-page">
      {/* ═══════════════ Bandeau ═══════════════ */}
      <section
        className="home-hero relative overflow-hidden bg-forest-deep text-white"
        aria-labelledby="hero-title"
      >
        <DotTexture className="text-sage/18" gap={22} />
        <div className="im-shell im-shell--wide relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <Reveal>
            <p className="im-eyebrow im-eyebrow--light">
              Hôtellerie · Restauration · Auvergne-Rhône-Alpes
            </p>
            <h1 id="hero-title" className="mt-5 text-white">
              Les bonnes personnes,
              <span className="block text-clay-soft italic">
                au bon moment.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] text-white/72 leading-relaxed">
              InteriMatch rapproche les besoins des établissements HCR et les
              profils disponibles. Chaque proposition est classée sur des
              critères visibles, et chaque candidature se suit jusqu’à sa
              décision.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {user ? (
                <Link
                  className="im-btn im-btn--clay im-btn--lg"
                  to={destination(user)}
                >
                  Retrouver mon espace
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link className="im-btn im-btn--clay im-btn--lg" to="/register">
                    Créer mon profil intérimaire
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link
                    className="im-btn im-btn--lg border-white/25 bg-white/8 text-white hover:border-white/45 hover:bg-white/14"
                    to="/login"
                  >
                    J’ai déjà un accès
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 flex max-w-md items-center gap-3 border-white/12 border-t pt-5">
              <MatchyMascot pose="dashboard" size={76} className="shrink-0" />
              <p className="text-[0.8125rem] text-white/60 leading-relaxed">
                <strong className="block font-semibold text-white/85">
                  Matchy vous accompagne
                </strong>
                Du profil complété jusqu’à la mission confirmée.
              </p>
            </div>
          </Reveal>

          {/*
           * Aperçu du produit.
           *
           * Construit avec les composants réels — `StatusMark`, `CapacityMeter`,
           * les jetons de couleur, la même échelle typographique. Une capture
           * d'écran vieillirait dès la prochaine évolution ; ceci ne le peut
           * pas. Le contenu est une mission d'exemple, présentée comme telle.
           */}
          <Reveal delay={0.12} className="relative">
            <BeamFrame
              className="mx-auto max-w-md rounded-frame p-3"
              surface="bg-forest-deep"
            >
              <div className="overflow-hidden rounded-panel bg-surface text-ink shadow-float">
                <div className="flex items-start justify-between gap-3 border-rule border-b bg-paper px-5 py-4">
                  <div>
                    <p className="font-display font-semibold text-[1.0625rem] leading-tight">
                      Chef de rang — service du soir
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-ink-faint">
                      <MapPin size={13} aria-hidden="true" />
                      Lyon 2ᵉ · 18 h – 23 h
                    </p>
                  </div>
                  <StatusMark form="live" tone="forest">
                    À pourvoir
                  </StatusMark>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                      Compatibilité
                    </span>
                    <span className="font-sans font-semibold text-[1.625rem] text-forest leading-none tracking-tight">
                      <Ticker value={82} suffix=" %" />
                    </span>
                  </div>

                  <p className="-mt-1 text-[0.6875rem] text-ink-faint">
                    Répartition des 100 points, critère par critère
                  </p>
                  <ul className="im-bare space-y-2">
                    {CRITERIA.map((c) => (
                      <li key={c.name} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 text-[0.8125rem] text-ink-soft">
                          {c.name}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep">
                          <span
                            className="block h-full rounded-full bg-forest"
                            style={{ width: `${c.weight}%` }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-right text-[0.75rem] font-semibold text-ink-faint tabular-nums">
                          {c.weight}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-rule border-t pt-3">
                    <CapacityMeter filled={1} headcount={3} />
                  </div>
                </div>
              </div>
              <p className="px-1 pt-2.5 text-center text-[0.6875rem] text-white/45">
                Exemple d’affichage. Les pondérations sont celles réellement
                appliquées par le rapprochement.
              </p>
            </BeamFrame>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ Le rapprochement ═══════════════ */}
      <section
        className="border-rule border-b bg-surface py-16 lg:py-24"
        aria-labelledby="match-title"
      >
        <div className="im-shell im-shell--wide grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal>
            <p className="im-eyebrow">Le rapprochement</p>
            <h2 id="match-title" className="mt-4 text-ink text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)]">
              Un score que l’on peut contester
            </h2>
            <p className="mt-5 text-ink-soft leading-relaxed">
              InteriMatch n’affiche jamais un pourcentage sans dire d’où il
              vient. Cent points sont répartis sur quatre critères mesurables, et
              cinq situations écartent une mission sans qu’aucun score puisse les
              racheter.
            </p>
            <p className="mt-4 text-[0.875rem] text-ink-faint leading-relaxed">
              Un profil et une mission donnent toujours le même résultat : le
              calcul ne consulte ni horloge, ni historique, ni classement
              d’autres candidats.
            </p>
          </Reveal>

          <div className="grid gap-8 sm:grid-cols-2">
            <Reveal delay={0.08}>
              <h3 className="im-rule mb-5">Ce qui compte</h3>
              <dl className="space-y-5">
                {CRITERIA.map((c) => (
                  <div key={c.name}>
                    <dt className="flex items-baseline gap-2.5">
                      <span className="font-display font-semibold text-[1.5rem] text-forest leading-none tabular-nums">
                        {c.weight}
                      </span>
                      <span className="font-semibold text-[0.9375rem] text-ink">
                        {c.name}
                      </span>
                    </dt>
                    <dd className="mt-1 pl-[2.6rem] text-[0.8125rem] text-ink-faint leading-relaxed">
                      {c.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.16}>
              <h3 className="im-rule mb-5">Ce qui bloque</h3>
              <ul className="im-bare space-y-2.5">
                {BLOCKERS.map((b) => (
                  <li key={b}>
                    <StatusMark form="struck" tone="neutral">
                      {b}
                    </StatusMark>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[0.8125rem] text-ink-faint leading-relaxed">
                Ces cinq situations ne sont pas pénalisées : elles rendent la
                mission indisponible. Un score de 98 % avec une compétence
                obligatoire manquante reste une mission à laquelle on ne peut
                pas postuler.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ Les deux parcours ═══════════════ */}
      <section className="grid lg:grid-cols-2" aria-label="Les deux parcours">
        <Path
          eyebrow="Intérimaires"
          title="Votre profil décide de ce que vous voyez"
          lead="Plus votre situation est précise, plus les missions proposées sont réellement tenables — et plus vous comprenez pourquoi elles vous sont proposées."
          steps={WORKER_STEPS}
          cta={
            user ? null : (
              <Link className="im-btn im-btn--primary" to="/register">
                Créer mon profil
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )
          }
        />
        <Path
          dark
          eyebrow="Établissements"
          title="Un recrutement lisible, de bout en bout"
          lead="Décrivez le besoin une fois. Le rapprochement fait le tri, vous gardez la décision, et le contrat suit l’attribution."
          steps={COMPANY_STEPS}
          cta={
            user ? null : (
              <Link
                className="im-btn border-white/25 bg-white/8 text-white hover:border-white/45 hover:bg-white/14"
                to="/login"
              >
                Accéder à l’espace entreprise
              </Link>
            )
          }
        />
      </section>

      {/* ═══════════════ Ce que contient le produit ═══════════════ */}
      <section
        className="bg-paper-deep py-16 lg:py-24"
        aria-labelledby="capabilities-title"
      >
        <div className="im-shell im-shell--wide">
          <Reveal className="max-w-2xl">
            <p className="im-eyebrow">Dans le produit</p>
            <h2 id="capabilities-title" className="mt-4 text-ink text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)]">
              Tout le cycle, du besoin au contrat
            </h2>
          </Reveal>

          {/*
           * Grille bento.
           *
           * SOURCE : Magic UI — `bento-grid` (https://magicui.design/r/bento-grid.json,
           * licence MIT). On en reprend la structure : des tuiles de tailles
           * inégales dans une grille dense, et un survol qui remonte le contenu.
           *
           * ADAPTÉ : l'original impose une hauteur fixe de 22 rem par rangée,
           * une icône de 48 px et un lien « en savoir plus » par tuile. Ici les
           * tuiles s'ajustent à leur texte — cinq tuiles vides aux trois quarts
           * seraient pires qu'une liste — et aucune ne promet une page qui
           * n'existe pas.
           */}
          {/*
           * Grille bento.
           *
           * SOURCE de la structure : Magic UI — `bento-grid`
           * (https://magicui.design/r/bento-grid.json, licence MIT) : des
           * tuiles de tailles inégales dans une grille dense, et un survol qui
           * remonte légèrement la tuile.
           *
           * ADAPTÉ : l'original fixe une hauteur de 22 rem par rangée, une
           * icône de 48 px et un lien « en savoir plus » par tuile. Une
           * première intégration l'a suivi tel quel et a produit exactement le
           * défaut à éviter — cinq blocs « icône + titre + phrase », deux trous
           * dans la grille, et rien à regarder. Ici les tuiles portent un
           * SPÉCIMEN du composant réel, la grille est sur quatre colonnes pour
           * que 2+1+1 puis 1+... se referment sans trou, et aucune tuile ne
           * promet une page qui n'existe pas.
           */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item, index) => (
              <Reveal
                key={item.title}
                delay={0.05 * index}
                className={cn(
                  "group",
                  item.span,
                  item.span ? "lg:col-span-2" : undefined,
                )}
              >
                <div className="flex h-full flex-col gap-4 rounded-panel border border-rule bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-sage hover:shadow-raise">
                  <div>
                    <h3 className="text-ink">{item.title}</h3>
                    <p className="mt-1.5 text-[0.875rem] text-ink-faint leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                  {/* Le spécimen est décoratif ici : il illustre un composant
                      dont le texte est déjà porté par le paragraphe. */}
                  <div className="mt-auto pt-1" aria-hidden="true">
                    {item.specimen}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ Appel à l'action ═══════════════ */}
      {!user && (
        <section
          className="relative overflow-hidden bg-forest text-white"
          aria-labelledby="final-cta-title"
        >
          <DotTexture className="text-white/12" gap={26} />
          <div className="im-shell im-shell--wide relative flex flex-col items-start gap-7 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20">
            <div className="max-w-xl">
              <p className="im-eyebrow im-eyebrow--light">Commencer</p>
              <h2
                id="final-cta-title"
                className="mt-4 text-white text-[clamp(1.5rem,1.1rem+1.4vw,2.25rem)]"
              >
                Votre profil se construit section par section
              </h2>
              <p className="mt-4 text-white/70 leading-relaxed">
                Identité, métier, compétences, mobilité et disponibilités.
                Chaque bloc s’enregistre seul : rien ne vous oblige à tout
                remplir d’un trait.
              </p>
            </div>
            <Link className="im-btn im-btn--clay im-btn--lg" to="/register">
              <Sparkles size={17} aria-hidden="true" />
              Créer mon compte
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Un parcours, côté intérimaire ou côté établissement.
 *
 * LES DEUX COLONNES NE SONT PAS JUMELLES. L'une est sur papier, l'autre sur
 * vert profond. Deux blocs identiques côte à côte se lisent comme un gabarit
 * dupliqué ; deux blocs qui se répondent se lisent comme un choix. C'est la
 * même information, et elle raconte deux publics distincts.
 */
function Path({
  eyebrow,
  title,
  lead,
  steps,
  cta,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  steps: { title: string; body: string }[];
  cta: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-0 py-16 lg:py-24",
        dark ? "bg-forest-deep text-white" : "bg-surface",
      )}
    >
      {/* Chaque colonne se cale sur la gouttière de la page du côté où elle
          touche le bord, et laisse respirer le pli central. Sans cela, les deux
          textes flottent au milieu de leur moitié et le pli disparaît. */}
      <Reveal
        className={cn(
          "im-shell max-w-[40rem] lg:max-w-[33rem]",
          dark
            ? "lg:mr-auto lg:ml-0 lg:pl-14"
            : "lg:mr-0 lg:ml-auto lg:pr-14",
        )}
      >
        <p
          className={cn("im-eyebrow", dark ? "im-eyebrow--light" : undefined)}
        >
          {eyebrow}
        </p>
        <h2
          className={cn(
            "mt-4 text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)]",
            dark ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "mt-5 leading-relaxed",
            dark ? "text-white/70" : "text-ink-soft",
          )}
        >
          {lead}
        </p>

        {/* Liste ordonnée réelle : l'ordre des étapes est une information, pas
            une mise en forme. Le compteur est dessiné, la sémantique reste. */}
        <ol className="im-bare mt-9 space-y-0">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                "flex gap-5 border-t py-5 first:border-t-0 first:pt-0",
                dark ? "border-white/12" : "border-rule",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "shrink-0 font-display font-semibold text-[1.125rem] leading-snug tabular-nums",
                  dark ? "text-clay-soft" : "text-clay-ink",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className={dark ? "text-white" : "text-ink"}>
                  {step.title}
                </h3>
                <p
                  className={cn(
                    "mt-1.5 text-[0.875rem] leading-relaxed",
                    dark ? "text-white/62" : "text-ink-faint",
                  )}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {cta && <div className="mt-9">{cta}</div>}
      </Reveal>
    </div>
  );
}
