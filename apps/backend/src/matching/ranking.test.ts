import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app.js";
import { readConfig } from "../config.js";
import type { Db } from "../db.js";
import { AccountService } from "../auth/service.js";
import { MissionService } from "../missions/service.js";
import { WorkerService } from "../worker/service.js";
import { missionCreateSchema } from "../missions/schemas.js";

/**
 * Classement des missions proposées à un intérimaire.
 *
 * CE QUE CE FICHIER PROTÈGE. Le tri se faisait sur le score **arrondi**. Deux
 * missions à 69,6 % et 69,5 % s'affichent toutes deux « 70 % » : elles
 * devenaient donc équivalentes pour le tri, qui retombait alors sur l'ordre
 * dans lequel la base les avait rendues — c'est-à-dire sur rien de garanti.
 * L'ordre pouvait changer d'une requête à l'autre sans qu'aucune donnée n'ait
 * bougé, et aucun test n'aurait pu l'affirmer stable.
 *
 * Le classement se fait désormais sur le score réel, et la réduction à la forme
 * publique n'intervient qu'après. `raw_score` sert, puis reste à l'intérieur.
 *
 * COMMENT LES ÉCARTS SONT FABRIQUÉS. Les missions ne diffèrent que par leur
 * position : mêmes dates, même métier, aucune compétence, aucune exigence
 * d'expérience. Seules la proximité et le métier entrent alors dans le calcul,
 * et un écart de quelques centaines de mètres suffit à séparer deux scores qui
 * s'affichent identiques. Les coordonnées sont posées directement, sans
 * géocodage : un test de classement ne doit pas dépendre d'un service externe.
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

const LYON = { latitude: 45.75, longitude: 4.85 };
const geocode = vi.fn(async () => LYON);
const accounts = new AccountService(db, undefined, geocode);
const workers = new WorkerService(db, geocode);
const missions = new MissionService(db, geocode);
const app = createApp(
  readConfig({ NODE_ENV: "test", RATE_LIMIT: "1000" }),
  accounts,
  workers,
  missions,
);

const password = "Ranking-test-password-42!";
const auth = (call: request.Test, token: string) =>
  call.set("Authorization", `Bearer ${token}`);

let companyId = "";
let workerToken = "";

const slot = (dayOffset: number) => {
  const starts = new Date();
  starts.setUTCDate(starts.getUTCDate() + dayOffset);
  starts.setUTCHours(9, 0, 0, 0);
  return {
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 6 * 3_600_000).toISOString(),
  };
};

/**
 * Une mission publiée, placée où et quand on veut, avec l'identifiant qu'on veut.
 *
 * Aucune compétence et aucune exigence d'expérience : seules la proximité et le
 * métier sont alors évaluables, ce qui rend le score entièrement pilotable par
 * la latitude.
 *
 * `dayOffset` pilote l'ordre dans lequel la couche de lecture rend les
 * missions : `listOpen` trie par `starts_at`. C'est ce qui permet de placer
 * délibérément à l'entrée l'inverse de l'ordre attendu en sortie.
 *
 * `id` permet de choisir l'identifiant. Les UUID sont tirés au hasard : un test
 * de départage lexical qui les subirait passerait une fois sur deux par
 * coïncidence, et ne prouverait rien.
 */
async function missionAt(
  title: string,
  latitude: number,
  dayOffset: number,
  id?: string,
) {
  const created = await missions.create(
    companyId,
    missionCreateSchema.parse({
      title,
      job: "serveur",
      city: "Lyon",
      postal_code: "69002",
      ...slot(dayOffset),
    }),
  );
  await missions.publish(companyId, created);
  await db.query("UPDATE missions SET latitude=$2, longitude=$3 WHERE id=$1", [
    created,
    latitude,
    LYON.longitude,
  ]);
  if (!id) return created;
  // La mission vient d'être créée : aucune compétence, aucune candidature ne
  // la référence encore, la clé peut donc être reposée sans casser de lien.
  await db.query("UPDATE missions SET id=$2 WHERE id=$1", [created, id]);
  return id;
}

