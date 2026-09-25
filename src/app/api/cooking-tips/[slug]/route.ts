import { NextResponse } from "next/server";

import { getCookingTipBySlug } from "@/services/cooking-tip.service";
import { cookingTipSlugParamSchema } from "@/validation/cooking-tip.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = cookingTipSlugParamSchema.parse(await params);

  const tip = await getCookingTipBySlug(slug);
  if (!tip) {
    return NextResponse.json({ error: "Cooking tip not found" }, { status: 404 });
  }

  return NextResponse.json(tip, { status: 200 });
}
