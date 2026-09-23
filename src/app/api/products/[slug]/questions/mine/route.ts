import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { qaErrorResponse } from "@/lib/api/qa-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listMyOpenQuestions } from "@/services/qa.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ questions: await listMyOpenQuestions(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}
