import { z } from "zod";
import { sectorValues, jobs, jobValues } from "../domain/reference.js";
const text = z.string().trim().min(1).max(120);
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export const registerSchema = loginSchema.extend({
  password: z.string().min(12).max(128),
});
// La visite guidée ; 0 la relance. Le rôle n'est jamais accepté depuis le client.
export const tourSchema = z
  .object({ version: z.number().int().min(0).max(1000) })
  .strict();
const identity = { first_name: text, last_name: text };
const location = {
  city: text,
  postal_code: z.string().regex(/^\d{5}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};
export const workerSchema = z
  .object({
    ...identity,
    ...location,
    main_job: text
      .transform((value) => {
        const normalized = value.toLocaleLowerCase("fr");
        return (
          jobs.find(
            (job) =>
              job.value === normalized ||
              job.label.toLocaleLowerCase("fr") === normalized,
          )?.value ?? normalized
        );
      })
      .pipe(z.enum(jobValues)),
    mobility_radius_km: z.number().int().min(0).max(250),
    skill_ids: z.array(z.uuid()).min(1).max(20),
    experiences: z
      .array(
        z
          .object({
            job_title: text,
            employer: text,
            years: z.number().min(0).max(60),
          })
          .strict(),
      )
      .max(10),
    availabilities: z
      .array(
        z
          .object({ starts_at: z.iso.datetime(), ends_at: z.iso.datetime() })
          .strict()
          .refine(
            (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
            "La fin doit suivre le début.",
          ),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .refine(
    (v) => new Set(v.skill_ids).size === v.skill_ids.length,
    "Compétences dupliquées.",
  )
  .refine((v) => {
    const slots = [...v.availabilities].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
    return slots.every(
      (v, i) =>
        !i || Date.parse(v.starts_at) >= Date.parse(slots[i - 1].ends_at),
    );
  }, "Les disponibilités se chevauchent.");
export const companySchema = z
  .object({
    ...identity,
    ...location,
    legal_name: text,
    establishment_name: text,
    sector: z.enum(sectorValues),
    address: z.string().trim().min(3).max(250),
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9 ().-]{6,25}$/),
    description: z.string().trim().max(1500),
  })
  .strict();
export type WorkerInput = z.infer<typeof workerSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type Role = "worker" | "company" | "admin";
export interface Profile {
  id: string;
  auth_user_id: string | null;
  email: string;
  // Toujours défini : le serveur attribue le rôle à la création du compte.
  role: Role;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  active: boolean;
  demo: boolean;
  tour_version: number;
}
