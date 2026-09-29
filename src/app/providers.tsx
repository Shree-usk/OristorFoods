"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

import { CartMergeSync } from "@/components/providers/cart-merge-sync";
import { RecipeBookmarkMergeSync } from "@/components/providers/recipe-bookmark-merge-sync";
import { WishlistMergeSync } from "@/components/providers/wishlist-merge-sync";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
        <RecipeBookmarkMergeSync />
        <CartMergeSync />
        <Toaster />
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryClientProvider>
    </SessionProvider>
  );
}
