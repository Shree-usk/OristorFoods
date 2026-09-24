import "dotenv/config";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest doesn't auto-load `.env` the way Next.js does — `src/lib/db.ts`
// reads `DATABASE_URL` from `process.env` directly (Prisma 7's driver-
// adapter pattern, see docs/architecture-decisions.md), so any test that
// touches the Prisma client needs it loaded explicitly. `globalSetup`
// runs in a separate process and can't set env vars for the test workers,
// so this has to happen here instead — same `dotenv/config` mechanism
// `prisma.config.ts` already uses for the CLI.

// vitest.config.ts doesn't set `test.globals: true`, so Testing Library's
// built-in auto-cleanup (which checks for a global `afterEach`) never
// fires on its own — register it explicitly instead.
afterEach(cleanup);

// jsdom deliberately doesn't implement `window.matchMedia` — stub a
// default (always `matches: false`) so any component/hook that calls it
// (use-media-query.ts and everything built on it) doesn't throw in tests
// that don't care about media queries. Tests that DO care should
// override it themselves — see tests/unit/use-reduced-motion.test.ts.
// `vi.stubGlobal` (rather than direct `window.x = ...` assignment) sidesteps
// a TS quirk where `"x" in window` narrows to `never` for DOM properties
// the lib types already declare as always-present.
vi.stubGlobal(
  "matchMedia",
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

// jsdom also doesn't implement IntersectionObserver — needed by Framer
// Motion's `whileInView` (used by ScrollReveal, src/components/motion/) and
// by next/link's viewport-prefetch (node_modules/next/src/client/use-intersection.tsx).
// Assigned directly (not via vi.stubGlobal) because this is a permanent
// environment polyfill, not a per-test stub: a test file that calls
// vi.unstubAllGlobals() in its own afterEach (e.g. recipe-listing.test.tsx,
// which stubs/unstubs `fetch` per test) would otherwise strip this global
// after its first test and break every next/link render after that.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
globalThis.IntersectionObserver = MockIntersectionObserver;

