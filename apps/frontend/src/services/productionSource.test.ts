import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(import.meta.dirname, "..");

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    if (
      !/[.]tsx?$/.test(extname(path)) ||
      /[.](test|spec)[.]tsx?$/.test(path)
    ) {
      return [];
    }
    return [path];
  });
}

describe("sources de production", () => {
  it("ne réintroduit ni missions de référence, ni scores de démonstration, ni CTA vide", () => {
    const source = productionSources(sourceRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/referenceMissions/);
    expect(source).not.toMatch(/compatibility\s*:\s*(?:85|72|92)/);
    expect(source).not.toMatch(/onClick=\{\(\)\s*=>\s*\{\s*\}\}/);
  });
});
