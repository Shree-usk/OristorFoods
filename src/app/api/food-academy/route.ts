import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listEntries } from "@/services/food-academy.service";
import { foodAcademyListQuerySchema } from "@/validation/food-academy.schema";

export async function GET(request: Request) {
  const query = foodAcademyListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listEntries(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/food-academy");
  }
}
