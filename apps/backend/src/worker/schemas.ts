import { z } from "zod";
import { jobValues } from "../domain/reference.js";

const text = (max = 120) => z.string().trim().min(1).max(max);

/**
 * Modification partielle du profil intérimaire. Tous les champs sont facultatifs :
 * l'utilisateur enregistre section par section. `.strict()` refuse tout champ non
 * déclaré — c'est ce qui empêche le client d'envoyer `role`,
 * `onboarding_completed`, `latitude` ou `longitude`, qui sont décidés par le serveur.
 */
export const workerPatchSchema = z
  .object({
    first_name: text(),
    last_name: text(),
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9 ().-]{6,25}$/, "Numéro de téléphone invalide.")
      .nullable(),
    main_job: z.enum(jobValues),
    secondary_jobs: z.array(z.enum(jobValues)).max(5),
    years_experience: z.number().min(0).max(60).nullable(),
    city: text(),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Code postal invalide."),
    mobility_radius_km: z.number().int().min(0).max(250),
    has_driving_licence: z.boolean(),
    has_vehicle: z.boolean(),
    open_to_missions: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification transmise.")
  .refine(
    (v) => !(v.has_vehicle === true && v.has_driving_licence === false),
    "Un véhicule suppose le permis.",
  )
  .refine(
    (v) =>
      !v.secondary_jobs ||
      new Set(v.secondary_jobs).size === v.secondary_jobs.length,
    "Métiers secondaires dupliqués.",
  )
  .refine(
    (v) =>
      !v.main_job ||
      !v.secondary_jobs ||
      !v.secondary_jobs.includes(v.main_job),
    "Un métier secondaire ne peut pas répéter le métier principal.",
  );

export const skillsSchema = z
  .object({ skill_ids: z.array(z.uuid()).max(20) })
  .strict()
  .refine(
    (v) => new Set(v.skill_ids).size === v.skill_ids.length,
    "Compétences dupliquées.",
  );

export const experiencesSchema = z
  .object({
    experiences: z
      .array(
        z
          .object({
            job_title: text(),
            employer: text(),
            years: z.number().min(0).max(60),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const certificationsSchema = z
  .object({
    certifications: z
      .array(
        z
          .object({
            name: text(),
            issuer: z.string().trim().max(120).default(""),
            obtained_on: z.iso.date().nullable().optional(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

const slot = {
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  status: z.enum(["available", "unavailable"]).default("available"),
};

export const availabilitySchema = z
  .object(slot)
  .strict()
  .refine(
    (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
    "La fin doit suivre le début.",
  );

export const availabilityPatchSchema = z
  .object({
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    status: z.enum(["available", "unavailable"]),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification transmise.");

export type WorkerPatch = z.infer<typeof workerPatchSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type AvailabilityPatch = z.infer<typeof availabilityPatchSchema>;
export type ExperienceInput = z.infer<typeof experiencesSchema>["experiences"];
export type CertificationInput = z.infer<
  typeof certificationsSchema
>["certifications"];
