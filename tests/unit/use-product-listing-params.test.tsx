import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";

import { useProductListingParams } from "@/hooks/use-product-listing-params";

describe("useProductListingParams", () => {
  it("defaults to page 1 and newest sort when the URL has no query", () => {
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter(),
    });

    const [params] = result.current;
    expect(params.page).toBe(1);
    expect(params.sort).toBe("newest");
    expect(params.allergens).toBeNull();
  });

  it("parses an existing query string", () => {
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?page=3&sort=price-asc&brands=oristor,mccormick",
      }),
    });

    const [params] = result.current;
    expect(params.page).toBe(3);
    expect(params.sort).toBe("price-asc");
    expect(params.brands).toEqual(["oristor", "mccormick"]);
  });

  it("updates the URL when setParams is called", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });

    await act(async () => {
      await result.current[1]({ page: 2 });
    });

    expect(onUrlUpdate).toHaveBeenCalled();
    const event = onUrlUpdate.mock.calls[0][0];
    expect(event.searchParams.get("page")).toBe("2");
  });
});
