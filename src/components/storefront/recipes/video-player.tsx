"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { normalizeVideoUrl, youtubeThumbnailUrl } from "@/lib/video-url";

interface VideoPlayerProps {
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds?: number | null; captionsUrl?: string | null };
  posterUrl: string;
  posterAlt: string;
  priority?: boolean;
  sizes?: string;
}

export function VideoPlayer({ video, posterUrl, posterAlt, priority, sizes }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const normalized = normalizeVideoUrl(video.url);

  useEffect(() => {
    if (playing) {
      iframeRef.current?.focus();
    }
  }, [playing]);

  // A URL that fails to normalize, or normalizes to a DIFFERENT provider
  // than the one the content was authored with, can never be resolved to
  // a playable video for the authored provider — fall back to the poster
  // image rather than rendering a broken/misleading player.
  if (!normalized || normalized.provider !== video.provider) {
    return (
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
        <Image src={posterUrl} alt={posterAlt} fill className="object-cover" priority={priority} sizes={sizes} />
      </div>
    );
  }

  if (normalized.provider === "SelfHosted") {
    return (
      <video controls preload="metadata" crossOrigin="anonymous" poster={posterUrl} className="aspect-4/3 w-full rounded-lg bg-black sm:aspect-16/9">
        <source src={normalized.url} />
        {video.captionsUrl && <track kind="captions" src={video.captionsUrl} />}
      </video>
    );
  }

  if (!playing) {
    const thumbnail = normalized.provider === "Youtube" && normalized.embedId ? youtubeThumbnailUrl(normalized.embedId) : posterUrl;
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Play video"
        className="relative block aspect-4/3 w-full overflow-hidden rounded-lg bg-cream sm:aspect-16/9"
      >
        <Image src={thumbnail} alt="" fill className="object-cover" priority={priority} sizes={sizes} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="size-14 fill-white text-white" aria-hidden="true" />
        </span>
      </button>
    );
  }

  const embedSrc =
    normalized.provider === "Youtube"
      ? `https://www.youtube.com/embed/${normalized.embedId}?autoplay=1`
      : `https://player.vimeo.com/video/${normalized.embedId}?autoplay=1`;

  return (
    <div className="aspect-4/3 overflow-hidden rounded-lg sm:aspect-16/9">
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={`Video: ${posterAlt}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
