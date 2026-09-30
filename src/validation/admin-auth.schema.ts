import { z } from "zod";

/** STORY-038. Deliberately its own file, not shared with the customer credentialsSchema — the two auth systems stay fully separate. */
export const adminCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AdminCredentialsInput = z.infer<typeof adminCredentialsSchema>;
