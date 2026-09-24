// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { serverErrorResponse } from "@/lib/api/responses";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serverErrorResponse", () => {
  it("logs the real error with its context and returns a generic 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection refused");

    const response = serverErrorResponse(failure, "GET /api/recipes");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes]", failure);
  });
});
