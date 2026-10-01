import { z } from "zod";

import { customerGroupEnum } from "@/validation/pricing.schema";

export const setCustomerGroupSchema = z.object({
  customerGroup: customerGroupEnum,
});
