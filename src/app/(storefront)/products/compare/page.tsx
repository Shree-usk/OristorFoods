import type { Metadata } from "next";

import { CompareView } from "@/components/storefront/product/compare-view";
import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getProductsForCompare } from "@/services/product.service";
import { compareIdsSchema } from "@/validation/product-compare.schema";

interface ComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Compare Products",
  robots: { index: false, follow: false },
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const raw = await searchParams;
  const idsParam = Array.isArray(raw.ids) ? raw.ids[0] : raw.ids;
  const parsed = compareIdsSchema.safeParse(idsParam ?? "");
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const items = parsed.success ? await getProductsForCompare(parsed.data, customerGroup) : [];

  return <CompareView items={items} />;
}
