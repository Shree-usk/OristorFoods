import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { validationErrorResponse, serverErrorResponse } from "@/lib/api/responses";
import { getPostIdBySlug, resolveCommentSession, submitComment } from "@/services/blog.service";
import { blogCommentInputSchema, blogSlugParamSchema } from "@/validation/blog.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = blogSlugParamSchema.parse(await params);

  const body: unknown = await request.json().catch(() => null);
  const parsed = blogCommentInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const postId = await getPostIdBySlug(slug);
    if (!postId) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const session = await auth();
    const commentSession = session?.user?.id ? await resolveCommentSession(session.user.id) : null;

    const result = await submitComment(postId, parsed.data, commentSession);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return serverErrorResponse(error, "POST /api/blog/[slug]/comments");
  }
}
