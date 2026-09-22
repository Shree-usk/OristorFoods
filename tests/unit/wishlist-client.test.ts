import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addWishlistItem,
  fetchProductsByIds,
  fetchWishlist,
  removeWishlistItem,
} from "@/lib/api/wishlist-client";

function stubFetch(response: Partial<Response> & { ok: boolean; status: number }) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const okEmpty = { ok: true, status: 200, json: () => Promise.resolve({ items: [] }) };
const forbidden = { ok: false, status: 401, json: () => Promise.resolve({}) };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchWishlist", () => {
  it("returns the items array on a 2xx", async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ items: [{ id: "p1" }] }) });

    await expect(fetchWishlist()).resolves.toEqual([{ id: "p1" }]);
  });

  it("throws on a non-ok response", async () => {
    stubFetch(forbidden);

    await expect(fetchWishlist()).rejects.toThrow(/401/);
  });
});

describe("fetchProductsByIds", () => {
  it("short-circuits without a request for an empty id list", async () => {
    const fetchMock = stubFetch(okEmpty);

    await expect(fetchProductsByIds([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a non-ok response", async () => {
    stubFetch({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(fetchProductsByIds(["p1"])).rejects.toThrow(/500/);
  });
});

describe("addWishlistItem", () => {
  it("POSTs the product id", async () => {
    const fetchMock = stubFetch(okEmpty);

    await addWishlistItem("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wishlist",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ productId: "p1" }) }),
    );
  });

  it("throws on a non-ok response", async () => {
    stubFetch(forbidden);

    await expect(addWishlistItem("p1")).rejects.toThrow(/401/);
  });
});

describe("removeWishlistItem", () => {
  it("DELETEs the product id", async () => {
    const fetchMock = stubFetch(okEmpty);

    await removeWishlistItem("p1");

    expect(fetchMock).toHaveBeenCalledWith("/api/wishlist/p1", { method: "DELETE" });
  });

  it("throws on a non-ok response", async () => {
    stubFetch(forbidden);

    await expect(removeWishlistItem("p1")).rejects.toThrow(/401/);
  });
});
