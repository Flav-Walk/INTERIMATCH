import "dotenv/config";
import pino from "pino";
import { createApp } from "./app.js";
import { createSupabaseAdmin } from "./integrations/clients.js";
import { MissionMediaService } from "./media/service.js";
import { createSupabaseMediaStore } from "./media/store.js";
import { UnsplashService } from "./media/unsplash.js";
import { readConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { AccountService } from "./auth/service.js";
import { createGoogleBridge } from "./auth/google.js";
import { WorkerService } from "./worker/service.js";
import { createAddressGeocoder } from "./worker/geocode.js";
import { MissionService } from "./missions/service.js";
import { AdminService } from "./admin/service.js";
import { ApplicationService } from "./applications/service.js";
import { PublicJobOfferService } from "./public-data/service.js";
import { createSupabaseContractStore } from "./contracts/store.js";
import { BrevoEmailService } from "./contracts/email.js";
import { ContractService } from "./contracts/service.js";
import {
  AsyncBusinessEventPublisher,
  N8nWebhookDelivery,
} from "./events/dispatcher.js";
const config = readConfig(process.env);
const db = config.DATABASE_URL ? createDatabase(config) : null;
const google = createGoogleBridge(config);
// Un seul géocodeur pour les trois services : comptes, intérimaires, missions.
const geocoder = createAddressGeocoder();
const accounts = db
  ? new AccountService(db, google, geocoder, {
      allowTestIdentities: config.NODE_ENV !== "production",
    })
  : undefined;
const eventLogger = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
});
const events =
  config.N8N_WEBHOOK_URL && config.N8N_WEBHOOK_SECRET
    ? new AsyncBusinessEventPublisher(
        new N8nWebhookDelivery(
          config.N8N_WEBHOOK_URL,
          config.N8N_WEBHOOK_SECRET,
          eventLogger,
        ),
        eventLogger,
      )
    : undefined;
const workers = db ? new WorkerService(db, geocoder, events) : undefined;
/**
 * Photos de mission.
 *
 * Deux capacités indépendantes, et le service existe dès que l'une des deux est
 * là : sans Supabase, pas d'import ; sans clé Unsplash, pas de bibliothèque —
 * mais l'une ne conditionne jamais l'autre. C'est ce qui permet à l'import
 * depuis l'ordinateur de rester disponible quand Unsplash ne l'est pas.
 */
const supabaseAdmin = config.SUPABASE_URL
  ? createSupabaseAdmin(config)
  : undefined;
const mediaStore = supabaseAdmin
  ? createSupabaseMediaStore(supabaseAdmin)
  : undefined;
const unsplash = config.UNSPLASH_ACCESS_KEY
  ? new UnsplashService(config.UNSPLASH_ACCESS_KEY)
  : undefined;
const missionMedia = mediaStore
  ? new MissionMediaService(mediaStore, unsplash)
  : undefined;
const contractStore = supabaseAdmin
  ? createSupabaseContractStore(supabaseAdmin)
  : undefined;
const contractEmail =
  config.BREVO_API_KEY &&
  config.BREVO_SENDER_EMAIL &&
  config.BREVO_SENDER_NAME
    ? new BrevoEmailService(
        config.BREVO_API_KEY,
        {
          email: config.BREVO_SENDER_EMAIL,
          name: config.BREVO_SENDER_NAME,
        },
        eventLogger,
      )
    : undefined;
const contracts =
  db && contractStore
    ? new ContractService(
        db,
        contractStore,
        contractEmail,
        config.FRONTEND_URL,
        eventLogger,
      )
    : undefined;
const missions = db
  ? new MissionService(db, geocoder, events, missionMedia)
  : undefined;
const admin = db ? new AdminService(db) : undefined;
const applications = db
  ? new ApplicationService(db, events, contracts)
  : undefined;
const publicOffers = db ? new PublicJobOfferService(db) : undefined;
const server = createApp(
  config,
  accounts,
  workers,
  missions,
  admin,
  applications,
  publicOffers,
  missionMedia,
  contracts,
).listen(config.PORT, () =>
  // Capacités réellement actives : une variable manquante se voit ici, au boot,
  // et non au moment où un utilisateur clique. Aucune valeur secrète n'est journalisée.
  console.info(
    JSON.stringify({
      event: "server_started",
      port: config.PORT,
      environment: config.NODE_ENV,
      database: Boolean(db),
      google: Boolean(google),
      n8n_webhook: Boolean(events),
      public_offers: Boolean(publicOffers),
      mission_media: Boolean(missionMedia),
      unsplash: Boolean(unsplash),
      contracts: Boolean(contracts),
      brevo: Boolean(contractEmail),
      trust_proxy: config.TRUST_PROXY,
      frontend_url: config.FRONTEND_URL,
    }),
  ),
);
const recoverContracts = async () => {
  if (!contracts) return;
  try {
    await contracts.retryPendingDocuments();
    await contracts.retryPendingEmails();
  } catch {
    eventLogger.error(
      { error_code: "CONTRACT_RECOVERY_FAILED" },
      "contract_recovery_failed",
    );
  }
};
void recoverContracts();
const contractRecoveryTimer = contracts
  ? setInterval(() => void recoverContracts(), 60_000)
  : undefined;
contractRecoveryTimer?.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (contractRecoveryTimer) clearInterval(contractRecoveryTimer);
    server.close(() => {
      void (async () => {
        await db?.close();
        process.exit(0);
      })();
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
