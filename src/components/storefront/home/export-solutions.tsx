import type { TeaserSectionData } from "@/types/home";
import { TeaserSection } from "./teaser-section";

export function ExportSolutions({ data }: { data: TeaserSectionData }) {
  return <TeaserSection data={data} reverse className="bg-beige" />;
}
