"use client";

import { useQuery } from "@tanstack/react-query";

import { RecommendationRail } from "@/components/storefront/recommendations/recommendation-rail";
import { fetchCartRecommendations } from "@/lib/api/recommendations-client";

/** STORY-060. Cross-sell suggestions derived from the cart's current contents — excludes items already in the cart, server-side. */
export function CartCrossSell({ productIds }: { productIds: string[] }) {
  const { data } = useQuery({
    queryKey: ["cart-recommendations", productIds],
    queryFn: () => fetchCartRecommendations(productIds),
    enabled: productIds.length > 0,
  });

  if (!data || data.length === 0) return null;

  return <RecommendationRail title="You May Also Need" products={data} placement="Cart" />;
}
