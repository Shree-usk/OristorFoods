import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listResources } from "@/services/download.service";
import { downloadListQuerySchema } from "@/validation/download.schema";

export async function GET(request: Request) {
  const query = downloadListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listResources(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/downloads");
  }
}
