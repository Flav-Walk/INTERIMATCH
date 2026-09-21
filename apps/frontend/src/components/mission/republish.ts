import {
  toLocalInput,
  type Mission,
  type MissionFormValues,
} from "../../services/missions";

const MAX_WEEKS = 520;

/**
 * Formulaire préremplissant une nouvelle mission à partir d'une ancienne.
 *
 * Les besoins de l'hôtellerie-restauration reviennent à la semaine : le même
 * service, le même jour, à la même heure. Les dates sont donc décalées de
 * semaine en semaine jusqu'à tomber dans le futur, en heure locale (un
 * changement d'heure ne décale pas le service). Si elles sont illisibles, on
 * les laisse vides plutôt que d'en inventer.
 */
export function republishedForm(
  values: MissionFormValues,
  now: Date = new Date(),
): MissionFormValues {
  const start = new Date(values.starts_at);
  const end = new Date(values.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return { ...values, starts_at: "", ends_at: "" };

  for (let i = 0; start <= now && i < MAX_WEEKS; i++) {
    start.setDate(start.getDate() + 7);
    end.setDate(end.getDate() + 7);
  }
  return {
    ...values,
    starts_at: toLocalInput(start.toISOString()),
    ends_at: toLocalInput(end.toISOString()),
  };
}

/**
 * Les missions à proposer de relancer : les plus récentes déjà passées ou
 * pourvues, une seule par intitulé et par métier.
 */
export function rebookable(missions: Mission[], limit = 3): Mission[] {
  const seen = new Set<string>();
  return [...missions]
    .filter((m) => m.status === "completed" || m.status === "filled")
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .filter((m) => {
      const key = `${m.job}|${m.title.trim().toLocaleLowerCase("fr")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
