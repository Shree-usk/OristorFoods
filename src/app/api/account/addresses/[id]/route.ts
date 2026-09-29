import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { addressErrorResponse } from "@/lib/api/address-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteAddress, updateAddress } from "@/services/address.service";
import { addressUpdateSchema } from "@/validation/address.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = addressUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { line2, district, postalCode, companyName, taxId, ...rest } = parsed.data;

  try {
    const address = await updateAddress(userId, id, {
      ...rest,
      ...(line2 !== undefined && { line2: line2 || null }),
      ...(district !== undefined && { district: district || null }),
      ...(postalCode !== undefined && { postalCode: postalCode || null }),
      ...(companyName !== undefined && { companyName: companyName || null }),
      ...(taxId !== undefined && { taxId: taxId || null }),
    });
    return NextResponse.json(address);
  } catch (error) {
    return addressErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    await deleteAddress(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return addressErrorResponse(error);
  }
}
