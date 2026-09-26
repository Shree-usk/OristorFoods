export type VideoProvider = "Youtube" | "Vimeo" | "SelfHosted";

export interface NormalizedVideo {
  provider: VideoProvider;
  /** The provider's video ID; null for SelfHosted (the url IS the file). */
  embedId: string | null;
  url: string;
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
];
const VIMEO_PATTERNS = [/(?:vimeo\.com\/(?:video\/)?)([0-9]+)/];

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function normalizeVideoUrl(rawUrl: string): NormalizedVideo | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const parsed = tryParseUrl(trimmed);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return null;

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { provider: "Youtube", embedId: match[1], url: trimmed };
  }
  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { provider: "Vimeo", embedId: match[1], url: trimmed };
  }
  return { provider: "SelfHosted", embedId: null, url: trimmed };
}

export function youtubeThumbnailUrl(embedId: string): string {
  return `https://i.ytimg.com/vi/${embedId}/hqdefault.jpg`;
}
