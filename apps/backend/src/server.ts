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
import { ContractService } from "./contracts/service.js";
import { N8nContractNotificationSender } from "./contracts/notification.js";
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
const n8nDelivery =
  config.N8N_WEBHOOK_URL && config.N8N_WEBHOOK_SECRET
    ? new N8nWebhookDelivery(
        config.N8N_WEBHOOK_URL,
        config.N8N_WEBHOOK_SECRET,
        eventLogger,
      )
    : undefined;
const events = n8nDelivery
  ? new AsyncBusinessEventPublisher(n8nDelivery, eventLogger)
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
const contractNotifications = n8nDelivery
  ? new N8nContractNotificationSender(n8nDelivery)
  : undefined;
const contracts =
  db && contractStore
    ? new ContractService(
        db,
        contractStore,
        contractNotifications,
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
      contract_notifications: Boolean(contractNotifications),
      trust_proxy: config.TRUST_PROXY,
      frontend_url: config.FRONTEND_URL,
    }),
  ),
);
const recoverContracts = async () => {
  if (!contracts) return;
  try {
    await contracts.reconcileAcceptedApplications();
    await contracts.retryPendingDocuments();
    await contracts.retryPendingNotifications();
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      /^[A-Za-z0-9_]{1,32}$/.test(String(error.code))
        ? String(error.code)
        : "CONTRACT_RECOVERY_FAILED";
    eventLogger.error(
      { error_code: code },
      "contract.recovery.failed",
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
