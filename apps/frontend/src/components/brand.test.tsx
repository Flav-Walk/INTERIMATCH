import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("identité InteriMatch", () => {
  it("affiche le wordmark sans monogramme isolé", () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain("InteriMatch");
    expect(html).not.toContain("<svg");
  });
});
