import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { logOutAllDevices } from "@/services/security.service";

/** STORY-034. Invalidates every session, including the one making this request — see security.service.ts's header comment. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  await logOutAllDevices(userId);
  return NextResponse.json({ ok: true });
}
