"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PopupOverlay } from "@/components/storefront/popup/popup-overlay";
import { fetchEligiblePopup, recordPopupInteraction, type EligiblePopup, type PopupPageTargetValue } from "@/lib/api/popup-client";

function resolvePageTarget(pathname: string): PopupPageTargetValue {
  if (pathname === "/") return "Homepage";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/recipes")) return "Recipes";
  if (pathname.startsWith("/blog")) return "Blog";
  // Not a page type the targeting system distinguishes — the server
  // already only returns AllPages-targeted popups for this case.
  return "AllPages";
}

const SESSION_DISMISSED_PREFIX = "oristor-popup-session-";
const PAGE_VIEW_COUNT_KEY = "oristor-popup-page-views";

function bumpPageViewCount(): void {
  try {
    const raw = sessionStorage.getItem(PAGE_VIEW_COUNT_KEY);
    sessionStorage.setItem(PAGE_VIEW_COUNT_KEY, String((raw ? Number(raw) : 0) + 1));
  } catch {
    // Private browsing / storage blocked — page-view counting degrades to "always eligible on trigger value," not a crash.
  }
}

/**
 * STORY-050a. Mounted once in the storefront layout. The server
 * (/api/popups/eligible) only decides WHICH popup is eligible at all —
 * this component owns the trigger's own timing, since delay/scroll/
 * exit-intent/page-views/add-to-cart are inherently client-observed
 * events. Guest-side OncePerSession capping is sessionStorage-only (no
 * guest-identity architecture exists server-side); authenticated
 * customers' broader caps (OncePerDay/Week/Customer/UntilDismissed) are
 * already enforced server-side by resolveEligiblePopup before this popup
 * ever reaches the client.
 *
 * `key={pathname}` below gives every page navigation a fresh instance —
 * simpler and lint-clean than resetting state imperatively inside an
 * effect on every pathname change.
 */
export function PopupTriggerController() {
  const pathname = usePathname();
  return <PopupTriggerForPage key={pathname} pathname={pathname} />;
}

function PopupTriggerForPage({ pathname }: { pathname: string }) {
  const [popup, setPopup] = useState<EligiblePopup | null>(null);
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    bumpPageViewCount();

    let cancelled = false;
    fetchEligiblePopup(resolvePageTarget(pathname)).then((eligible) => {
      if (cancelled || !eligible) return;
      if (eligible.frequencyCap === "OncePerSession") {
        try {
          if (sessionStorage.getItem(`${SESSION_DISMISSED_PREFIX}${eligible.id}`)) return;
        } catch {
          // Storage blocked — fail open (same as above).
        }
      }
      setPopup(eligible);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!popup || shownRef.current) return;

    const show = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setOpen(true);
      void recordPopupInteraction(popup.id, "Impression");
    };

    const cleanups: Array<() => void> = [];

    switch (popup.triggerType) {
      case "Immediate":
        show();
        break;
      case "TimeDelay": {
        const timer = window.setTimeout(show, (popup.triggerValue ?? 0) * 1000);
        cleanups.push(() => window.clearTimeout(timer));
        break;
      }
      case "ScrollDepth": {
        const onScroll = () => {
          const doc = document.documentElement;
          const scrollable = doc.scrollHeight - doc.clientHeight;
          const percent = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 100;
          if (percent >= (popup.triggerValue ?? 50)) show();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener("scroll", onScroll));
        break;
      }
      case "ExitIntent": {
        const onMouseLeave = (event: MouseEvent) => {
          if (event.clientY <= 0) show();
        };
        document.addEventListener("mouseleave", onMouseLeave);
        cleanups.push(() => document.removeEventListener("mouseleave", onMouseLeave));
        break;
      }
      case "PageViews": {
        try {
          const raw = sessionStorage.getItem(PAGE_VIEW_COUNT_KEY);
          const count = raw ? Number(raw) : 0;
          if (count >= (popup.triggerValue ?? 1)) show();
        } catch {
          show(); // storage blocked — fail open rather than never showing this trigger type at all
        }
        break;
      }
      case "AddToCart": {
        const onAddToCart = () => show();
        window.addEventListener("oristor:add-to-cart", onAddToCart);
        cleanups.push(() => window.removeEventListener("oristor:add-to-cart", onAddToCart));
        break;
      }
      case "BeforeCheckout":
        if (pathname.startsWith("/checkout")) show();
        break;
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [popup, pathname]);

  if (!popup) return null;

  return (
    <PopupOverlay
      popup={popup}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          void recordPopupInteraction(popup.id, "Dismissal");
          try {
            if (popup.frequencyCap === "OncePerSession") sessionStorage.setItem(`${SESSION_DISMISSED_PREFIX}${popup.id}`, "1");
          } catch {
            // Storage blocked — the popup may show again this session; not a functional failure.
          }
        }
      }}
      onCtaClick={(href) => {
        void recordPopupInteraction(popup.id, "Click");
        window.location.href = href;
      }}
    />
  );
}
