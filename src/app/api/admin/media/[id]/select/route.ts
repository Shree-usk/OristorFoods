import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { selectAssetForPicker } from "@/services/media.service";

/** AssetPickerDialog's real gate — rejects with 422 (missing_alt_text) if the asset isn't ready to be used, rather than trusting the client to have checked. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const asset = await selectAssetForPicker(session.user.id, id);
    return NextResponse.json(asset);
  } catch (error) {
    return mediaErrorResponse(error, "POST /api/admin/media/[id]/select");
  }
}
