import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatIngredientLine, formatScaledQuantity } from "@/lib/recipe-scaling";
import type { RecipeDetail, RecipeIngredientItem } from "@/types/recipe";

// @react-pdf/renderer embeds fonts via fontkit, which needs real font
// files — the web app's next/font/google CSS mechanism doesn't apply here.
// @fontsource ships the same Google Fonts as .woff files; registered once
// at module load (fine to repeat per Next.js dev-server module reload —
// Font.register is idempotent per family+weight).
const FONT_DIR = path.join(process.cwd(), "node_modules");

Font.register({
  family: "Cormorant Garamond",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Hex values from docs/blueprint.md Section 2's brand color table.
const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  gold: "#CDAF52",
  chilliRed: "#B22222",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.ivory, padding: 40, fontFamily: "Inter", fontSize: 10, color: COLORS.charcoal },
  title: { fontFamily: "Cormorant Garamond", fontSize: 28, marginBottom: 4 },
  categoryLine: { fontSize: 10, color: COLORS.gold, fontWeight: 700, marginBottom: 12 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: `1pt solid ${COLORS.softBorder}` },
  metaLabel: { fontSize: 8, color: COLORS.stoneGrey },
  metaValue: { fontSize: 11, fontWeight: 600 },
  sectionHeading: { fontFamily: "Cormorant Garamond", fontSize: 16, fontWeight: 700, color: COLORS.chilliRed, marginTop: 16, marginBottom: 8 },
  ingredientRow: { fontSize: 10, marginBottom: 4 },
  stepRow: { fontSize: 10, marginBottom: 8, flexDirection: "row", gap: 8 },
  stepNumber: { fontWeight: 700, color: COLORS.chilliRed, width: 20 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

/**
 * The PDF renders at the recipe's default servings (not a visitor-adjusted
 * count — it's a static artifact, not a live view), so this needs no scale
 * factor: `formatScaledQuantity` is still required to round the base
 * quantity to a display string, matching the same
 * "quantity + unit + displayText" composition the web view's JSON-LD block
 * already uses (src/app/(storefront)/recipes/[slug]/page.tsx).
 */
export function formatPdfIngredientLine(ingredient: RecipeIngredientItem): string {
  return formatIngredientLine(ingredient, ingredient.quantity === null ? null : formatScaledQuantity(ingredient.quantity, ingredient.unit));
}

function RecipePdfDocument({ recipe }: { recipe: RecipeDetail }) {
  return (
    <Document title={`${recipe.title} — Oristor`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.categoryLine}>{recipe.categoryName}{recipe.cuisine ? ` · ${recipe.cuisine}` : ""}</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Prep</Text>
            <Text style={styles.metaValue}>{recipe.prepTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Cook</Text>
            <Text style={styles.metaValue}>{recipe.cookTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.metaValue}>{recipe.totalTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Serves</Text>
            <Text style={styles.metaValue}>{recipe.servings}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Difficulty</Text>
            <Text style={styles.metaValue}>{recipe.difficulty}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Ingredients</Text>
        {recipe.ingredients.map((ingredient) => (
          <Text key={ingredient.id} style={styles.ingredientRow}>
            • {formatPdfIngredientLine(ingredient)}
          </Text>
        ))}

        <Text style={styles.sectionHeading}>Method</Text>
        {recipe.steps.map((step) => (
          <View key={step.stepNumber} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{step.stepNumber}.</Text>
            <Text>{step.instruction}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com
        </Text>
      </Page>
    </Document>
  );
}

export function renderRecipePdf(recipe: RecipeDetail): Promise<Buffer> {
  return renderToBuffer(<RecipePdfDocument recipe={recipe} />);
}
