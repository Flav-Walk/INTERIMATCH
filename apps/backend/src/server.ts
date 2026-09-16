import "dotenv/config";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { AccountService } from "./auth/service.js";
import { createSupabaseAdmin } from "./integrations/clients.js";
import { HttpError } from "./errors.js";
const config = readConfig(process.env);
const db = config.DATABASE_URL ? createDatabase(config) : null;
const accounts = db
  ? new AccountService(db, async (jwt) => {
      const { data, error } =
        await createSupabaseAdmin(config).auth.getUser(jwt);
      if (
        error ||
        !data.user?.email ||
        !data.user.email_confirmed_at ||
        !data.user.identities?.some((i) => i.provider === "google")
      )
        throw new HttpError(
          401,
          "INVALID_GOOGLE_TOKEN",
          "Connexion Google invalide.",
        );
      return { id: data.user.id, email: data.user.email };
    })
  : undefined;
const server = createApp(config, accounts).listen(config.PORT, () =>
  console.info(JSON.stringify({ event: "server_started", port: config.PORT })),
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
