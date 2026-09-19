import { useEffect } from "react";

export interface PageSeoOptions {
  title?: string;
  description?: string;
  robots?: string;
}

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

export function usePageSeo(options: PageSeoOptions) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    return applyPageSeo(options, document);
  }, [options.title, options.description, options.robots]);
}
