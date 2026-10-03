import { z } from "zod";

/** The only entity types this story wires recordVersion() into today — see versioning.service.ts's MODULE_BY_ENTITY_TYPE for why this isn't a closed Prisma enum at the schema level (a future adopter needs no migration), but the API layer still only knows how to route a rollback for these three. */
export const versionedEntityTypeEnum = z.enum(["HomepageLayout", "Recipe", "BlogPost"]);

export const diffVersionsQuerySchema = z.object({
  a: z.string().min(1),
  b: z.string().min(1),
});
