import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode indicator badge is fixed bottom-left and can sit directly
  // on top of page content that scrolls to that corner (found via STORY-040's
  // admin product form, whose Categories checkbox list landed exactly
  // there), silently intercepting clicks in both manual testing and
  // Playwright. Dev-only — no effect on the production build.
  devIndicators: false,
  turbopack: {
    // This worktree sits inside the main repo, which has its own
    // package-lock.json — Turbopack's root inference picked that sibling
    // lockfile as the workspace root instead of this directory, silently
    // bundling from the wrong node_modules and producing a duplicate React
    // instance ("Invalid hook call" / "Cannot read properties of null
    // (reading 'useId')" in every client component using a hook). Pinning
    // the root here is exactly the fix Next's own warning recommends.
    root: path.join(__dirname),
  },
  images: {
    // VideoPlayer uses next/image for YouTube thumbnail previews (i.ytimg.com is
    // load-bearing for the play-button preview). Vimeo and self-hosted URLs are
    // added proactively for forward-compatibility if next/image is used for those
    // providers later; currently, Vimeo uses iframe embedding and self-hosted uses
    // plain <video> elements (no next/image dependency).
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "vimeo.com" },
      { protocol: "https", hostname: "cdn.oristor.test" },
    ],
  },
};

export default nextConfig;
