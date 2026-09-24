"use client";

import { useState } from "react";
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

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function handleNativeShare() {
    void navigator.share({ title, url });
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
