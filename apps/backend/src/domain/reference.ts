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

export const sectorValues = sectors.map((s) => s.value) as [
  string,
  ...string[],
];
