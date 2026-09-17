import type { TourStep } from "../components/GuidedTour";
import type { Role } from "./session";

/**
 * Version de la visite guidée actuellement diffusée.
 *
 * Le compte mémorise la plus haute version qu'il a terminée (`profiles.tour_version`).
 * Augmenter cette constante rejoue la visite pour tout le monde, y compris les comptes
 * existants : c'est le mécanisme prévu pour présenter une nouveauté importante.
 */
export const CURRENT_TOUR_VERSION = 1;

export const shouldRunTour = (tourVersion: number) =>
  tourVersion < CURRENT_TOUR_VERSION;

// Chaque `target` correspond à un attribut data-tour réellement présent dans l'interface.
const workerTour: TourStep[] = [
  {
    title: "Bienvenue sur InteriMatch 👋",
    body: "Voici votre espace intérimaire. Deux minutes pour en faire le tour, et vous pourrez commencer.",
  },
  {
    target: "nav",
    title: "Votre navigation",
    body: "Tout votre espace tient ici : votre tableau de bord, votre profil et vos missions.",
  },
  {
    target: "profile-status",
    title: "Commencez par votre profil",
    body: "Métier, compétences, mobilité et disponibilités : ce sont ces informations qui permettront de vous proposer les bonnes missions.",
  },
  {
    target: "missions",
    title: "Missions disponibles",
    body: "Les missions publiées par les établissements apparaissent ici. Le classement selon votre profil, avec l'explication du score, viendra ensuite.",
  },
  {
    target: "availability",
    title: "Vos disponibilités",
    body: "Vos créneaux décident des missions que vous pouvez recevoir. Tenez-les à jour depuis votre profil.",
  },
  {
    target: "account",
    title: "C'est à vous",
    body: "Vous pouvez relancer cette visite à tout moment depuis ce menu. Bon courage pour vos prochains services !",
  },
];

const companyTour: TourStep[] = [
  {
    title: "Bienvenue sur InteriMatch 👋",
    body: "Voici votre espace entreprise. Un tour rapide pour situer vos outils de recrutement.",
  },
  {
    target: "nav",
    title: "Votre navigation",
    body: "Votre tableau de bord, votre établissement, vos missions et les candidats compatibles.",
  },
  {
    target: "profile-status",
    title: "Présentez votre établissement",
    body: "Secteur, adresse et description : les intérimaires verront ces informations avant de répondre à vos missions.",
  },
  {
    target: "missions",
    title: "Vos missions",
    body: "Vous décrirez ici le poste, les horaires et les compétences attendues. Chaque mission alimentera la recherche de candidats.",
  },
  {
    target: "candidates",
    title: "Les candidats compatibles",
    body: "Les profils seront classés par score de compatibilité, avec le détail des critères et la possibilité d'élargir au-delà de votre zone.",
  },
  {
    target: "account",
    title: "C'est à vous",
    body: "Vous pouvez relancer cette visite à tout moment depuis ce menu. Bons recrutements !",
  },
];

export const tourFor = (role: Role): TourStep[] =>
  role === "company" ? companyTour : workerTour;
