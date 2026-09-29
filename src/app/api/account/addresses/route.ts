import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { addressErrorResponse } from "@/lib/api/address-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createAddress, listAddresses } from "@/services/address.service";
import { addressSchema } from "@/validation/address.schema";

/** STORY-034. The account address book — distinct from /api/checkout/addresses (STORY-025's minimal checkout-only listing). */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const addresses = await listAddresses(userId);
  return NextResponse.json(addresses);
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { setAsDefaultBilling, setAsDefaultShipping, ...fields } = parsed.data;

  try {
    const address = await createAddress(
      userId,
      { ...fields, line2: fields.line2 || null, district: fields.district || null, postalCode: fields.postalCode || null, companyName: fields.companyName || null, taxId: fields.taxId || null },
      { setAsDefaultBilling, setAsDefaultShipping },
    );
    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    return addressErrorResponse(error);
  }
}
