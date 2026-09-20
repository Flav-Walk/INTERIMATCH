import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";
import { MatchyMascot } from "./MatchyMascot";

describe("identité InteriMatch", () => {
  it("affiche le wordmark sans monogramme isolé", () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain("InteriMatch");
    expect(html).not.toContain("<svg");
  });

  it.each(["profile", "missions", "dashboard"] as const)(
    "n'affiche aucun logo sur le tablier dans la pose %s",
    (pose) => {
      const html = renderToStaticMarkup(<MatchyMascot pose={pose} />);
      expect(html).toContain('id="body-apron"');
      expect(html).not.toContain("apron-logo");
      expect(html).not.toContain("White &#x27;M&#x27;");
    },
  );
});
