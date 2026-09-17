import { Router } from "express";
import { z } from "zod";
import type { Profile } from "../auth/schemas.js";
import { requireRole } from "../auth/routes.js";
import { MissionService } from "./service.js";
import { MatchingService } from "../matching/service.js";
import {
  missionCreateSchema,
  missionListSchema,
  missionUpdateSchema,
} from "./schemas.js";

const identifier = z.uuid();

/**
 * Missions, vues des deux côtés.
 *
 * Monté derrière `requireAuth` par le routeur de comptes : `res.locals.profile`
 * est la seule source d'identité, et `company_id` n'est jamais lu depuis la
 * requête.
 *
 * Deux espaces distincts, servis par le même service :
 *  - `/missions…` pour l'entreprise, qui voit et gère **ses** missions, quel
 *    que soit leur statut ;
 *  - `/workers/me/missions…` pour l'intérimaire, qui voit les missions
 *    **offertes**, sans jamais accéder à celles d'un autre statut. Le chemin dit
 *    « pour moi » : c'est là que le rapprochement viendra les ordonner, sans
 *    changer l'URL ni le contrat.
 *
 * Les transitions `filled`, `completed` et `cancelled` ne sont pas exposées :
 * elles viendront avec la candidature et l'attribution.
 */
export function missionRouter(missions: MissionService) {
  const router = Router();
  /**
   * Le rapprochement se construit ici, à partir du service missions et de sa
   * connexion. Il pourra être injecté depuis `createApp` comme les autres si le
   * besoin s'en fait sentir ; le monter localement évite pour l'instant de
   * traverser quatre fichiers d'assemblage pour une dépendance interne à ce
   * routeur, et garde le rapprochement là où sont ses deux seuls consommateurs.
   */
  const matching = new MatchingService(missions.db, missions);
  const company = requireRole("company");
  const worker = requireRole("worker");
  const me = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).id;
  /**
   * Un compte de démonstration ne voit que des missions de démonstration, et un
   * compte réel n'en voit aucune. Le marqueur vient de la session, jamais de la
   * requête : personne ne peut demander à voir l'autre côté de la cloison.
   */
  const isDemo = (res: { locals: Record<string, unknown> }) =>
    (res.locals.profile as Profile).demo;

  router.get("/missions", company, async (req, res) => {
    const { status } = missionListSchema.parse(req.query);
    const companyId = me(res);
    const [items, counts] = await Promise.all([
      missions.list(companyId, status),
      missions.counts(companyId),
    ]);
    res.json({ missions: items, counts });
  });

  router.get("/missions/:id", company, async (req, res) =>
    res.json(await missions.get(me(res), identifier.parse(req.params.id))),
  );

  router.post("/missions", company, async (req, res) => {
    const companyId = me(res);
    const id = await missions.create(
      companyId,
      missionCreateSchema.parse(req.body),
    );
    // La mission créée est relue et renvoyée entière, comme le ferait un GET :
    // le client connaît ainsi son identifiant, son statut et ses coordonnées.
    res.status(201).json(await missions.get(companyId, id));
  });

  router.patch("/missions/:id", company, async (req, res) =>
    res.json(
      await missions.update(
        me(res),
        identifier.parse(req.params.id),
        missionUpdateSchema.parse(req.body),
      ),
    ),
  );

  router.post("/missions/:id/publish", company, async (req, res) =>
    // Sans corps : la date de publication est décidée par le serveur.
    res.json(await missions.publish(me(res), identifier.parse(req.params.id))),
  );

  /**
   * Candidats rapprochés d'une mission de l'entreprise.
   *
   * La propriété est vérifiée en amont par le service, qui répond « introuvable »
   * pour la mission d'une autre société : personne ne peut obtenir les candidats
   * d'une mission qui ne lui appartient pas.
   *
   * Une mission qui n'est plus offerte aux intérimaires répond 200 avec une
   * liste vide et le champ `inactive` : elle appartient bien à l'entreprise, on
   * ne la déclare donc pas introuvable — on dit simplement pourquoi le
   * rapprochement ne s'y applique pas.
   */
  router.get("/missions/:id/candidates", company, async (req, res) =>
    res.json(
      await matching.candidatesForMission(
        me(res),
        identifier.parse(req.params.id),
        isDemo(res),
      ),
    ),
  );

  // --- Espace intérimaire : missions offertes, rapprochées du profil. ---

  /**
   * Seules les missions réellement compatibles, de la plus proche du profil à
   * la moins proche. Un intérimaire ne reçoit plus tout ce qui est publié.
   */
  router.get("/workers/me/missions", worker, async (_req, res) => {
    const { matches, excluded } = await matching.missionsForWorker(
      me(res),
      isDemo(res),
    );
    res.json({
      missions: matches.map(({ mission, match }) => ({ ...mission, match })),
      // Le décompte des missions écartées, par motif. Il permet d'expliquer un
      // écran vide sans rien révéler des missions concernées : des nombres, pas
      // des offres. Voir `Exclusions` dans le service de rapprochement.
      excluded,
    });
  });

  /**
   * Le détail reste accessible pour toute mission offerte, compatible ou non :
   * arriver par un lien et n'y trouver qu'une erreur n'apprend rien, alors que
   * le motif de l'incompatibilité, lui, est utile.
   */
  router.get("/workers/me/missions/:id", worker, async (req, res) => {
    const { mission, match } = await matching.evaluateForWorker(
      me(res),
      identifier.parse(req.params.id),
      isDemo(res),
    );
    res.json({ ...mission, match });
  });

  return router;
}
