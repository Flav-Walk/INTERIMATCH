import { describe, expect, it } from "vitest";
import type { User } from "../services/session";
import {
  changedProfileGroups,
  workerProfileDraft,
} from "./WorkerProfile";

const user: User = {
  id: "worker-1",
  email: "worker@example.test",
  role: "worker",
  first_name: "Camille",
  last_name: "Martin",
  onboarding_completed: true,
  tour_version: 1,
  demo: false,
  missing_requirements: [],
  profile: {
    phone: "+33600000000",
    main_job: "serveur",
    secondary_jobs: ["barman"],
    years_experience: 4,
    city: "Lyon",
    postal_code: "69002",
    mobility_radius_km: 30,
    has_driving_licence: true,
    has_vehicle: true,
    open_to_missions: true,
    skills: [{ id: "skill-1", name: "Service en salle" }],
    experiences: [
      { id: "experience-1", job_title: "Serveuse", employer: "Le Café", years: 2 },
    ],
    certifications: [
      {
        id: "certification-1",
        name: "HACCP",
        issuer: "Institut",
        obtained_on: "2025-06-01",
      },
    ],
  },
};

describe("brouillon du profil intérimaire", () => {
  it("est propre à son initialisation et ignore l'ordre des sélections", () => {
    const baseline = workerProfileDraft(user);
    expect(changedProfileGroups(baseline, baseline)).toEqual([]);
    expect(
      changedProfileGroups(
        { ...baseline, secondary_jobs: ["barman", "plongeur"] },
        { ...baseline, secondary_jobs: ["plongeur", "barman"] },
      ),
    ).toEqual([]);
  });

  it("identifie indépendamment les groupes à persister séquentiellement", () => {
    const baseline = workerProfileDraft(user);
    const draft = {
      ...baseline,
      city: "Villeurbanne",
      skill_ids: ["skill-1", "skill-2"],
      experiences: [
        ...baseline.experiences,
        { job_title: "Barman", employer: "Le Zinc", years: 1 },
      ],
      certifications: [],
    };
    expect(changedProfileGroups(baseline, draft)).toEqual([
      "worker",
      "skills",
      "experiences",
      "certifications",
    ]);
  });
});
