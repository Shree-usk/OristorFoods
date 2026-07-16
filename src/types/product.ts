import type { ProductCardData } from "@/types/home";

export interface ProductListItem extends ProductCardData {
  inStock: boolean;
}
