import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchBadge } from "./MatchBadge";

/**
 * La pastille ne décide plus de rien.
 *
 * Elle comparait `score >= 70` sur un nombre déjà arrondi. Un profil à 69,6 %
 * s'affiche « 70 % » : il était donc peint comme « très compatible » alors que
 * le serveur l'avait rangé dans la tranche 60–69, et le même écran annonçait
 * les deux à la fois. Ces tests verrouillent la correction : le niveau vient du
 * palier serveur, et de lui seul.
 */

const render = (props: Parameters<typeof MatchBadge>[0]) =>
  renderToStaticMarkup(createElement(MatchBadge, props));

describe("pastille de compatibilité", () => {
  it("affiche le score reçu", () => {
    expect(render({ score: 82, band: 70 })).toContain("82");
  });

  it.each([
    [70, "is-high"],
    [60, "is-mid"],
    [50, "is-low"],
  ])("peint le palier %i en %s", (band, expected) => {
    expect(render({ score: 75, band })).toContain(expected);
  });

  it("traite l’absence de palier comme le niveau le plus bas", () => {
    // Sous 50 %, le serveur ne renvoie aucun palier : il ne faut pas pour
    // autant que la pastille reste sans classe.
    expect(render({ score: 44, band: null })).toContain("is-low");
    expect(render({ score: 44 })).toContain("is-low");
  });

  it("ne remonte pas d’un niveau à cause de l’arrondi", () => {
    // LE CAS DE LA REVIEW. raw_score 69,6 → score affiché 70, palier serveur 60.
    // L’ancienne pastille lisait « 70 » et concluait « is-high », contredisant
    // la section « 60–69 % » dans laquelle le serveur avait rangé le profil.
    const html = render({ score: 70, band: 60 });
    expect(html).toContain("Compatible à 70");
    expect(html).toContain("is-mid");
    expect(html).not.toContain("is-high");
  });

  it("ne descend pas non plus d’un niveau à cause de l’arrondi", () => {
    // Le symétrique : 69,5 s’affiche « 70 » aussi, et reste au palier 60 ;
    // tandis qu’un vrai 70 affiche « 70 » et monte. Le nombre est le même, la
    // peinture diffère — c’est exactement ce qu’on veut.
    expect(render({ score: 70, band: 70 })).toContain("is-high");
  });

  it("garde la taille comme seule variante purement visuelle", () => {
    expect(render({ score: 80, band: 70, size: "large" })).toContain(
      "is-large",
    );
    expect(render({ score: 80, band: 70 })).not.toContain("is-large");
  });
});
