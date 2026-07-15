import * as collectionRepository from "@/repositories/collection.repository";

export async function getPublishedCollectionBySlug(slug: string, date: Date = new Date()) {
  const collection = await collectionRepository.findCollectionBySlug(slug);
  if (!collection || collection.status !== "Active") return null;
  if (collection.startDate && date < collection.startDate) return null;
  if (collection.endDate && date > collection.endDate) return null;
  return collection;
}
