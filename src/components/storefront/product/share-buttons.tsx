"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";

import { FacebookIcon } from "@/components/storefront/layout/social-icons";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Silently fail if clipboard unavailable
    });
  }

  // The server always renders without native share (no `navigator`); the
  // client's first render must match that or React throws a hydration
  // mismatch. useSyncExternalStore's getServerSnapshot forces `false` for
  // SSR/hydration, then the client snapshot reads the real capability on
  // the next paint.
  const canNativeShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );

  function handleNativeShare() {
    // A user cancelling the native share sheet rejects the promise; that's
    // not an error worth surfacing.
    navigator.share({ title, url }).catch(() => {});
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-2">
      {canNativeShare && (
        <Button type="button" variant="outline" size="icon-sm" onClick={handleNativeShare} aria-label="Share via device">
          <Share2 />
        </Button>
      )}
      <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy} aria-label="Copy link">
        <Copy />
      </Button>
      {copied && (
        <span role="status" className="text-caption text-charcoal/70">
          Copied!
        </span>
      )}
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        role="link"
        aria-label="Share on WhatsApp"
        render={
          <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" />
        }
      >
        <MessageCircle />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        role="link"
        aria-label="Share on Facebook"
        render={
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        <FacebookIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        role="link"
        aria-label="Share on X"
        render={
          <a
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        X
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        role="link"
        aria-label="Share by email"
        render={<a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} />}
      >
        <Mail />
      </Button>
    </div>
  );
}
