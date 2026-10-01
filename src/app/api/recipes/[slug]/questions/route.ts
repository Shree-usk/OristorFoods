import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeQaErrorResponse } from "@/lib/api/recipe-qa-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listPublishedQuestions, submitRecipeQuestion } from "@/services/recipe-qa.service";
import { recipeQuestionInputSchema, recipeQuestionListQuerySchema } from "@/validation/recipe-question.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = recipeQuestionListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listPublishedQuestions(slug, parsed.data), { status: 200 });
  } catch (error) {
    return recipeQaErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = recipeQuestionInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await submitRecipeQuestion(session.user.id, slug, parsed.data);
    return NextResponse.json({}, { status: 201 });
  } catch (error) {
    return recipeQaErrorResponse(error);
  }
}
