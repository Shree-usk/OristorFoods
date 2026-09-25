"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { normalizeVideoUrl, youtubeThumbnailUrl } from "@/lib/video-url";

interface VideoPlayerProps {
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds?: number | null; captionsUrl?: string | null };
  posterUrl: string;
  posterAlt: string;
}

export function VideoPlayer({ video, posterUrl, posterAlt }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const normalized = normalizeVideoUrl(video.url);

  if (!normalized) {
    return (
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
        <Image src={posterUrl} alt={posterAlt} fill className="object-cover" />
      </div>
    );
  }

  if (normalized.provider === "SelfHosted") {
    return (
      <video controls poster={posterUrl} className="aspect-4/3 w-full rounded-lg bg-black sm:aspect-16/9">
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
        <Image src={thumbnail} alt={posterAlt} fill className="object-cover" />
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
        src={embedSrc}
        title={posterAlt}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
