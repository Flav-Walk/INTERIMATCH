import { useEffect } from "react";

export interface PageSeoOptions {
  title?: string;
  description?: string;
  robots?: string;
  /**
   * Chemin PUBLIC de la page (« / », « /accessibilite »…). À donner
   * uniquement pour les pages indexables : il active l'URL canonique et les
   * balises de partage Open Graph (voir applyPublicTags).
   */
  path?: string;
  /** Données structurées schema.org (JSON-LD), pour l'accueil. */
  jsonLd?: Record<string, unknown>;
}

/** Adresse publique du site, la même que dans public/sitemap.xml. */
export const SITE_URL = "https://interimatch-five.vercel.app";

export const DEFAULT_SEO = {
  title: "InteriMatch · Plateforme hôtellerie & restauration",
  description:
    "InteriMatch, les missions de l’hôtellerie-restauration qui vous correspondent.",
  robots: "noindex,nofollow",
} as const;

export interface MinimalMetaElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
}

export interface MinimalDocument {
  title: string;
  head: {
    appendChild(node: unknown): unknown;
  };
  querySelector<T = MinimalMetaElement>(selector: string): T | null;
  createElement(tagName: string): MinimalMetaElement;
}

function updateMetaTag(
  doc: MinimalDocument,
  name: string,
  content: string | undefined,
): () => void {
  if (content === undefined) return () => {};

  let meta = doc.querySelector<MinimalMetaElement>(`meta[name="${name}"]`);
  let created = false;
  const previousContent = meta ? meta.getAttribute("content") : null;

  if (!meta) {
    const newMeta = doc.createElement("meta");
    newMeta.setAttribute("name", name);
    doc.head.appendChild(newMeta);
    meta = newMeta;
    created = true;
  }

  meta.setAttribute("content", content);

  return () => {
    if (created) {
      meta.remove();
    } else if (previousContent !== null) {
      meta.setAttribute("content", previousContent);
    }
  };
}

export function applyPageSeo(
  options: PageSeoOptions,
  doc: MinimalDocument = document,
): () => void {
  const previousTitle = doc.title;
  if (options.title !== undefined) {
    doc.title = options.title;
  }

  const cleanupDescription = updateMetaTag(
    doc,
    "description",
    options.description,
  );
  const cleanupRobots = updateMetaTag(
    doc,
    "robots",
    options.robots ?? DEFAULT_SEO.robots,
  );

  return () => {
    if (options.title !== undefined) {
      doc.title = previousTitle;
    }
    cleanupDescription();
    cleanupRobots();
  };
}

/**
 * Balises des pages PUBLIQUES uniquement (SEO) :
 * - <link rel="canonical"> : une seule URL de référence par page ;
 * - Open Graph (og:*) : titre, description et adresse lors d'un partage ;
 * - JSON-LD schema.org si fourni (accueil : Organization + WebSite).
 * Tout est retiré au démontage : une page privée ne garde jamais le
 * canonical d'une page publique visitée juste avant.
 */
export function applyPublicTags(
  options: PageSeoOptions & { path: string },
  doc: Document = document,
): () => void {
  const created: Element[] = [];
  const add = (tag: string, attributes: Record<string, string>) => {
    const element = doc.createElement(tag);
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    element.setAttribute("data-page-seo", "");
    doc.head.appendChild(element);
    created.push(element);
  };
  const url = new URL(options.path, SITE_URL).toString();
  add("link", { rel: "canonical", href: url });
  add("meta", { property: "og:type", content: "website" });
  add("meta", { property: "og:site_name", content: "InteriMatch" });
  add("meta", { property: "og:locale", content: "fr_FR" });
  add("meta", { property: "og:url", content: url });
  if (options.title) add("meta", { property: "og:title", content: options.title });
  if (options.description)
    add("meta", { property: "og:description", content: options.description });
  if (options.jsonLd) {
    const script = doc.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-page-seo", "");
    script.textContent = JSON.stringify(options.jsonLd);
    doc.head.appendChild(script);
    created.push(script);
  }
  return () => created.forEach((element) => element.remove());
}

export function usePageSeo(options: PageSeoOptions) {
  // Les données structurées changent rarement : on compare leur texte.
  const jsonLd = options.jsonLd ? JSON.stringify(options.jsonLd) : undefined;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleanupBase = applyPageSeo(options, document);
    const cleanupPublic = options.path
      ? applyPublicTags({ ...options, path: options.path }, document)
      : () => {};
    return () => {
      cleanupPublic();
      cleanupBase();
    };
    // `options` est reconstruit à chaque rendu : on suit ses valeurs.
  }, [options.title, options.description, options.robots, options.path, jsonLd]);
}
