import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { MissionService } from "../missions/service.js";
import { MissionMediaService } from "./service.js";
import { UnsplashService, withReferral } from "./unsplash.js";
import { sniffImageType, MAX_IMAGE_BYTES } from "./schemas.js";
import { fakeUnsplash, memoryMediaStore, unsplashPhoto } from "./testing.js";

/**
 * Photo d'une mission : import, bibliothèque Unsplash, et la règle qui lie les
 * deux — une mission ne se publie pas sans image.
 *
 * Joué contre une vraie base : le déclencheur de la migration 010 est vérifié
 * par le moteur, y compris sur le chemin qui contourne le service.
 */
const pg = new PGlite();
const db: Db = {
  query: (sql, values) => pg.query(sql, values),
  transaction: (work) =>
    pg.transaction((tx) =>
      work({
        query: (sql, values) => tx.query(sql, values),
        transaction: () => {
          throw new Error("nested");
        },
      }),
    ),
};

const jpeg = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
};
const png = () => {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
};
const webp = () => {
  const bytes = new Uint8Array(32);
  bytes.set([...Buffer.from("RIFF")], 0);
  bytes.set([...Buffer.from("WEBP")], 8);
  return bytes;
};

const password = "Media-test-password-42!";
const auth = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

const futureSlot = () => {
  const starts = new Date(Date.now() + 5 * 86_400_000);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 6 * 3_600_000).toISOString(),
  };
};

const { service: unsplash, calls } = fakeUnsplash((url) =>
  url.includes("/search/photos")
    ? {
        body: {
          total: 1,
          total_pages: 1,
          results: [unsplashPhoto("salle-1")],
        },
      }
    : url.includes("/photos/salle-1/download")
      ? { body: { url: "https://images.unsplash.com/salle-1" } }
      : url.includes("/photos/inconnue")
        ? { status: 404 }
        : { body: unsplashPhoto("salle-1") },
);

const { store, files } = memoryMediaStore();
const media = new MissionMediaService(store, unsplash);
const accounts = new AccountService(db);
const missions = new MissionService(db, undefined, undefined, media);
const app = createApp(
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "100000" }),
  accounts,
  undefined,
  missions,
  undefined,
  undefined,
  undefined,
  media,
);

let owner = "";
let ownerId = "";
let rival = "";
let rivalId = "";
let worker = "";

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((entry) => entry.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));
  await pg.query("INSERT INTO company_accounts(email,label) VALUES($1,$2)", [
    "media.owner@example.test",
    "T",
  ]);
  await pg.query("INSERT INTO company_accounts(email,label) VALUES($1,$2)", [
    "media.rival@example.test",
    "T",
  ]);
  owner = (await accounts.register("media.owner@example.test", password))
    .access_token;
  ownerId = (await accounts.authenticate(owner)).id;
  rival = (await accounts.register("media.rival@example.test", password))
    .access_token;
  rivalId = (await accounts.authenticate(rival)).id;
  worker = (await accounts.register("media.worker@example.test", password))
    .access_token;
});

const draft = (over: Record<string, unknown> = {}) => ({
  title: "Mission avec photo",
  job: "serveur",
  city: "Lyon",
  postal_code: "69002",
  description: "",
  address: "",
  pay_amount: null,
  pay_unit: null,
  headcount: 1,
  min_years_experience: null,
  required_skill_ids: [],
  desired_skill_ids: [],
  ...futureSlot(),
  ...over,
});

