import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { getPostBySlug } from "@/services/blog.service";
import { blogSlugParamSchema } from "@/validation/blog.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = blogSlugParamSchema.parse(await params);
  try {
    const post = await getPostBySlug(slug);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(post, { status: 200 });
  } catch (error) {
    return serverErrorResponse(error, "GET /api/blog/[slug]");
  }
}
