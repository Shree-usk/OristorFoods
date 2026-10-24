import type { TeaserSectionData } from "@/types/home";
import { ExportBanner } from "./export-banner";

export function ExportSolutions({ data }: { data: TeaserSectionData }) {
  return <ExportBanner data={data} />;
}
