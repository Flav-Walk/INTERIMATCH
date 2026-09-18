import { describe, expect, it } from "vitest";
import {
  missionGroup,
  missionGroupValues,
  missionLifecycle,
  missionPhase,
  notOpenToWorkers,
  type MissionTiming,
} from "./lifecycle.js";
import type { MissionCapacity, MissionStatus } from "./schemas.js";

/**
 * Le cycle de vie, jugé sur une horloge fixe.
 *
 * Aucun de ces tests ne lit l'heure courante. Un cycle de vie se définit par
 * rapport à un instant, et un test qui prendrait le sien dans `new Date()`
 * changerait de sens selon l'heure de son exécution — passant vert le matin et
 * rouge à minuit, pour des raisons sans rapport avec le code. L'instant est donc
 * un paramètre, ici comme dans les fonctions testées.
 */
const NOW = new Date("2026-09-18T12:00:00.000Z");
const at = (hours: number) =>
  new Date(NOW.getTime() + hours * 3_600_000).toISOString();

const mission = (
  status: MissionStatus,
  startsIn: number,
  endsIn: number,
): MissionTiming => ({
  status,
  starts_at: at(startsIn),
  ends_at: at(endsIn),
});

const capacity = (headcount: number, filled: number): MissionCapacity => ({
  headcount,
  filled,
  remaining: Math.max(0, headcount - filled),
  full: filled >= headcount,
});

describe("phase d'une mission", () => {
  it("reconnaît un brouillon", () => {
    expect(missionPhase(mission("draft", 24, 30), 0, NOW)).toBe("draft");
  });

  it("reconnaît une mission publiée que personne n'a encore rejointe", () => {
    expect(missionPhase(mission("open", 24, 30), 0, NOW)).toBe("open");
  });

  it("passe à « à venir » dès qu'une personne est retenue", () => {
    expect(missionPhase(mission("open", 24, 30), 1, NOW)).toBe("upcoming");
  });

  it("reconnaît une mission en cours", () => {
    expect(missionPhase(mission("open", -1, 5), 1, NOW)).toBe("in_progress");
  });

  it("place le début du créneau du côté « en cours »", () => {
    // Bornes semi-ouvertes [début, fin) : la minute du début appartient déjà à
    // la mission, comme partout ailleurs dans le produit.
    expect(missionPhase(mission("open", 0, 6), 0, NOW)).toBe("in_progress");
  });

  it("place la fin du créneau du côté « terminée »", () => {
    // Et la minute de fin ne lui appartient plus — c'est ce qui permet à deux
    // missions consécutives de se toucher sans se chevaucher.
    expect(missionPhase(mission("open", -6, 0), 1, NOW)).toBe("completed");
  });

  it("reconnaît une mission terminée", () => {
    expect(missionPhase(mission("open", -10, -4), 2, NOW)).toBe("completed");
  });

  it("laisse l'annulation primer sur le calendrier", () => {
    // Une mission annulée le reste une fois son créneau passé. La dire
    // « terminée » laisserait croire qu'elle a eu lieu.
    expect(missionPhase(mission("cancelled", -10, -4), 0, NOW)).toBe(
      "cancelled",
    );
    expect(missionPhase(mission("cancelled", -1, 5), 1, NOW)).toBe("cancelled");
    expect(missionPhase(mission("cancelled", 24, 30), 0, NOW)).toBe(
      "cancelled",
    );
  });

  it("laisse un brouillon périmé rester un brouillon", () => {
    // Rien ne s'est passé : personne ne l'a vue, personne n'y a postulé.
    expect(missionPhase(mission("draft", -10, -4), 0, NOW)).toBe("draft");
  });

  it("ne confond jamais « pourvue » avec une position dans le temps", () => {
    // Une mission complète et pas encore commencée est « à venir ». Le fait
    // qu'elle soit pourvue se lit dans `capacity.full`, et nulle part ailleurs.
    expect(missionPhase(mission("open", 24, 30), 3, NOW)).toBe("upcoming");
  });
});

