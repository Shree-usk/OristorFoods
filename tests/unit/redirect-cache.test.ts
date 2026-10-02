import { afterEach, describe, expect, it, vi } from "vitest";

import * as redirectRepository from "@/repositories/redirect.repository";
import { __resetRedirectCacheForTests, getActiveRedirectsCached } from "@/lib/redirect-cache";

describe("getActiveRedirectsCached", () => {
  afterEach(() => {
    __resetRedirectCacheForTests();
    vi.restoreAllMocks();
  });

  it("fetches once, then serves subsequent calls from cache without a second DB query", async () => {
    const spy = vi.spyOn(redirectRepository, "listActiveRedirects").mockResolvedValue([{ sourcePath: "/a", destinationPath: "/b", statusCode: 301 }]);

    const first = await getActiveRedirectsCached();
    const second = await getActiveRedirectsCached();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.get("/a")).toEqual({ destinationPath: "/b", statusCode: 301 });
    expect(second).toBe(first);
  });

  it("de-dupes concurrent cache-miss callers into a single in-flight fetch", async () => {
    let resolveFetch!: (value: { sourcePath: string; destinationPath: string; statusCode: number }[]) => void;
    const pending = new Promise<{ sourcePath: string; destinationPath: string; statusCode: number }[]>((resolve) => (resolveFetch = resolve));
    const spy = vi.spyOn(redirectRepository, "listActiveRedirects").mockReturnValue(pending as ReturnType<typeof redirectRepository.listActiveRedirects>);

    const callA = getActiveRedirectsCached();
    const callB = getActiveRedirectsCached();
    resolveFetch([{ sourcePath: "/x", destinationPath: "/y", statusCode: 302 }]);

    const [resultA, resultB] = await Promise.all([callA, callB]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(resultA).toBe(resultB);
  });
});
