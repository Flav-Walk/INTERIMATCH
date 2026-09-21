import { describe, it, expect } from "vitest";
import type { Mission, MissionFormValues } from "../../services/missions";
import { emptyMission } from "../../services/missions";
import { rebookable, republishedForm } from "./republish";

const form = (starts: string, ends: string): MissionFormValues => ({
  ...emptyMission,
  title: "Serveur en salle",
  starts_at: starts,
  ends_at: ends,
});

describe("republishedForm", () => {
  const now = new Date(2026, 8, 21, 16, 0); // lundi 21 sept. 2026, 16 h

  it("décale d'une semaine un service passé jusqu'à la prochaine occurrence", () => {
    const out = republishedForm(
      form("2026-09-10T17:00", "2026-09-10T23:00"),
      now,
    );
    expect(out.starts_at).toBe("2026-09-24T17:00");
    expect(out.ends_at).toBe("2026-09-24T23:00");
  });

  it("garde le même jour de la semaine et la même heure", () => {
    const out = republishedForm(
      form("2026-08-01T12:00", "2026-08-01T15:30"),
      now,
    );
    expect(new Date(out.starts_at).getDay()).toBe(new Date(2026, 7, 1).getDay());
    expect(out.starts_at.endsWith("T12:00")).toBe(true);
    expect(out.ends_at.endsWith("T15:30")).toBe(true);
  });

  it("conserve un service qui passe minuit", () => {
    const out = republishedForm(
      form("2026-09-12T22:00", "2026-09-13T06:00"),
      now,
    );
    expect(out.starts_at).toBe("2026-09-26T22:00");
    expect(out.ends_at).toBe("2026-09-27T06:00");
  });

  it("ne bouge pas une date déjà dans le futur", () => {
    const out = republishedForm(
      form("2026-09-30T17:00", "2026-09-30T23:00"),
      now,
    );
    expect(out.starts_at).toBe("2026-09-30T17:00");
  });

  it("reprend les autres champs tels quels", () => {
    const out = republishedForm(form("2026-09-10T17:00", "2026-09-10T23:00"), now);
    expect(out.title).toBe("Serveur en salle");
  });

  it("laisse les dates vides si elles sont illisibles", () => {
    const out = republishedForm(form("", ""), now);
    expect(out.starts_at).toBe("");
    expect(out.ends_at).toBe("");
  });
});

describe("rebookable", () => {
  const mission = (id: string, title: string, status: Mission["status"], day: number) =>
    ({
      id,
      title,
      job: "serveur",
      status,
      starts_at: new Date(2026, 8, day, 17).toISOString(),
      ends_at: new Date(2026, 8, day, 23).toISOString(),
    }) as Mission;

  it("ne propose que des missions passées ou pourvues, les plus récentes d'abord", () => {
    const out = rebookable([
      mission("a", "A", "completed", 1),
      mission("b", "B", "draft", 5),
      mission("c", "C", "filled", 9),
      mission("d", "D", "open", 12),
    ]);
    expect(out.map((m) => m.id)).toEqual(["c", "a"]);
  });

  it("ne garde qu'une mission par intitulé", () => {
    const out = rebookable([
      mission("a", "Serveur en salle", "completed", 1),
      mission("b", "serveur en salle ", "completed", 8),
    ]);
    expect(out.map((m) => m.id)).toEqual(["b"]);
  });

  it("respecte la limite", () => {
    const many = ["a", "b", "c", "d", "e"].map((id, i) =>
      mission(id, id, "completed", i + 1),
    );
    expect(rebookable(many, 2)).toHaveLength(2);
  });
});