describe("motif de fermeture aux intérimaires", () => {
  it("n'oppose rien à une mission publiée avec de la place", () => {
    expect(notOpenToWorkers(mission("open", 24, 30), NOW, capacity(3, 1))).toBe(
      null,
    );
  });

  it.each([
    ["draft" as const, 24, 30, "draft"],
    ["cancelled" as const, 24, 30, "cancelled"],
    ["open" as const, -10, -4, "ended"],
  ])("refuse %s [%i h, %i h) avec le motif %s", (status, from, to, reason) => {
    expect(notOpenToWorkers(mission(status, from, to), NOW)).toBe(reason);
  });

  it("répond « terminée » pour un brouillon périmé, là où la phase dit « brouillon »", () => {
    const perime = mission("draft", -10, -4);
    expect(notOpenToWorkers(perime, NOW)).toBe("ended");
    expect(missionPhase(perime, 0, NOW)).toBe("draft");

    // Les deux ont raison, parce qu'elles ne répondent pas à la même question.
    // `missionPhase` dit CE QU'EST la mission : un brouillon que personne n'a
    // jamais vu reste un brouillon, quoi qu'en dise le calendrier.
    // `notOpenToWorkers` dit CE QU'ON PEUT EN FAIRE, et là le créneau prime :
    // répondre « publiez-la » à une mission dont les dates sont derrière nous
    // serait un mauvais conseil, puisque `publish` la refuserait.
    //
    // Ce test existe pour que la divergence reste un choix, et non une dérive
    // que le prochain passage « harmoniserait » sans savoir ce qu'il casse.
  });

  it("annonce « complète » plutôt que « fermée » quand tout est pourvu", () => {
    // La mission est toujours publiée, toujours active : elle a simplement
    // trouvé tout son monde.
    expect(notOpenToWorkers(mission("open", 24, 30), NOW, capacity(2, 2))).toBe(
      "full",
    );
  });

  it("annonce l'annulation avant la complétude", () => {
    // Une mission annulée n'a rien pourvu. Répondre « full » ferait dire à
    // l'écran « tous les postes sont pourvus » d'une offre retirée.
    expect(
      notOpenToWorkers(mission("cancelled", 24, 30), NOW, capacity(2, 2)),
    ).toBe("cancelled");
  });

  it("continue d'offrir une mission déjà commencée", () => {
    // Un remplacement de dernière minute est un cas normal du métier. Le
    // produit l'autorisait déjà ; le cycle de vie ne le retire pas.
    expect(notOpenToWorkers(mission("open", -1, 5), NOW, capacity(2, 1))).toBe(
      null,
    );
  });
});

describe("lecture complète servie au frontend", () => {
  it("accorde toujours recruiting et son motif", () => {
    // L'invariant qui rend le contrat utilisable : l'un vaut vrai exactement
    // quand l'autre vaut null. Un écran ne peut donc jamais griser un bouton
    // sans avoir de quoi expliquer pourquoi.
    const cases: [MissionTiming, MissionCapacity][] = [
      [mission("open", 24, 30), capacity(3, 0)],
      [mission("open", 24, 30), capacity(3, 3)],
      [mission("draft", 24, 30), capacity(1, 0)],
      [mission("cancelled", 24, 30), capacity(1, 0)],
      [mission("open", -10, -4), capacity(1, 1)],
      [mission("open", -1, 5), capacity(2, 1)],
    ];
    for (const [target, seats] of cases) {
      const read = missionLifecycle(target, seats, NOW);
      expect([read.recruiting, read.recruiting_blocked === null]).toEqual([
        read.recruiting,
        read.recruiting,
      ]);
    }
  });

  it("décrit une mission publiée et disponible", () => {
    expect(
      missionLifecycle(mission("open", 24, 30), capacity(3, 1), NOW),
    ).toEqual({
      phase: "upcoming",
      group: "open",
      recruiting: true,
      recruiting_blocked: null,
    });
  });

  it("décrit une mission complète, qui reste à venir", () => {
    // Les deux axes vivent ensemble sans se contredire : la mission est
    // toujours « à venir », et elle ne recrute plus parce qu'elle est pleine.
    expect(
      missionLifecycle(mission("open", 24, 30), capacity(2, 2), NOW),
    ).toEqual({
      phase: "upcoming",
      group: "filled",
      recruiting: false,
      recruiting_blocked: "full",
    });
  });

  it("décrit une mission annulée", () => {
    expect(
      missionLifecycle(mission("cancelled", 24, 30), capacity(2, 1), NOW),
    ).toEqual({
      phase: "cancelled",
      group: "cancelled",
      recruiting: false,
      recruiting_blocked: "cancelled",
    });
  });

  it("décrit une mission terminée", () => {
    expect(
      missionLifecycle(mission("open", -10, -4), capacity(2, 2), NOW),
    ).toEqual({
      phase: "completed",
      group: "completed",
      recruiting: false,
      recruiting_blocked: "ended",
    });
  });
});

