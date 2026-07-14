/**
 * `lucide-react` v1.x removed all brand/logo icons (Facebook, Instagram,
 * YouTube, Twitter, LinkedIn, GitHub, etc.) — it's now a purely generic
 * UI icon set. Rather than add a second icon library just for three
 * social glyphs, these are minimal hand-written inline SVGs. If more
 * brand icons are needed later, reconsider a dedicated package (e.g.
 * `simple-icons`) instead of hand-rolling more of these.
 */
export type BrandIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export const FacebookIcon: BrandIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
  </svg>
);

export const InstagramIcon: BrandIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const YoutubeIcon: BrandIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M21.58 7.2a2.75 2.75 0 0 0-1.94-1.95C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.64.5A2.75 2.75 0 0 0 2.42 7.2 28.6 28.6 0 0 0 1.92 12c0 1.62.16 3.24.5 4.8a2.75 2.75 0 0 0 1.94 1.95c1.74.5 7.64.5 7.64.5s5.9 0 7.64-.5a2.75 2.75 0 0 0 1.94-1.95c.34-1.56.5-3.18.5-4.8 0-1.62-.16-3.24-.5-4.8ZM9.87 15.02V8.98L15.5 12l-5.63 3.02Z" />
  </svg>
);
