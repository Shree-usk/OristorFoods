import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listCookingTips } from "@/services/cooking-tip.service";
import { cookingTipListQuerySchema } from "@/validation/cooking-tip.schema";

export async function GET(request: Request) {
  const query = cookingTipListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listCookingTips(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/cooking-tips");
  }
}
