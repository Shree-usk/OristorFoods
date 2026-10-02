"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface PopupOverlayContent {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  couponCode: string | null;
}

/**
 * STORY-050a. The single live-render used by both the real storefront
 * trigger controller and the admin editor's Preview — a preview never
 * goes through the eligibility/interaction-recording path (see
 * admin-popup-editor-view.tsx), so previewing can never pollute real
 * analytics or trip a real visitor's frequency cap.
 */
export function PopupOverlay({
  popup,
  open,
  onOpenChange,
  onCtaClick,
  forceViewport,
}: {
  popup: PopupOverlayContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCtaClick?: (href: string) => void;
  /** Preview only — forces which image variant renders, independent of real viewport width. */
  forceViewport?: "desktop" | "tablet" | "mobile";
}) {
  const useMobileImage = forceViewport === "mobile" && popup.mobileImageUrl;
  const imageUrl = useMobileImage ? popup.mobileImageUrl : popup.imageUrl;
  const imageAlt = useMobileImage ? (popup.mobileImageAlt ?? popup.title) : (popup.imageAlt ?? popup.title);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {popup.videoUrl ? (
          <video src={popup.videoUrl} autoPlay muted loop playsInline className="w-full rounded" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a popup's image varies per campaign; next/image's static-domain config isn't worth it for this
          <img src={imageUrl} alt={imageAlt} className="w-full rounded object-cover" />
        ) : null}

        <h2 className="mt-4 text-h3 font-heading text-charcoal">{popup.title}</h2>
        {popup.description && <p className="mt-2 text-small text-charcoal/80">{popup.description}</p>}
        {popup.couponCode && (
          <p className="mt-3 rounded border border-dashed border-chilli px-3 py-2 text-center font-mono text-small text-chilli">{popup.couponCode}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {popup.ctaLabel && popup.ctaHref && (
            <Button
              type="button"
              onClick={() => {
                onCtaClick?.(popup.ctaHref!);
                onOpenChange(false);
              }}
            >
              {popup.ctaLabel}
            </Button>
          )}
          {popup.secondaryCtaLabel && popup.secondaryCtaHref && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onCtaClick?.(popup.secondaryCtaHref!);
                onOpenChange(false);
              }}
            >
              {popup.secondaryCtaLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