/**
 * Regroupement pour la liste entreprise.
 *
 * Les onglets filtraient sur `missions.status`. Comme `filled` et `completed`
 * ne sont jamais ecrits, une mission reellement pourvue restait `open` : elle
 * affichait « Pourvue » sur sa fiche et n apparaissait dans AUCUN onglet
 * correspondant. L onglet « Pourvues » etait vide par construction.
 */
describe("regroupement des missions d une entreprise", () => {
  it("range une mission publiee avec de la place dans les publiees", () => {
    expect(missionGroup(mission("open", 24, 30), capacity(3, 1), NOW)).toBe(
      "open",
    );
  });

  it("range une mission pourvue dans les pourvues, sans toucher au statut", () => {
    // LE CAS DE LA REVIEW. Le statut ecrit reste `open` — etre pourvue decrit le
    // recrutement, pas le cycle de vie — et pourtant la mission doit se ranger
    // dans « Pourvues ».
    const pleine = mission("open", 24, 30);
    expect(pleine.status).toBe("open");
    expect(missionGroup(pleine, capacity(2, 2), NOW)).toBe("filled");
  });

  it("range une mission passee dans les terminees", () => {
    expect(missionGroup(mission("open", -10, -4), capacity(2, 0), NOW)).toBe(
      "completed",
    );
  });

  it("laisse le calendrier primer sur le recrutement", () => {
    // Une mission complete ET passee est « terminee » : ce qui s est passe prime
    // sur la facon dont elle s est remplie. Meme ordre que `missionPhase`.
    expect(missionGroup(mission("open", -10, -4), capacity(2, 2), NOW)).toBe(
      "completed",
    );
  });

  it("laisse l intention primer sur tout le reste", () => {
    expect(
      missionGroup(mission("cancelled", -10, -4), capacity(2, 2), NOW),
    ).toBe("cancelled");
    expect(missionGroup(mission("draft", -10, -4), capacity(1, 0), NOW)).toBe(
      "draft",
    );
  });

  it("n attribue jamais deux groupes a la meme mission", () => {
    // L exclusivite est ce qui permet aux compteurs d etre la taille reelle des
    // listes affichees. Un groupe unique par mission, toujours defini.
    const cas: [MissionTiming, MissionCapacity][] = [
      [mission("open", 24, 30), capacity(3, 0)],
      [mission("open", 24, 30), capacity(3, 3)],
      [mission("open", -1, 5), capacity(2, 2)],
      [mission("open", -10, -4), capacity(1, 1)],
      [mission("draft", 24, 30), capacity(1, 0)],
      [mission("cancelled", 24, 30), capacity(1, 1)],
    ];
    for (const [cible, places] of cas) {
      const groupe = missionGroup(cible, places, NOW);
      expect(missionGroupValues).toContain(groupe);
    }
  });

  it("accorde toujours le groupe avec ce que la fiche affiche", () => {
    // L invariant qui interdit la contradiction signalee : une mission rangee
    // dans « Pourvues » ne doit pas se declarer encore recrutante ailleurs.
    const cas: [MissionTiming, MissionCapacity][] = [
      [mission("open", 24, 30), capacity(2, 2)],
      [mission("open", 24, 30), capacity(2, 1)],
      [mission("open", -10, -4), capacity(2, 2)],
    ];
    for (const [cible, places] of cas) {
      const lecture = missionLifecycle(cible, places, NOW);
      if (lecture.group === "filled") expect(lecture.recruiting).toBe(false);
      if (lecture.recruiting) expect(lecture.group).toBe("open");
    }
  });
});
