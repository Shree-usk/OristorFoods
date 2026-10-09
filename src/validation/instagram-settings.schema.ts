import { z } from "zod";

export const connectInstagramSchema = z.object({
  accessToken: z.string().trim().min(1, "Paste the access token from Graph API Explorer first."),
});
