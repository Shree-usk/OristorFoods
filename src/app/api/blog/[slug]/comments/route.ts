import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { validationErrorResponse, serverErrorResponse } from "@/lib/api/responses";
import { getPostIdBySlug, resolveCommentSession, submitComment } from "@/services/blog.service";
import { blogCommentInputSchema, blogGuestCommentInputSchema, blogSlugParamSchema } from "@/validation/blog.schema";

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
    // resolveCommentSession returns null both when there's no session and
    // when a session's userId no longer resolves to a real User row (a
    // deleted account, or a stale/forged JWT) — either way, submitComment
    // treats a null session as a guest submission. No separate error
    // response for the latter case: same "never let an edge case learn
    // which path it hit" rule as the honeypot/rate-limit checks below.
    const commentSession = session?.user?.id ? await resolveCommentSession(session.user.id) : null;

    // Guest path only: an authenticated commentSession supplies its own
    // identity (see submitComment), so name/email stay optional for it.
    // A guest request must actually supply both — re-validate here rather
    // than trusting the permissive `blogCommentInputSchema` parse above,
    // which only enforces "not undefined", not "non-empty".
    if (!commentSession) {
      const guestParsed = blogGuestCommentInputSchema.safeParse(parsed.data);
      if (!guestParsed.success) return validationErrorResponse(guestParsed.error);
    }

    const result = await submitComment(postId, parsed.data, commentSession);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return serverErrorResponse(error, "POST /api/blog/[slug]/comments");
  }
}
