import { NextResponse } from "next/server";

import { subscribe } from "@/services/newsletter.service";
import { newsletterSubscribeSchema } from "@/validation/newsletter.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = newsletterSubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await subscribe(parsed.data);
  return NextResponse.json({ subscribed: true }, { status: 200 });
}
