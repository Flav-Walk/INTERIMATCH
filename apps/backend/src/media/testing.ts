import { MissionMediaService, type MediaStore } from "./service.js";
import { UnsplashService } from "./unsplash.js";
import type { MissionMediaInput } from "./schemas.js";

/**
 * Doublures du stockage et d'Unsplash, pour les tests.
 *
 * Exclu du build de production par `tsconfig.build.json`, au même titre que les
 * fichiers de test eux-mêmes : rien de ceci ne doit se retrouver dans `dist`.
 *
 * POURQUOI UNE DOUBLURE PLUTÔT QU'UN SERVICE ABSENT. Depuis que la photo est
 * obligatoire à la publication, un test qui publie décrit un parcours complet.
 * Lui donner un stockage en mémoire, c'est lui permettre d'exprimer cette
 * exigence sans réseau ni secret — et non la contourner.
 */
export function memoryMediaStore() {
  const files = new Map<string, Uint8Array>();
  const store: MediaStore = {
    async upload(path, body) {
      files.set(path, body);
    },
    publicUrl: (path) => `https://storage.test/${path}`,
    async remove(path) {
      if (!files.delete(path)) throw new Error(`absent: ${path}`);
    },
  };
  return { store, files };
}

/**
 * Service média de test. Sans Unsplash par défaut : la plupart des parcours ne
 * concernent que l'import, et un test qui ne demande pas la bibliothèque ne
 * doit pas avoir à la simuler.
 */
export function memoryMediaService(unsplash?: UnsplashService) {
  const { store, files } = memoryMediaStore();
  return Object.assign(new MissionMediaService(store, unsplash), {
    /** Fichiers réellement déposés, pour vérifier dépôt et nettoyage. */
    testFiles: files,
  });
}

/** Chemin d'un fichier déjà déposé par cette entreprise. */
export const storagePathFor = (companyId: string, name = "photo.jpg") =>
  `${MissionMediaService.prefixFor(companyId)}${name}`;

/** Média d'entrée valide pour une mission de cette entreprise. */
export const uploadedMedia = (companyId: string): MissionMediaInput => ({
  provider: "upload",
  storage_path: storagePathFor(companyId),
});

/** Photo Unsplash telle que leur API la renvoie, réduite à ce que nous lisons. */
export const unsplashPhoto = (id = "photo-1") => ({
  id,
  alt_description: "Salle de restaurant dressée",
  urls: {
    regular: `https://images.unsplash.com/${id}?ixid=abc&w=1080`,
    small: `https://images.unsplash.com/${id}?ixid=abc&w=400`,
  },
  links: {
    download_location: `https://api.unsplash.com/photos/${id}/download`,
  },
  user: {
    name: "Camille Photographe",
    links: { html: "https://unsplash.com/@camille" },
  },
});

/**
 * Unsplash simulé. `calls` retient les URL appelées : c'est ce qui permet de
 * vérifier que le point de comptage exigé par leurs conditions est bien
 * déclenché, et une seule fois.
 */
export function fakeUnsplash(
  handler: (url: string) => { status?: number; body?: unknown } = () => ({}),
) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { service: new UnsplashService("test-access-key", fetchImpl), calls };
}

/**
 * Stockage des serveurs éphémères — recette humaine et suite navigateur.
 *
 * Les fichiers ne quittent jamais la mémoire, et toutes les URL publiques
 * pointent vers le MÊME visuel local, servi par le frontend de recette. C'est
 * ce qui rend l'écran reproductible : une photo importée pendant un parcours
 * s'affiche, sans qu'aucun octet ne sorte de la machine ni qu'un compartiment
 * distant soit touché.
 */
export const LOCAL_FIXTURE_IMAGE = "/images/fixtures/mission.jpg";

export function localFixtureMediaStore(): MediaStore {
  const files = new Map<string, Uint8Array>();
  return {
    async upload(path, body) {
      files.set(path, body);
    },
    publicUrl: () => LOCAL_FIXTURE_IMAGE,
    async remove(path) {
      files.delete(path);
    },
  };
}
