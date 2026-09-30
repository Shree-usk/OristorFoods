import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse } from "@/lib/api/responses";

/** STORY-038. Proves the admin session-gating chain end to end for any authenticated admin, any role — no module/action check, since proxy.ts's matcher excludes api/ routes, so every admin API route must check its own session (this one) and, where relevant, permission.service.ts::requirePermission. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();
  return NextResponse.json({ status: "ok" });
}
