import "dotenv/config";
import pino from "pino";
import { createApp } from "./app.js";
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
import {
  AsyncBusinessEventPublisher,
  N8nWebhookDelivery,
} from "./events/dispatcher.js";
const config = readConfig(process.env);
const db = config.DATABASE_URL ? createDatabase(config) : null;
const google = createGoogleBridge(config);
// Un seul géocodeur pour les trois services : comptes, intérimaires, missions.
const geocoder = createAddressGeocoder();
const accounts = db ? new AccountService(db, google, geocoder) : undefined;
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
const missions = db ? new MissionService(db, geocoder, events) : undefined;
const admin = db ? new AdminService(db) : undefined;
const applications = db ? new ApplicationService(db, events) : undefined;
const publicOffers = db ? new PublicJobOfferService(db) : undefined;
const server = createApp(
  config,
  accounts,
  workers,
  missions,
  admin,
  applications,
  publicOffers,
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
      trust_proxy: config.TRUST_PROXY,
      frontend_url: config.FRONTEND_URL,
    }),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void (async () => {
        await db?.close();
        process.exit(0);
      })();
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
