import { z } from "zod";

export const menuLocationEnum = z.enum(["Header", "Footer", "Mobile"]);
const menuLinkTypeEnum = z.enum(["None", "Internal", "External"]);
const menuItemVisibilityEnum = z.enum(["Always", "Authenticated", "CustomerGroupTarget"]);
const customerGroupEnum = z.enum(["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"]);
const menuContentBlockTypeEnum = z.enum(["Link", "PromoTile"]);

const menuItemBase = {
  parentId: z.string().min(1).nullable(),
  label: z.string().trim().min(1, "Label is required.").max(100),
  linkType: menuLinkTypeEnum,
  internalPath: z.string().trim().min(1).max(500).nullable(),
  externalUrl: z.string().trim().url("Enter a valid URL.").max(2000).nullable(),
  openInNewTab: z.boolean().default(false),
  icon: z.string().trim().min(1).nullable(),
  visibility: menuItemVisibilityEnum.default("Always"),
  targetCustomerGroup: customerGroupEnum.nullable(),
  active: z.boolean().default(true),
  contentBlockType: menuContentBlockTypeEnum.default("Link"),
  promoImageUrl: z.string().trim().min(1).nullable(),
  promoImageAlt: z.string().trim().min(1).nullable(),
  promoHeading: z.string().trim().min(1).max(200).nullable(),
  promoCtaLabel: z.string().trim().min(1).max(60).nullable(),
};

export const createMenuItemSchema = z.object(menuItemBase);

export const updateMenuItemSchema = z.object({
  label: menuItemBase.label.optional(),
  linkType: menuLinkTypeEnum.optional(),
  internalPath: menuItemBase.internalPath.optional(),
  externalUrl: menuItemBase.externalUrl.optional(),
  openInNewTab: z.boolean().optional(),
  icon: menuItemBase.icon.optional(),
  visibility: menuItemVisibilityEnum.optional(),
  targetCustomerGroup: menuItemBase.targetCustomerGroup.optional(),
  active: z.boolean().optional(),
  contentBlockType: menuContentBlockTypeEnum.optional(),
  promoImageUrl: menuItemBase.promoImageUrl.optional(),
  promoImageAlt: menuItemBase.promoImageAlt.optional(),
  promoHeading: menuItemBase.promoHeading.optional(),
  promoCtaLabel: menuItemBase.promoCtaLabel.optional(),
});

export const reorderMenuItemsSchema = z.object({
  parentId: z.string().min(1).nullable(),
  orderedItemIds: z.array(z.string().min(1)).min(1),
});

export const reparentMenuItemSchema = z.object({
  newParentId: z.string().min(1).nullable(),
});

export const linkCheckSchema = z.object({
  menuId: z.string().min(1),
});
