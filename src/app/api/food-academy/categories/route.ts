import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listCategories } from "@/services/food-academy.service";

export async function GET() {
  try {
    return NextResponse.json(await listCategories());
  } catch (error) {
    return serverErrorResponse(error, "GET /api/food-academy/categories");
  }
}
