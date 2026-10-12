import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createBundle, deleteBundle, getBundle, updateBundle } from "@/services/bundle-admin.service";
import { bundleAdminSchema } from "@/validation/product-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const bundle = await getBundle(session.user.id, id);
    return NextResponse.json(bundle);
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/products/[id]/bundle");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bundleAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const bundle = await createBundle(session.user.id, id, parsed.data);
    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/bundle");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bundleAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const bundle = await updateBundle(session.user.id, id, parsed.data);
    return NextResponse.json(bundle);
  } catch (error) {
    return productAdminErrorResponse(error, "PATCH /api/admin/products/[id]/bundle");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteBundle(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/bundle");
  }
}
