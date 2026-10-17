import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SelectedExportProduct {
  id: string;
  name: string;
  sku: string;
}

interface ExportCatalogueSelectionState {
  items: SelectedExportProduct[];
  toggle: (product: SelectedExportProduct) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

/** Export & Wholesale catalogue's product selection — must survive navigating from the collections grid/catalogue to the enquiry form further down the same page, so it's persisted the same way the guest wishlist-store.ts is. */
export const useExportCatalogueSelectionStore = create<ExportCatalogueSelectionState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (product) => {
        const exists = get().items.some((item) => item.id === product.id);
        set({ items: exists ? get().items.filter((item) => item.id !== product.id) : [...get().items, product] });
      },
      remove: (productId) => set({ items: get().items.filter((item) => item.id !== productId) }),
      has: (productId) => get().items.some((item) => item.id === productId),
      clear: () => set({ items: [] }),
    }),
    { name: "oristor-export-catalogue-selection" },
  ),
);
