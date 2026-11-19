import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { perfectMatchAdminErrorResponse } from "@/lib/api/perfect-match-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addPerfectMatchPairing, listPerfectMatchPairingsForAdmin } from "@/services/perfect-match-admin.service";
import { perfectMatchPairingAdminSchema } from "@/validation/perfect-match-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await listPerfectMatchPairingsForAdmin(session.user.id, id));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "GET /api/admin/perfect-match/products/[id]/pairings");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = perfectMatchPairingAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const pairing = await addPerfectMatchPairing(session.user.id, id, parsed.data);
    return NextResponse.json(pairing, { status: 201 });
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "POST /api/admin/perfect-match/products/[id]/pairings");
  }
}
