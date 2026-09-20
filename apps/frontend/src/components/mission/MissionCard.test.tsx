import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Mission } from "../../services/missions";
import { MissionCard, missionSchedule } from "./MissionCard";

const localIso = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: "mission-1",
  title: "Service du soir",
  description: "",
  job: "serveur",
  starts_at: localIso(2026, 9, 25, 10),
  ends_at: localIso(2026, 9, 25, 23, 59),
  address: "",
  city: "Lyon",
  postal_code: "69007",
  latitude: 45.758,
  longitude: 4.835,
  pay_amount: "10.00",
  pay_unit: "hour",
  headcount: 10,
  min_years_experience: null,
  status: "open",
  published_at: localIso(2026, 9, 20, 16),
  demo: false,
  media: null,
  skills: [],
  ...over,
});

describe("carte mission", () => {
  it("affiche une plage d'une journée sans répéter la date", () => {
    const schedule = missionSchedule(mission());
    expect(schedule.match(/2026/g)).toHaveLength(1);
    expect(schedule).toContain("10h");
    expect(schedule).toContain("23h59");
  });

  it("révèle la date de fin lorsqu'elle diffère de la date de début", () => {
    const schedule = missionSchedule(
      mission({ ends_at: localIso(2027, 9, 25, 23, 59) }),
    );
    expect(schedule).toContain("2026");
    expect(schedule).toContain("2027");
  });

  it("affiche le score exact fourni par le backend sans le recalculer", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(MissionCard, {
          mission: mission(),
          score: 64,
          band: 60,
          bandLabel: "Compatibles",
        }),
      ),
    );
    expect(html).toContain("Compatible à 64");
    expect(html).toContain("is-mid");
  });
});
