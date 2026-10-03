import { NextResponse } from "next/server";

import { submitEnquiry } from "@/services/export-enquiry.service";
import { submitExportEnquirySchema } from "@/validation/export-enquiry.schema";

/** STORY-058. Public, unauthenticated — the storefront /export form posts here. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = submitExportEnquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await submitEnquiry(parsed.data);
  return NextResponse.json({ submitted: true }, { status: 200 });
}
