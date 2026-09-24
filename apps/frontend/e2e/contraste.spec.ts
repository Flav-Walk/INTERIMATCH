import { test, expect } from "@playwright/test";

/** Contraste WCAG : mesure réelle sur les couleurs calculées par le navigateur. */
test("contraste des surfaces porteuses de texte", async ({ page }) => {
  await page.goto("/register");
  const results = await page.evaluate(() => {
    // Les navigateurs conservent `oklch()` dans le style calculé : lire
    // `getComputedStyle().color` rendrait la chaîne telle quelle. On peint donc
    // un pixel et on le relit — c'est la seule mesure qui donne du sRGB réel.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const parse = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
      return Number(((x + 0.05) / (y + 0.05)).toFixed(2));
    };
    const css = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      blancSurClayInk: ratio("#fff", css("--color-clay-ink")),
      blancSurClay: ratio("#fff", css("--color-clay")),
      blancSurForest: ratio("#fff", css("--color-forest")),
      blancSurForestDeep: ratio("#fff", css("--color-forest-deep")),
      inkSurPaper: ratio(css("--color-ink"), css("--color-paper")),
      inkSoftSurPaper: ratio(css("--color-ink-soft"), css("--color-paper")),
      inkFaintSurSurface: ratio(css("--color-ink-faint"), css("--color-surface")),
      forestSurSageTint: ratio(css("--color-forest"), css("--color-sage-tint")),
      alertSurSurface: ratio(css("--color-alert"), css("--color-surface")),
    };
  });
  console.log(JSON.stringify(results, null, 1));
  expect(results.blancSurClayInk).toBeGreaterThanOrEqual(4.5);
  expect(results.blancSurForest).toBeGreaterThanOrEqual(4.5);
  expect(results.inkSurPaper).toBeGreaterThanOrEqual(7);
  expect(results.inkSoftSurPaper).toBeGreaterThanOrEqual(4.5);
  expect(results.forestSurSageTint).toBeGreaterThanOrEqual(4.5);
  expect(results.alertSurSurface).toBeGreaterThanOrEqual(4.5);
  // L'encre la plus pâle porte les textes les PLUS PETITS du produit — unités,
  // légendes, précisions. C'est donc celle qu'il faut surveiller en premier.
  expect(results.inkFaintSurSurface).toBeGreaterThanOrEqual(4.5);
  // `--color-clay` reste une couleur d'aplat décoratif : elle n'atteint pas le
  // seuil avec du blanc, et ce test verrouille le fait qu'on ne s'en serve pas
  // comme fond de texte clair. Voir `.im-btn--clay`.
  expect(results.blancSurClay).toBeLessThan(4.5);
});
