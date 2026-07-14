import type { TeaserSectionData } from "@/types/home";
import { TeaserSection } from "./teaser-section";

export function RewardsClubTeaser({ data }: { data: TeaserSectionData }) {
  return <TeaserSection data={data} />;
}