/** L'ordre dans lequel la couche de lecture rend les missions, avant tri. */
const sqlOrder = async (ids: string[]) => {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM missions
      WHERE id = ANY($1::uuid[]) ORDER BY starts_at`,
    [ids],
  );
  return rows.map((row) => row.id);
};

const proposed = async () => {
  const response = await auth(
    request(app).get("/api/v1/workers/me/missions"),
    workerToken,
  );
  expect(response.status).toBe(200);
  return response;
};

const orderedIds = async () =>
  (await proposed()).body.missions.map((m: { id: string }) => m.id);

beforeAll(async () => {
  for (const name of (await readdir("migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`migrations/${name}`, "utf8"));

  await db.query("INSERT INTO company_accounts(email,label) VALUES($1,'')", [
    "owner.ranking@example.test",
  ]);
  const owner = await accounts.register("owner.ranking@example.test", password);
  companyId = (await accounts.authenticate(owner.access_token)).id;

  const person = await accounts.register(
    "worker.ranking@example.test",
    password,
  );
  workerToken = person.access_token;
  const workerId = (await accounts.authenticate(workerToken)).id;
  await db.query(
    `INSERT INTO worker_profiles(
       profile_id,city,postal_code,latitude,longitude,mobility_radius_km,
       main_job,open_to_missions)
     VALUES($1,'Lyon','69002',$2,$3,100,'serveur',true)`,
    [workerId, LYON.latitude, LYON.longitude],
  );
  await db.query(
    `INSERT INTO availabilities(profile_id,starts_at,ends_at,status)
     VALUES($1,now(),now()+interval '90 days','available')`,
    [workerId],
  );
}, 30_000);

afterAll(() => pg.close());

describe("classement des missions proposées", () => {
  it("sépare deux scores réels que l'arrondi confond, à contre-courant de l'entrée", async () => {
    // TEST D. Il doit échouer si le tri revient à `b.match.score - a.match.score`.
    //
    // La précaution décisive est l'ORDRE D'ENTRÉE : la mission la MOINS bien
    // placée est créée en premier et commence plus tôt, donc `listOpen`
    // (`ORDER BY starts_at`) la rend en première. Les deux scores arrondis étant
    // égaux, un tri sur l'arrondi les déclarerait ex æquo et, étant stable,
    // conserverait cet ordre d'entrée — donc échouerait ici. Seul un tri sur le
    // score réel peut remonter la seconde devant la première.
    const loin = await missionAt(
      "Rang moins proche",
      LYON.latitude + 0.018,
      30,
    );
    const proche = await missionAt("Rang proche", LYON.latitude + 0.009, 31);

    // L'entrée est bien l'inverse de la sortie attendue.
    expect(await sqlOrder([proche, loin])).toEqual([loin, proche]);

    const body = (await proposed()).body.missions as {
      id: string;
      match: { score: number; distance_km: number | null };
    }[];
    const found = (id: string) => body.find((m) => m.id === id)!;

    // Les entrées diffèrent réellement : sans cela, ce test passerait par le
    // seul départage d'identifiant et ne prouverait rien du tri.
    expect(found(proche).match.distance_km).toBeLessThan(
      found(loin).match.distance_km!,
    );
    // Le même nombre à l'écran…
    expect(found(proche).match.score).toBe(found(loin).match.score);
    // …et pourtant un ordre inversé par rapport à l'entrée, parce que le tri
    // voit ce que l'affichage cache.
    const ids = body.map((m) => m.id);
    expect(ids.indexOf(proche)).toBeLessThan(ids.indexOf(loin));
  });

  it("départage deux scores identiques par l'identifiant, à contre-courant de l'entrée", async () => {
    // TEST E. Il doit échouer si le départage par identifiant disparaît.
    //
    // Les UUID sont tirés au hasard : un test qui les subirait passerait une
    // fois sur deux par coïncidence. Ils sont donc imposés, et choisis pour que
    // l'ordre lexical attendu soit exactement l'INVERSE de l'ordre d'entrée.
    //
    // Coordonnées strictement égales → scores réels identiques au bit près :
    // le tri principal ne peut pas les séparer, seul le départage le peut.
    const TARD = "ffffffff-0000-4000-8000-00000000000f";
    const TOT = "00000000-0000-4000-8000-000000000001";
    expect(TOT.localeCompare(TARD)).toBeLessThan(0);

    // Créée en premier ET commençant plus tôt : première à l'entrée…
    const premiereEntree = await missionAt(
      "Rang ex aequo tardif",
      LYON.latitude,
      32,
      TARD,
    );
    // …alors que son identifiant la place en DERNIÈRE position attendue.
    const secondeEntree = await missionAt(
      "Rang ex aequo precoce",
      LYON.latitude,
      33,
      TOT,
    );
    expect(await sqlOrder([TARD, TOT])).toEqual([
      premiereEntree,
      secondeEntree,
    ]);

    const ids = await orderedIds();
    const observe = ids.filter((id: string) => id === TARD || id === TOT);
    // Sans départage, on lirait [TARD, TOT] — l'ordre d'entrée conservé par un
    // tri stable sur des valeurs égales.
    expect(observe).toEqual([TOT, TARD]);

    // Et la propriété tient d'une lecture à l'autre.
    const relu = (await orderedIds()).filter(
      (id: string) => id === TARD || id === TOT,
    );
    expect(relu).toEqual([TOT, TARD]);
  });

  it("rend le même ordre à chaque appel", async () => {
    // La propriété qui manquait : un classement qui change tout seul n'est pas
    // un classement. Trois lectures consécutives, sans aucune écriture entre.
    const [un, deux, trois] = [
      await orderedIds(),
      await orderedIds(),
      await orderedIds(),
    ];
    expect(deux).toEqual(un);
    expect(trois).toEqual(un);
  });

  it("classe bien du plus compatible au moins compatible", async () => {
    // Le tri reste un tri : l'ordre des scores affichés ne doit jamais remonter.
    const scores = (await proposed()).body.missions.map(
      (m: { match: { score: number } }) => m.match.score,
    );
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
  });

  it("n'expose jamais le score non arrondi", async () => {
    // Le tri s'en sert, la réponse ne le porte pas. C'est la conclusion qui
    // traverse la frontière, pas la donnée qui permettrait de la refaire.
    const response = await proposed();
    expect(JSON.stringify(response.body)).not.toContain("raw_score");
    for (const mission of response.body.missions)
      expect(Object.keys(mission.match)).not.toContain("raw_score");
  });

  it("porte le palier métier sur chaque mission proposée", async () => {
    // Ce que le frontend consomme au lieu de recalculer `score >= 70`.
    for (const mission of (await proposed()).body.missions) {
      expect([70, 60, 50, null]).toContain(mission.match.band);
      if (mission.match.band === null)
        expect(mission.match.band_label).toBe(null);
      else expect(typeof mission.match.band_label).toBe("string");
    }
  });
});
