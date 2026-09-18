import type { ProductDetailNutrition } from "@/services/product.service";

const NUTRIENT_ROWS: Array<{ key: keyof Omit<ProductDetailNutrition, "servingSize">; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "saturatedFat", label: "Saturated Fat", unit: "g" },
  { key: "carbohydrates", label: "Carbohydrates", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

export function NutritionTable({ nutrition }: { nutrition: ProductDetailNutrition }) {
  return (
    <table className="w-full text-small text-charcoal">
      <caption className="mb-2 text-left font-medium">Serving size: {nutrition.servingSize}</caption>
      <tbody>
        {NUTRIENT_ROWS.map((row) => (
          <tr key={row.key} className="border-b border-charcoal/10">
            <th scope="row" className="py-1.5 text-left font-normal text-charcoal/70">
              {row.label}
            </th>
            <td className="py-1.5 text-right font-number">{`${nutrition[row.key]} ${row.unit}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
