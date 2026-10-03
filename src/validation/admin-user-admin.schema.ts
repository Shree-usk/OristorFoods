import { z } from "zod";

import { passwordSchema } from "@/validation/auth.schema";

export const inviteAdminUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  name: z.string().trim().min(1, "Name is required.").max(150),
  roleId: z.string().trim().min(1, "Role is required."),
});

export const updateAdminUserRoleSchema = z.object({
  roleId: z.string().trim().min(1, "Role is required."),
});

export const acceptInviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  token: z.string().trim().min(1, "Invite token is required."),
  name: z.string().trim().min(1, "Name is required.").max(150),
  password: passwordSchema,
});
