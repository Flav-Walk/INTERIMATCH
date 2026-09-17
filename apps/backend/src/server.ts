import "dotenv/config";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { AccountService } from "./auth/service.js";
import { createGoogleBridge } from "./auth/google.js";
import { WorkerService } from "./worker/service.js";
import { createAddressGeocoder } from "./worker/geocode.js";
const config = readConfig(process.env);
const db = config.DATABASE_URL ? createDatabase(config) : null;
const google = createGoogleBridge(config);
const accounts = db ? new AccountService(db, google) : undefined;
const workers = db ? new WorkerService(db, createAddressGeocoder()) : undefined;
const server = createApp(config, accounts, workers).listen(config.PORT, () =>
  // Capacités réellement actives : une variable manquante se voit ici, au boot,
  // et non au moment où un utilisateur clique. Aucune valeur secrète n'est journalisée.
  console.info(
    JSON.stringify({
      event: "server_started",
      port: config.PORT,
      environment: config.NODE_ENV,
      database: Boolean(db),
      google: Boolean(google),
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
