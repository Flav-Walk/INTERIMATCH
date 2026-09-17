import { describe, it, expect } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  passwordRequirement,
  passwordStrength,
  strengthLevels,
} from "./password";

describe("exigence du serveur", () => {
  it("reprend la longueur minimale appliquée par le backend", () => {
    // `registerSchema` : z.string().min(12).max(128). Si cette règle change
    // côté serveur, ce test doit changer avec elle — pas l'inverse.
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("dit combien de caractères il manque", () => {
    const r = passwordRequirement("abcdefgh");
    expect(r.met).toBe(false);
    expect(r.missing).toBe(4);
    expect(r.message).toContain("4 caractères");
  });

  it("accorde le singulier", () => {
    expect(passwordRequirement("abcdefghijk").message).toContain(
      "1 caractère :",
    );
  });

  it("parle simplement quand rien n'est saisi", () => {
    const r = passwordRequirement("");
    expect(r.missing).toBe(12);
    expect(r.message).toBe("12 caractères au minimum.");
  });

  it("est satisfaite à douze caractères", () => {
    const r = passwordRequirement("abcdefghijkl");
    expect(r.met).toBe(true);
    expect(r.message).toBe("");
  });

  it("refuse au-delà de la borne haute du serveur", () => {
    expect(passwordRequirement("a".repeat(129)).met).toBe(false);
  });
});

describe("estimation de la force", () => {
  it("ne dépasse jamais « Faible » tant que l'exigence n'est pas remplie", () => {
    // C'est la garantie centrale : l'indicateur ne doit pas laisser croire
    // qu'un mot de passe refusé par le serveur passerait.
    for (const short of ["Aa1!", "Aa1!Aa1!", "Aa1!Aa1!Aa", "aB3$xY7&z"]) {
      expect(passwordRequirement(short).met).toBe(false);
      expect(passwordStrength(short).score).toBeLessThanOrEqual(1);
    }
  });

  it("ne récompense pas la répétition", () => {
    // Douze caractères pour une seule lettre ne valent pas douze caractères
    // variés, même si la longueur suffit au serveur.
    expect(passwordRequirement("aaaaaaaaaaaa").met).toBe(true);
    expect(passwordStrength("aaaaaaaaaaaa").score).toBeLessThan(
      passwordStrength("mercredi-bleu").score,
    );
  });

  it("progresse avec la longueur puis avec la variété", () => {
    const scores = [
      passwordStrength("mercredibleu").score,
      passwordStrength("mercredi-bleu-9").score,
      passwordStrength("Mercredi-Bleu-9x").score,
      passwordStrength("Mercredi-Bleu-92!x").score,
    ];
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores.at(-1)).toBe(3);
  });

  it("donne un libellé à chaque niveau", () => {
    for (const p of ["", "abc", "abcdefghijkl", "Mercredi-Bleu-92!x"]) {
      const s = passwordStrength(p);
      expect(strengthLevels).toContain(s.label);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(3);
    }
  });

  it("conseille ce qui ferait réellement progresser", () => {
    expect(passwordStrength("mercredibleupluie").advice).toContain(
      "majuscules",
    );
    expect(passwordStrength("aaaaaaaaaaaaaaAA1!").advice).toContain("répétés");
    // Un mot de passe déjà solide n'a plus de reproche à recevoir.
    expect(passwordStrength("Mercredi-Bleu-92!x").advice).toBe("");
  });

  it("supporte une saisie vide", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("").advice).toBe("");
  });
});
