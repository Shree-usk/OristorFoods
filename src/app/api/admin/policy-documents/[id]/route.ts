import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { policyDocumentErrorResponse } from "@/lib/api/policy-document-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deletePolicyDocument, updatePolicyDocument } from "@/services/policy-document.service";
import { updatePolicyDocumentSchema } from "@/validation/policy-document.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();
  const { id } = await params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updatePolicyDocumentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const document = await updatePolicyDocument(session.user.id, id, parsed.data);
    return NextResponse.json(document);
  } catch (error) {
    return policyDocumentErrorResponse(error, "PATCH /api/admin/policy-documents/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();
  const { id } = await params;

  try {
    await deletePolicyDocument(session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return policyDocumentErrorResponse(error, "DELETE /api/admin/policy-documents/[id]");
  }
}
