import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "vimeo.com" },
      { protocol: "https", hostname: "cdn.oristor.test" },
    ],
  },
};

export default nextConfig;
