import { beforeEach, describe, expect, it } from "vitest";

import { useCompareStore } from "@/lib/stores/compare-store";

beforeEach(() => {
  useCompareStore.setState({ items: [] });
});

describe("useCompareStore", () => {
  it("adds a product id and returns \"added\"", () => {
    const result = useCompareStore.getState().add("p1");

    expect(result).toBe("added");
    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });

  it("returns \"duplicate\" and does not re-add an id already in the tray", () => {
    useCompareStore.getState().add("p1");

    const result = useCompareStore.getState().add("p1");

    expect(result).toBe("duplicate");
    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });

  it("returns \"full\" and does not add a 5th id", () => {
    useCompareStore.getState().add("p1");
    useCompareStore.getState().add("p2");
    useCompareStore.getState().add("p3");
    useCompareStore.getState().add("p4");

    const result = useCompareStore.getState().add("p5");

    expect(result).toBe("full");
    expect(useCompareStore.getState().items).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("removes a product id", () => {
    useCompareStore.getState().add("p1");

    useCompareStore.getState().remove("p1");

    expect(useCompareStore.getState().items).toEqual([]);
  });

  it("has() reflects current membership", () => {
    useCompareStore.getState().add("p1");

    expect(useCompareStore.getState().has("p1")).toBe(true);
    expect(useCompareStore.getState().has("p2")).toBe(false);
  });

  it("clear() empties the tray", () => {
    useCompareStore.getState().add("p1");
    useCompareStore.getState().add("p2");

    useCompareStore.getState().clear();

    expect(useCompareStore.getState().items).toEqual([]);
  });

  it("does not persist to localStorage", () => {
    useCompareStore.getState().add("p1");

    expect(localStorage.getItem("oristor-compare")).toBeNull();
  });
});
