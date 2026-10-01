import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addNote } from "@/services/customer-admin.service";
import { addCustomerNoteSchema } from "@/validation/customer-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = addCustomerNoteSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const note = await addNote(session.user.id, id, parsed.data.body);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return customerAdminErrorResponse(error, "POST /api/admin/customers/[id]/notes");
  }
}
