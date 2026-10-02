import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { validationErrorResponse } from "@/lib/api/responses";
import { recordInteraction } from "@/services/popup.service";
import { recordInteractionSchema } from "@/validation/popup.schema";

/** Best-effort — never throws a shape the client needs to handle specially; a failure here must never be treated as a page error. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = recordInteractionSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    await recordInteraction(id, userId, parsed.data.type);
  } catch (error) {
    console.error("[popups] failed to record interaction", error);
  }
  return NextResponse.json({ ok: true });
}
