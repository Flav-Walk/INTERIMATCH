/* global window, document, location, console, setTimeout */
/*
 * Audit d'accessibilité automatique d'une page (axe-core, WCAG 2.1 A + AA).
 *
 * Usage : lancer `npm run dev:demo`, ouvrir une page, coller ce fichier
 * dans la console du navigateur (outils de développement), puis Entrée.
 * Aucune dépendance à installer : axe-core est chargé depuis cdnjs.
 *
 * Ce que fait le script :
 * 1. fait défiler la page pour déclencher les apparitions au scroll ;
 * 2. termine les animations en cours (sinon axe mesure des couleurs
 *    intermédiaires et signale de faux contrastes) ;
 * 3. lance axe-core et affiche un tableau des violations.
 *
 * Limites : un audit automatique couvre environ 30 à 40 % des critères.
 * Il ne remplace ni le parcours clavier, ni le lecteur d'écran, ni la
 * relecture humaine (pertinence des titres, des alternatives, etc.).
 */
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  if (!window.axe) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  window.scrollTo(0, document.body.scrollHeight);
  await wait(1500);
  window.scrollTo(0, 0);
  await wait(500);
  document.getAnimations().forEach((animation) => {
    try {
      animation.finish();
    } catch {
      /* animation infinie : ignorée */
    }
  });
  const result = await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  });
  console.log(
    `Audit axe · ${location.pathname} · « ${document.title} » · ` +
      `${document.querySelectorAll("h1").length} h1 · ` +
      `${result.violations.length} violation(s)`,
  );
  console.table(
    result.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        règle: violation.id,
        gravité: violation.impact,
        élément: node.target.join(" "),
        détail: (node.failureSummary || "").split("\n")[1]?.trim(),
      })),
    ),
  );
})();
