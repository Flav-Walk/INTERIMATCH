import { useEffect, type RefObject } from "react";
import { animate } from "motion";
import { EASE } from "./motion";

/*
 * Motion sur tout le site, sans modifier les pages.
 *
 * Sur l'accueil, les blocs apparaissent au scroll en montant et en sortant
 * d'un léger flou. Ce hook applique le même effet aux blocs récurrents des
 * pages internes (cartes, panneaux, sections de profil, lignes de listes).
 * Il est appelé une seule fois, dans AppLayout.
 *
 * Fonctionnement :
 * 1. À chaque changement de page, on cherche les blocs listés dans SELECTOR.
 * 2. On les cache (opacity 0) et on les observe avec un IntersectionObserver.
 * 3. Quand un bloc entre à l'écran, animate() de Motion le fait apparaître,
 *    une seule fois. Les blocs voisins partent l'un après l'autre (décalage
 *    selon leur rang, plafonné pour ne jamais faire attendre).
 * 4. Un MutationObserver rattrape les blocs qui arrivent plus tard (données
 *    chargées après l'affichage de la page).
 *
 * Ce qui est exclu :
 * - l'accueil, qui a ses propres animations ;
 * - un bloc déjà animé par un composant Motion (il porte déjà une opacité
 *   en style inline au moment où on le trouve) ;
 * - tout, si « Réduire les animations » est activé.
 */

const SELECTOR = [
  ".detail-card",
  ".rail-card",
  ".side-panel",
  ".mission-card",
  ".public-offer-card",
  ".profile-overview",
  ".profile-section",
  ".application-card",
  ".application-row",
  ".document-list > li",
  ".document-sheet",
  ".matched-profile-list > li",
  ".agenda-item",
  ".worker-application-list > li",
  ".application-cards > *",
].join(",");

/** Rang d'un bloc parmi ses voisins animés, pour décaler les départs. */
function rank(el: Element) {
  let i = 0;
  let prev = el.previousElementSibling;
  while (prev && i < 6) {
    if (prev.matches(SELECTOR)) i++;
    prev = prev.previousElementSibling;
  }
  return i;
}

export function useSiteReveal(
  root: RefObject<HTMLElement | null>,
  pageKey: string,
  disabled: boolean,
) {
  useEffect(() => {
    const container = root.current;
    if (disabled || !container || pageKey === "/") return;

    const seen = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el); // une seule fois
          delete el.dataset.siteReveal; // révélé : plus à restaurer
          animate(
            el,
            {
              opacity: [0, 1],
              transform: ["translateY(16px)", "translateY(0px)"],
              filter: ["blur(6px)", "blur(0px)"],
            },
            { duration: 0.6, ease: EASE, delay: rank(el) * 0.07 },
          ).then(() => {
            // On rend la main au CSS (survol, transitions des cartes).
            el.style.removeProperty("transform");
            el.style.removeProperty("filter");
          });
        }
      },
      { rootMargin: "0px 0px -40px 0px" },
    );

    const scan = () => {
      // Sécurité : dans un onglet en arrière-plan, le navigateur ne signale
      // pas l'entrée à l'écran. On n'y cache donc rien, pour ne jamais
      // laisser un bloc invisible.
      if (document.visibilityState === "hidden") return;
      container.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // Déjà piloté par un composant Motion : on n'y touche pas.
        if (el.style.opacity !== "") return;
        el.style.opacity = "0";
        // Marque « caché par nous » : distingue notre opacity 0 de celle
        // d'un composant Motion (voir le nettoyage plus bas).
        el.dataset.siteReveal = "pending";
        observer.observe(el);
      });
    };

    scan();
    // Deuxième sécurité : si un bloc caché n'a toujours pas été révélé
    // quand l'onglet repasse au second plan puis revient, on l'affiche.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      container.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (!seen.has(el)) return;
        const r = el.getBoundingClientRect();
        if (el.style.opacity === "0" && r.top < window.innerHeight) {
          observer.unobserve(el);
          delete el.dataset.siteReveal;
          el.style.opacity = "1";
        }
      });
      scan();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Les données arrivent souvent après l'affichage : on rescanne au besoin,
    // au plus une fois par image affichée.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mutations.observe(container, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
      // Correctif « page vide » : si l'effet se relance (StrictMode en dev,
      // changement de route), les blocs cachés ici mais pas encore révélés
      // gardaient opacity 0. Au scan suivant, ce style inline les faisait
      // passer pour « pilotés par Motion » : plus jamais observés, donc
      // invisibles pour toujours. On rend la main proprement : le prochain
      // scan les recache et les observe à nouveau.
      container
        .querySelectorAll<HTMLElement>('[data-site-reveal="pending"]')
        .forEach((el) => {
          el.style.removeProperty("opacity");
          delete el.dataset.siteReveal;
        });
    };
  }, [root, pageKey, disabled]);
}
