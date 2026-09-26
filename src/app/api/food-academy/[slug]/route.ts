import { NextResponse } from "next/server";

import { getEntryBySlug } from "@/services/food-academy.service";
import { foodAcademySlugParamSchema } from "@/validation/food-academy.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = foodAcademySlugParamSchema.parse(await params);

  const entry = await getEntryBySlug(slug);
  if (!entry) {
    return NextResponse.json({ error: "Food Academy entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry, { status: 200 });
}
