import { NextResponse } from "next/server";

import { submitEnquiry } from "@/services/contact-enquiry.service";
import { submitContactEnquirySchema } from "@/validation/contact-enquiry.schema";

/** STORY-072. Public, unauthenticated — the storefront /contact-us form posts here. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = submitContactEnquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await submitEnquiry(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
