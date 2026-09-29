import type { Metadata } from "next";

import { AddressList } from "@/components/storefront/account/address-list";

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Addresses</h1>
      <p className="mt-2 text-body text-charcoal/70">Manage your saved shipping and billing addresses.</p>
      <div className="mt-6">
        <AddressList />
      </div>
    </div>
  );
}
