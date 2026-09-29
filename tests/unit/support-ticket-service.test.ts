// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { OrderServiceError } from "@/services/order.errors";
import { createTicket, listTicketsForUser } from "@/services/support-ticket.service";

const EMAIL_PREFIX = "supp-ticket-svc-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeOrder(userId: string) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `ORS-TICKET-TEST-${sequence}`,
      idempotencyKey: `idem-ticket-${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: "100.00",
      deliveryCharge: "0.00",
      grandTotal: "100.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
    },
  });
}

afterEach(async () => {
  await prisma.supportTicket.deleteMany({ where: { user: { email: { startsWith: EMAIL_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "ORS-TICKET-TEST-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("support-ticket.service", () => {
  it("creates a ticket without an order reference", async () => {
    const user = await makeUser();
    const ticket = await createTicket(user.id, { category: "Product", subject: "Question about a product", message: "Is this gluten-free?" });
    expect(ticket.category).toBe("Product");
    expect(ticket.status).toBe("Open");
    expect(ticket.orderNumber).toBeNull();
  });

  it("attaches an owned order by number", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    const ticket = await createTicket(user.id, { category: "OrderIssue", subject: "Missing item", message: "One item was missing.", orderNumber: order.orderNumber });
    expect(ticket.orderNumber).toBe(order.orderNumber);
  });

  it("rejects an order number that belongs to another customer", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const order = await makeOrder(owner.id);

    await expect(
      createTicket(stranger.id, { category: "OrderIssue", subject: "Missing item", message: "One item was missing.", orderNumber: order.orderNumber }),
    ).rejects.toBeInstanceOf(OrderServiceError);
  });

  it("lists a user's own tickets newest-first, paginated", async () => {
    const user = await makeUser();
    await createTicket(user.id, { category: "Other", subject: "First", message: "First message" });
    await createTicket(user.id, { category: "Other", subject: "Second", message: "Second message" });

    const page = await listTicketsForUser(user.id, 1, 20);
    expect(page.total).toBe(2);
    expect(page.tickets[0]?.subject).toBe("Second");
  });
});