describe("import d'une photo", () => {
  it("accepte les trois formats et nomme le fichier lui-même", async () => {
    for (const [bytes, extension] of [
      [jpeg(), "jpg"],
      [png(), "png"],
      [webp(), "webp"],
    ] as const) {
      const stored = await media.upload(ownerId, bytes);
      expect(stored.provider).toBe("upload");
      // Le chemin porte l'entreprise : c'est ce qui rend la propriété vérifiable.
      expect(stored.storage_path.startsWith(`missions/${ownerId}/`)).toBe(true);
      expect(stored.storage_path.endsWith(`.${extension}`)).toBe(true);
      expect(files.has(stored.storage_path)).toBe(true);
    }
  });

  it("lit le type dans les octets, pas dans l'en-tête déclaré", async () => {
    expect(sniffImageType(jpeg())).toBe("image/jpeg");
    expect(sniffImageType(png())).toBe("image/png");
    expect(sniffImageType(webp())).toBe("image/webp");
    // Un exécutable annoncé comme une image reste un exécutable.
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]);
    expect(sniffImageType(elf)).toBeNull();
  });

  it("refuse un contenu qui n'est pas une image", async () => {
    await expect(
      media.upload(ownerId, new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("refuse un fichier vide ou trop lourd", async () => {
    await expect(media.upload(ownerId, new Uint8Array())).rejects.toMatchObject(
      {
        status: 400,
        code: "EMPTY_FILE",
      },
    );
    await expect(
      media.upload(ownerId, jpeg(MAX_IMAGE_BYTES + 1)),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
  });

  it("n'est ouvert qu'aux comptes entreprise", async () => {
    const refused = await auth(
      request(app)
        .post("/api/v1/company/media")
        .set("content-type", "image/jpeg"),
      worker,
    ).send(Buffer.from(jpeg()));
    expect(refused.status).toBe(403);
    const anonymous = await request(app)
      .post("/api/v1/company/media")
      .set("content-type", "image/jpeg")
      .send(Buffer.from(jpeg()));
    expect(anonymous.status).toBe(401);
  });

  it("dépose le fichier et renvoie son chemin par l'API", async () => {
    const response = await auth(
      request(app)
        .post("/api/v1/company/media")
        .set("content-type", "image/png"),
      owner,
    ).send(Buffer.from(png()));
    expect(response.status).toBe(201);
    expect(response.body.provider).toBe("upload");
    expect(response.body.url).toMatch(/^https:\/\//);
  });
});

describe("cloisonnement des photos entre entreprises", () => {
  it("refuse à une entreprise le fichier déposé par une autre", async () => {
    const theirs = await media.upload(rivalId, jpeg());
    await expect(
      media.resolve(ownerId, {
        provider: "upload",
        storage_path: theirs.storage_path,
      }),
    ).rejects.toMatchObject({ status: 403, code: "MEDIA_FORBIDDEN" });
  });

  it("refuse la même chose au travers de la création de mission", async () => {
    const theirs = await media.upload(rivalId, jpeg());
    const response = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        media: { provider: "upload", storage_path: theirs.storage_path },
      }),
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEDIA_FORBIDDEN");
  });

  it("n'accepte pas une URL fournie par le client", async () => {
    // L'URL est redérivée du chemin : l'envoyer est une propriété en trop.
    const mine = await media.upload(ownerId, jpeg());
    const response = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        media: {
          provider: "upload",
          storage_path: mine.storage_path,
          url: "https://ailleurs.example/pixel.gif",
        },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("bibliothèque Unsplash", () => {
  it("cherche côté serveur et ne renvoie que ce qui sert à choisir", async () => {
    const found = await media.searchUnsplash("restaurant", 1);
    expect(found.results).toHaveLength(1);
    const [photo] = found.results;
    expect(photo.id).toBe("salle-1");
    // Les URL sont celles d'Unsplash, avec leur `ixid` : leurs conditions
    // imposent d'afficher l'image depuis leur CDN, sans réécriture.
    expect(photo.thumb_url).toContain("images.unsplash.com");
    expect(photo.thumb_url).toContain("ixid=");
    // L'attribution voyage avec la photo, dès la recherche.
    expect(photo.author_name).toBe("Camille Photographe");
    expect(photo.author_url).toContain("utm_source=interimatch");
    expect(photo.author_url).toContain("utm_medium=referral");
  });

  it("ajoute les paramètres de référencement sans casser le lien", () => {
    expect(withReferral("https://unsplash.com/@camille")).toBe(
      "https://unsplash.com/@camille?utm_source=interimatch&utm_medium=referral",
    );
  });

  it("déclenche le comptage d'usage à la sélection, et une seule fois", async () => {
    calls.length = 0;
    const resolved = await media.resolve(ownerId, {
      provider: "unsplash",
      external_id: "salle-1",
    });
    expect(resolved).toMatchObject({
      provider: "unsplash",
      external_id: "salle-1",
      author_name: "Camille Photographe",
    });
    const downloads = calls.filter((url) => url.includes("/download"));
    expect(downloads).toHaveLength(1);
  });

  it("ne conserve jamais le lien de comptage avec la photo", async () => {
    const resolved = await media.resolve(ownerId, {
      provider: "unsplash",
      external_id: "salle-1",
    });
    expect(Object.keys(resolved)).not.toContain("download_location");
  });

  it("signale une photo disparue", async () => {
    await expect(
      media.resolve(ownerId, { provider: "unsplash", external_id: "inconnue" }),
    ).rejects.toMatchObject({ status: 404, code: "UNSPLASH_PHOTO_NOT_FOUND" });
  });

  it("dit quoi faire quand le quota est atteint", async () => {
    const limited = new UnsplashService(
      "k",
      (async () => new Response("{}", { status: 429 })) as typeof fetch,
    );
    await expect(limited.search("bar", 1)).rejects.toMatchObject({
      status: 503,
      code: "UNSPLASH_RATE_LIMITED",
    });
  });

  it("laisse l'import disponible quand la bibliothèque est en panne", async () => {
    const down = new UnsplashService("k", (async () => {
      throw new Error("réseau");
    }) as typeof fetch);
    const degraded = new MissionMediaService(memoryMediaStore().store, down);
    await expect(degraded.searchUnsplash("bar", 1)).rejects.toMatchObject({
      code: "UNSPLASH_UNAVAILABLE",
    });
    // L'autre voie reste entière : c'est tout l'intérêt de deux fournisseurs.
    const stored = await degraded.upload(ownerId, jpeg());
    expect(stored.provider).toBe("upload");
  });

  it("n'expose pas la bibliothèque quand aucune clé n'est configurée", async () => {
    const withoutKey = new MissionMediaService(memoryMediaStore().store);
    expect(withoutKey.unsplashEnabled).toBe(false);
    await expect(withoutKey.searchUnsplash("bar", 1)).rejects.toMatchObject({
      code: "UNSPLASH_NOT_CONFIGURED",
    });
  });
});

describe("photo obligatoire à la publication", () => {
  it("refuse de publier une mission sans photo", async () => {
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(draft({ title: "Sans photo" }));
    expect(created.status).toBe(201);
    expect(created.body.media).toBeNull();
    const refused = await auth(
      request(app).post(`/api/v1/missions/${created.body.id}/publish`),
      owner,
    ).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("MISSION_MEDIA_REQUIRED");
    expect(refused.body.error.message).toBe(
      "Ajoutez une photo pour publier cette mission.",
    );
  });

  it("publie dès que la photo est ajoutée", async () => {
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(draft({ title: "Photo ajoutée ensuite" }));
    const mine = await media.upload(ownerId, jpeg());
    await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({
      media: { provider: "upload", storage_path: mine.storage_path },
    });
    const published = await auth(
      request(app).post(`/api/v1/missions/${created.body.id}/publish`),
      owner,
    ).send({});
    expect(published.status).toBe(200);
    expect(published.body.media.provider).toBe("upload");
  });

  /**
   * Le déclencheur, et non le service : c'est la garantie qui tient même quand
   * on écrit en SQL — ce que font le seed et les jeux de recette.
   */
  it("tient la règle en base, même sans passer par le service", async () => {
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(draft({ title: "Contournement" }));
    await expect(
      db.query(
        "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
        [created.body.id],
      ),
    ).rejects.toThrow(/MISSION_MEDIA_REQUIRED/);
  });

  /**
   * Compatibilité : une mission publiée AVANT cette évolution n'a pas de photo,
   * et doit rester pilotable. Le déclencheur ne juge que la transition.
   */
  it("laisse vivre une mission publiée avant l'arrivée de la photo", async () => {
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(draft({ title: "Héritée" }));
    // Ligne telle qu'elle existait avant la migration : publiée, sans média.
    await db.query(
      `UPDATE missions SET status='open', published_at=now()
         WHERE id=$1 AND false`,
      [created.body.id],
    );
    await db.query(
      "ALTER TABLE missions DISABLE TRIGGER missions_media_required",
    );
    await db.query(
      "UPDATE missions SET status='open', published_at=now() WHERE id=$1",
      [created.body.id],
    );
    await db.query(
      "ALTER TABLE missions ENABLE TRIGGER missions_media_required",
    );
    // Elle se modifie et s'annule sans jamais réclamer de photo.
    const renamed = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({ title: "Héritée et renommée" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.media).toBeNull();
    const cancelled = await auth(
      request(app).post(`/api/v1/missions/${created.body.id}/cancel`),
      owner,
    ).send({});
    expect(cancelled.status).toBe(200);
  });
});

describe("modification de la photo", () => {
  it("conserve la photo quand la requête ne la mentionne pas", async () => {
    const mine = await media.upload(ownerId, jpeg());
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Photo conservée",
        media: { provider: "upload", storage_path: mine.storage_path },
      }),
    );
    const renamed = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({ title: "Toujours la même photo" });
    expect(renamed.body.media.storage_path).toBe(mine.storage_path);
    expect(files.has(mine.storage_path)).toBe(true);
  });

  it("remplace un import et efface l'ancien fichier", async () => {
    const first = await media.upload(ownerId, jpeg());
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Photo remplacée",
        media: { provider: "upload", storage_path: first.storage_path },
      }),
    );
    const second = await media.upload(ownerId, png());
    const updated = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({
      media: { provider: "upload", storage_path: second.storage_path },
    });
    expect(updated.body.media.storage_path).toBe(second.storage_path);
    expect(files.has(first.storage_path)).toBe(false);
    expect(files.has(second.storage_path)).toBe(true);
  });

  it("remplace un import par une photo Unsplash, créditée", async () => {
    const first = await media.upload(ownerId, jpeg());
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Vers Unsplash",
        media: { provider: "upload", storage_path: first.storage_path },
      }),
    );
    const updated = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({ media: { provider: "unsplash", external_id: "salle-1" } });
    expect(updated.body.media).toMatchObject({
      provider: "unsplash",
      author_name: "Camille Photographe",
    });
    expect(updated.body.media.author_url).toContain("utm_source=interimatch");
    // Le fichier importé n'a plus de raison d'exister.
    expect(files.has(first.storage_path)).toBe(false);
  });

  it("ne cherche pas à effacer une photo Unsplash : rien n'a été copié", async () => {
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Unsplash puis import",
        media: { provider: "unsplash", external_id: "salle-1" },
      }),
    );
    const mine = await media.upload(ownerId, jpeg());
    const updated = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      owner,
    ).send({ media: { provider: "upload", storage_path: mine.storage_path } });
    expect(updated.status).toBe(200);
    expect(updated.body.media.provider).toBe("upload");
  });

  it("refuse à une entreprise de toucher au média d'une mission d'une autre", async () => {
    const mine = await media.upload(ownerId, jpeg());
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Mission du propriétaire",
        media: { provider: "upload", storage_path: mine.storage_path },
      }),
    );
    const theirs = await media.upload(rivalId, jpeg());
    const refused = await auth(
      request(app).patch(`/api/v1/missions/${created.body.id}`),
      rival,
    ).send({
      media: { provider: "upload", storage_path: theirs.storage_path },
    });
    // Introuvable, et non « interdit » : on ne révèle pas l'existence d'une
    // mission qui n'appartient pas à l'appelant.
    expect(refused.status).toBe(404);
    const untouched = await auth(
      request(app).get(`/api/v1/missions/${created.body.id}`),
      owner,
    );
    expect(untouched.body.media.storage_path).toBe(mine.storage_path);
  });
});

describe("média servi aux intérimaires", () => {
  it("accompagne la mission publiée jusqu'à l'espace intérimaire", async () => {
    const mine = await media.upload(ownerId, jpeg());
    const created = await auth(
      request(app).post("/api/v1/missions"),
      owner,
    ).send(
      draft({
        title: "Visible côté intérimaire",
        media: { provider: "upload", storage_path: mine.storage_path },
      }),
    );
    await auth(
      request(app).post(`/api/v1/missions/${created.body.id}/publish`),
      owner,
    ).send({});
    const detail = await auth(
      request(app).get(`/api/v1/workers/me/missions/${created.body.id}`),
      worker,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.media.url).toMatch(/^https:\/\//);
  });
});
