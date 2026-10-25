import { ExportHero } from "@/components/storefront/home/export-hero";
import { getExportHeroForStorefront } from "@/services/export-hero.service";

export async function ExportSolutions() {
  const data = await getExportHeroForStorefront();
  return <ExportHero data={data} />;
}
