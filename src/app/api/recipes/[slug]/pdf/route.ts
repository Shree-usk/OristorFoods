import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { getRecipeForExport } from "@/services/recipe.service";
import { renderRecipePdf } from "@/services/recipe-pdf.service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const recipe = await getRecipeForExport(slug);
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    const buffer = await renderRecipePdf(recipe);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${recipe.slug}.pdf"`,
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes/[slug]/pdf");
  }
}
