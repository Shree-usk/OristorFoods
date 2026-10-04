import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { glossaryErrorResponse } from "@/lib/api/glossary-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteGlossaryTerm, updateGlossaryTerm } from "@/services/glossary.service";
import { updateGlossaryTermSchema } from "@/validation/glossary-term.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();
  const { id } = await params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateGlossaryTermSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const term = await updateGlossaryTerm(session.user.id, id, parsed.data);
    return NextResponse.json(term);
  } catch (error) {
    return glossaryErrorResponse(error, "PATCH /api/admin/search-glossary/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();
  const { id } = await params;

  try {
    await deleteGlossaryTerm(session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return glossaryErrorResponse(error, "DELETE /api/admin/search-glossary/[id]");
  }
}
