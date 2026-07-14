import type { TeaserSectionData } from "@/types/home";
import { TeaserSection } from "./teaser-section";

export function FoodAcademyTeaser({ data }: { data: TeaserSectionData }) {
  return <TeaserSection data={data} />;
}
