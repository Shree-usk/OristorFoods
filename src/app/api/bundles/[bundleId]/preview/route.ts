import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { previewBundleSelection } from "@/services/bundle.service";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { bundlePreviewSchema } from "@/validation/cart.schema";

/** Public, read-only — same auth posture as the PDP itself (getProductDetail). */
export async function POST(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const { bundleId } = await params;
  const body: unknown = await request.json();
  const parsed = bundlePreviewSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
    const preview = await previewBundleSelection(bundleId, parsed.data.selections, customerGroup);
    return NextResponse.json(preview);
  } catch (error) {
    return cartErrorResponse(error);
  }
}
