import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

describe("JsonLdScript", () => {
  it("escapes '<' so a value can't break out of the script tag", () => {
    const dangerous = "</script><script>alert(1)</script>";

    const { container } = render(<JsonLdScript data={{ description: dangerous }} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const html = script?.innerHTML ?? "";

    // Every '<' must be replaced with its unicode escape...
    expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
    // ...and no literal '<' should survive, since that's what would let the
    // string break out of this <script> block in raw HTML.
    expect(html).not.toContain("<");

    // The underlying JSON data is still intact once parsed.
    const json = JSON.parse(html);
    expect(json.description).toBe(dangerous);
  });
});
