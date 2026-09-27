import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listPosts } from "@/services/blog.service";
import { blogListQuerySchema } from "@/validation/blog.schema";

export async function GET(request: Request) {
  const query = blogListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listPosts(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/blog");
  }
}
