import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { qaErrorResponse } from "@/lib/api/qa-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listPublishedQuestions, submitQuestion } from "@/services/qa.service";
import { questionInputSchema, questionListQuerySchema } from "@/validation/question.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = questionListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listPublishedQuestions(slug, parsed.data), { status: 200 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const question = await submitQuestion(session.user.id, slug, parsed.data);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}
