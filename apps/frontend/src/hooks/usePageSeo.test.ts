import { describe, it, expect, beforeEach } from "vitest";
import {
  applyPageSeo,
  applyPublicTags,
  SITE_URL,
  DEFAULT_SEO,
  type MinimalDocument,
  type MinimalMetaElement,
} from "./usePageSeo";

class MockMetaElement implements MinimalMetaElement {
  private attributes: Map<string, string> = new Map();
  public parent: MockDocument | null = null;

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    if (this.parent) {
      const idx = this.parent.elements.indexOf(this);
      if (idx !== -1) {
        this.parent.elements.splice(idx, 1);
      }
      this.parent = null;
    }
  }
}

class MockDocument implements MinimalDocument {
  public title = "InteriMatch · Plateforme hôtellerie & restauration";
  public elements: MockMetaElement[] = [];

  public head = {
    appendChild: (node: MinimalMetaElement) => {
      const mockNode = node as MockMetaElement;
      mockNode.parent = this;
      this.elements.push(mockNode);
    },
  };

  querySelector<T = MinimalMetaElement>(selector: string): T | null {
    const match = selector.match(/meta\[name="([^"]+)"\]/);
    if (match) {
      const name = match[1];
      const found = this.elements.find(
        (el) => el.getAttribute("name") === name,
      );
      return (found as unknown as T) ?? null;
    }
    return null;
  }

  createElement(tagName: string): MinimalMetaElement {
    if (tagName === "meta") {
      return new MockMetaElement();
    }
    throw new Error(`Unsupported tag: ${tagName}`);
  }
}

describe("usePageSeo / applyPageSeo", () => {
  let doc: MockDocument;

  beforeEach(() => {
    doc = new MockDocument();
    // Default tags like in index.html
    const descMeta = new MockMetaElement();
    descMeta.setAttribute("name", "description");
    descMeta.setAttribute("content", "InteriMatch, les missions de l’hôtellerie-restauration qui vous correspondent.");
    doc.head.appendChild(descMeta);

    const robotsMeta = new MockMetaElement();
    robotsMeta.setAttribute("name", "robots");
    robotsMeta.setAttribute("content", "noindex,nofollow");
    doc.head.appendChild(robotsMeta);
  });

  it("met à jour document.title et le restaure au démontage / cleanup", () => {
    const initialTitle = doc.title;
    const cleanup = applyPageSeo(
      { title: "Accueil · InteriMatch" },
      doc,
    );

    expect(doc.title).toBe("Accueil · InteriMatch");

    cleanup();
    expect(doc.title).toBe(initialTitle);
  });

  it("met à jour meta[name='description'] et restaure au cleanup", () => {
    const cleanup = applyPageSeo(
      { description: "Nouvelle description pour les professionnels." },
      doc,
    );

    const meta = doc.querySelector('meta[name="description"]');
    expect(meta?.getAttribute("content")).toBe("Nouvelle description pour les professionnels.");

    cleanup();
    expect(meta?.getAttribute("content")).toBe(
      "InteriMatch, les missions de l’hôtellerie-restauration qui vous correspondent.",
    );
  });

  it("met à jour meta[name='robots'] vers index,follow et restaure noindex,nofollow au cleanup", () => {
    const cleanup = applyPageSeo(
      { robots: "index,follow" },
      doc,
    );

    const meta = doc.querySelector('meta[name="robots"]');
    expect(meta?.getAttribute("content")).toBe("index,follow");

    cleanup();
    expect(meta?.getAttribute("content")).toBe("noindex,nofollow");
  });

  it("applique le robots par défaut noindex,nofollow si non spécifié", () => {
    // Supposons que le robots précédent était index,follow
    const robotsMeta = doc.querySelector('meta[name="robots"]');
    robotsMeta?.setAttribute("content", "index,follow");

    const cleanup = applyPageSeo(
      { title: "Espace privé" },
      doc,
    );

    expect(robotsMeta?.getAttribute("content")).toBe(DEFAULT_SEO.robots);

    cleanup();
    expect(robotsMeta?.getAttribute("content")).toBe("index,follow");
  });

  it("crée les balises meta si elles n'existaient pas initialement et les supprime au cleanup", () => {
    const emptyDoc = new MockDocument();

    const cleanup = applyPageSeo(
      {
        title: "Titre test",
        description: "Description test",
        robots: "index,follow",
      },
      emptyDoc,
    );

    const descMeta = emptyDoc.querySelector('meta[name="description"]');
    const robotsMeta = emptyDoc.querySelector('meta[name="robots"]');

    expect(descMeta).not.toBeNull();
    expect(descMeta?.getAttribute("content")).toBe("Description test");
    expect(robotsMeta).not.toBeNull();
    expect(robotsMeta?.getAttribute("content")).toBe("index,follow");

    cleanup();

    expect(emptyDoc.querySelector('meta[name="description"]')).toBeNull();
    expect(emptyDoc.querySelector('meta[name="robots"]')).toBeNull();
  });
});

/** Faux Document minimal pour applyPublicTags (balises link, meta, script). */
class FakeElement {
  attributes = new Map<string, string>();
  textContent = "";
  constructor(
    public tag: string,
    private owner: FakeDocument,
  ) {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  remove() {
    this.owner.nodes = this.owner.nodes.filter((node) => node !== this);
  }
}
class FakeDocument {
  nodes: FakeElement[] = [];
  head = { appendChild: (node: FakeElement) => this.nodes.push(node) };
  createElement(tag: string) {
    return new FakeElement(tag, this);
  }
}

describe("applyPublicTags (pages publiques)", () => {
  it("pose l'URL canonique, l'Open Graph et le JSON-LD, puis les retire", () => {
    const doc = new FakeDocument();
    const cleanup = applyPublicTags(
      {
        path: "/accessibilite",
        title: "Déclaration d’accessibilité · InteriMatch",
        description: "Déclaration d’accessibilité.",
        jsonLd: { "@context": "https://schema.org", "@type": "WebSite" },
      },
      doc as unknown as Document,
    );
    const canonical = doc.nodes.find((n) => n.getAttribute("rel") === "canonical");
    expect(canonical?.getAttribute("href")).toBe(`${SITE_URL}/accessibilite`);
    const og = (property: string) =>
      doc.nodes.find((n) => n.getAttribute("property") === property)?.getAttribute("content");
    expect(og("og:url")).toBe(`${SITE_URL}/accessibilite`);
    expect(og("og:title")).toBe("Déclaration d’accessibilité · InteriMatch");
    expect(og("og:locale")).toBe("fr_FR");
    const script = doc.nodes.find((n) => n.tag === "script");
    expect(JSON.parse(script!.textContent)["@type"]).toBe("WebSite");

    // En quittant la page, plus rien : une page privée n'hérite jamais du
    // canonical d'une page publique.
    cleanup();
    expect(doc.nodes).toHaveLength(0);
  });
});

