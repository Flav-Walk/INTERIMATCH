// Vocabulaire métier partagé. Source unique : les écrans ne redéclarent jamais ces
// listes, ils les lisent via GET /api/v1/reference. Ajouter une valeur ici la rend
// disponible côté navigateur sans toucher au JSX.

export interface ReferenceValue {
  value: string;
  label: string;
}

export const sectors: readonly ReferenceValue[] = Object.freeze([
  { value: "restaurant", label: "Restaurant" },
  { value: "brasserie", label: "Brasserie" },
  { value: "hotel", label: "Hôtel" },
  { value: "traiteur", label: "Traiteur" },
]);

// Statuts prévus pour le suivi ATS. Volontairement extensibles : le parcours
// mission → candidature → décision est défini au cahier des charges, mais aucune
// transition n'est implémentée tant que les tables missions n'existent pas.
export const missionStatuses: readonly ReferenceValue[] = Object.freeze([
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publiée" },
  { value: "filled", label: "Pourvue" },
  { value: "closed", label: "Clôturée" },
]);

export const applicationStatuses: readonly ReferenceValue[] = Object.freeze([
  { value: "proposed", label: "Proposée" },
  { value: "accepted", label: "Acceptée par l'intérimaire" },
  { value: "refused", label: "Refusée par l'intérimaire" },
  { value: "shortlisted", label: "Présélectionnée" },
  { value: "assigned", label: "Attribuée" },
  { value: "withdrawn", label: "Retirée" },
]);

// Métiers de l'hôtellerie-restauration. Liste volontairement courte et fermée :
// une valeur comparable vaut mieux qu'un texte libre pour le futur matching.
// Ce n'est PAS une taxonomie métier complète — cette limite est documentée, et
// la liste s'étend en ajoutant une ligne ici, sans toucher aux écrans.
export const jobs: readonly ReferenceValue[] = Object.freeze([
  { value: "serveur", label: "Serveur / Serveuse" },
  { value: "chef_de_rang", label: "Chef de rang" },
  { value: "maitre_hotel", label: "Maître d'hôtel" },
  { value: "commis_salle", label: "Commis de salle" },
  { value: "barman", label: "Barman / Barmaid" },
  { value: "cuisinier", label: "Cuisinier / Cuisinière" },
  { value: "chef_de_partie", label: "Chef de partie" },
  { value: "commis_cuisine", label: "Commis de cuisine" },
  { value: "plongeur", label: "Plongeur / Plongeuse" },
  { value: "receptionniste", label: "Réceptionniste" },
  { value: "employe_etage", label: "Employé·e d'étage" },
  { value: "hote_accueil", label: "Hôte / Hôtesse d'accueil" },
]);

export const jobValues = jobs.map((j) => j.value) as [string, ...string[]];

// Unité de rémunération d'une mission (cahier des charges §8.3).
export const payUnits: readonly ReferenceValue[] = Object.freeze([
  { value: "hour", label: "de l'heure" },
  { value: "day", label: "par jour" },
  { value: "mission", label: "pour la mission" },
]);

export const payUnitValues = payUnits.map((u) => u.value) as [
  string,
  ...string[],
];

export const jobLabel = (value: string) =>
  jobs.find((j) => j.value === value)?.label ?? value;

export const sectorValues = sectors.map((s) => s.value) as [
  string,
  ...string[],
];
