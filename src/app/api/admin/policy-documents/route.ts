import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { policyDocumentErrorResponse } from "@/lib/api/policy-document-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPolicyDocument, listPolicyDocuments } from "@/services/policy-document.service";
import { policyDocumentSchema } from "@/validation/policy-document.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listPolicyDocuments(session.user.id));
  } catch (error) {
    return policyDocumentErrorResponse(error, "GET /api/admin/policy-documents");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = policyDocumentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const document = await createPolicyDocument(session.user.id, parsed.data);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return policyDocumentErrorResponse(error, "POST /api/admin/policy-documents");
  }
}
