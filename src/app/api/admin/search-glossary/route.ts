import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { glossaryErrorResponse } from "@/lib/api/glossary-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createGlossaryTerm, listGlossaryTerms } from "@/services/glossary.service";
import { glossaryTermSchema } from "@/validation/glossary-term.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listGlossaryTerms(session.user.id));
  } catch (error) {
    return glossaryErrorResponse(error, "GET /api/admin/search-glossary");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = glossaryTermSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const term = await createGlossaryTerm(session.user.id, {
      term: parsed.data.term,
      canonicalTerm: parsed.data.canonicalTerm,
      targetType: parsed.data.targetType ?? null,
      targetId: parsed.data.targetId ?? null,
    });
    return NextResponse.json(term, { status: 201 });
  } catch (error) {
    return glossaryErrorResponse(error, "POST /api/admin/search-glossary");
  }
}
