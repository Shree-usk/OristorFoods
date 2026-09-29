// @vitest-environment node
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  MAX_ADDRESSES_PER_USER,
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  setDefaultBilling,
  setDefaultShipping,
  updateAddress,
} from "@/services/address.service";
import { AddressForbiddenError, AddressLimitExceededError, AddressNotFoundError } from "@/services/address.errors";
import type { AddressFields } from "@/repositories/address.repository";

const EMAIL_PREFIX = "addr-svc-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

function fields(overrides: Partial<AddressFields> = {}): AddressFields {
  sequence += 1;
  return {
    label: "Home",
    type: "Both",
    recipientName: `Recipient ${sequence}`,
    phone: "+94 77 000 0000",
    line1: `${sequence} Test Lane`,
    line2: null,
    city: "Colombo",
    district: "Colombo",
    postalCode: null,
    country: "LK",
    companyName: null,
    taxId: null,
    ...overrides,
  };
}

describe("address.service", () => {
  describe("createAddress", () => {
    it("makes the first address both defaults automatically", async () => {
      const user = await makeUser();
      const address = await createAddress(user.id, fields());
      expect(address.isDefaultBilling).toBe(true);
      expect(address.isDefaultShipping).toBe(true);
    });

    it("does not default a second address unless explicitly requested", async () => {
      const user = await makeUser();
      await createAddress(user.id, fields());
      const second = await createAddress(user.id, fields());
      expect(second.isDefaultBilling).toBe(false);
      expect(second.isDefaultShipping).toBe(false);
    });

    it("setting a new default billing address un-defaults the previous one", async () => {
      const user = await makeUser();
      const first = await createAddress(user.id, fields());
      const second = await createAddress(user.id, fields(), { setAsDefaultBilling: true });

      const refreshedFirst = await getAddress(user.id, first.id);
      expect(refreshedFirst.isDefaultBilling).toBe(false);
      expect(second.isDefaultBilling).toBe(true);
      // Shipping default is untouched — billing and shipping defaults are independent.
      expect(refreshedFirst.isDefaultShipping).toBe(true);
    });

    it("rejects an 11th address", async () => {
      const user = await makeUser();
      for (let i = 0; i < MAX_ADDRESSES_PER_USER; i += 1) {
        await createAddress(user.id, fields());
      }
      await expect(createAddress(user.id, fields())).rejects.toThrow(AddressLimitExceededError);
      expect(await listAddresses(user.id)).toHaveLength(MAX_ADDRESSES_PER_USER);
    });
  });

  describe("setDefaultBilling / setDefaultShipping", () => {
    it("swap the default atomically, leaving exactly one default of each kind", async () => {
      const user = await makeUser();
      const a = await createAddress(user.id, fields());
      const b = await createAddress(user.id, fields());
      const c = await createAddress(user.id, fields());

      await setDefaultShipping(user.id, b.id);
      await setDefaultShipping(user.id, c.id);

      const addresses = await listAddresses(user.id);
      const defaultShippingCount = addresses.filter((address) => address.isDefaultShipping).length;
      expect(defaultShippingCount).toBe(1);
      expect(addresses.find((address) => address.id === c.id)?.isDefaultShipping).toBe(true);
      expect(addresses.find((address) => address.id === a.id)?.isDefaultShipping).toBe(false);
      expect(addresses.find((address) => address.id === b.id)?.isDefaultShipping).toBe(false);
    });

    it("rejects setting a default on another customer's address", async () => {
      const owner = await makeUser();
      const stranger = await makeUser();
      const address = await createAddress(owner.id, fields());

      await expect(setDefaultBilling(stranger.id, address.id)).rejects.toThrow(AddressForbiddenError);
    });
  });

  describe("updateAddress", () => {
    it("applies field edits and a default-swap request in the same call", async () => {
      const user = await makeUser();
      const first = await createAddress(user.id, fields());
      const second = await createAddress(user.id, fields());

      const updated = await updateAddress(user.id, second.id, { label: "Work", setAsDefaultShipping: true });
      expect(updated?.label).toBe("Work");
      expect(updated?.isDefaultShipping).toBe(true);

      const refreshedFirst = await getAddress(user.id, first.id);
      expect(refreshedFirst.isDefaultShipping).toBe(false);
    });
  });

  describe("deleteAddress", () => {
    it("removes the address", async () => {
      const user = await makeUser();
      const address = await createAddress(user.id, fields());
      await deleteAddress(user.id, address.id);
      await expect(getAddress(user.id, address.id)).rejects.toThrow(AddressNotFoundError);
    });

    it("rejects deleting another customer's address", async () => {
      const owner = await makeUser();
      const stranger = await makeUser();
      const address = await createAddress(owner.id, fields());

      await expect(deleteAddress(stranger.id, address.id)).rejects.toThrow(AddressForbiddenError);
    });
  });
});
