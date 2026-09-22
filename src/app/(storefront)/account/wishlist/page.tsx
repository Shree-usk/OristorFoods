import type { Metadata } from "next";

import { WishlistView } from "@/components/storefront/account/wishlist-view";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return <WishlistView />;
}
