import { describe, expect, it } from "vitest";

import { matchesMenuVisibility } from "@/services/menu-visibility.service";

describe("menu-visibility.service — matchesMenuVisibility", () => {
  it("Always is visible regardless of context", () => {
    expect(matchesMenuVisibility({ visibility: "Always", targetCustomerGroup: null }, { userId: null, customerGroup: null })).toBe(true);
    expect(matchesMenuVisibility({ visibility: "Always", targetCustomerGroup: null }, { userId: "u1", customerGroup: "Retail" })).toBe(true);
  });

  it("Authenticated requires a signed-in visitor", () => {
    expect(matchesMenuVisibility({ visibility: "Authenticated", targetCustomerGroup: null }, { userId: null, customerGroup: null })).toBe(false);
    expect(matchesMenuVisibility({ visibility: "Authenticated", targetCustomerGroup: null }, { userId: "u1", customerGroup: null })).toBe(true);
  });

  it("CustomerGroupTarget requires a signed-in visitor whose customerGroup matches the item's target", () => {
    const item = { visibility: "CustomerGroupTarget" as const, targetCustomerGroup: "Wholesale" as const };
    expect(matchesMenuVisibility(item, { userId: null, customerGroup: "Wholesale" })).toBe(false);
    expect(matchesMenuVisibility(item, { userId: "u1", customerGroup: "Retail" })).toBe(false);
    expect(matchesMenuVisibility(item, { userId: "u1", customerGroup: "Wholesale" })).toBe(true);
  });
});
