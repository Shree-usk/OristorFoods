-- Story 4 (Payment Restriction). Purely additive: a new PaymentMethod
-- enum, an Order.paymentMethod snapshot column (defaults "Card" so every
-- pre-Story-4 order, all of which went through the single undifferentiated
-- mock flow, backfills correctly), and two new optional columns on the
-- existing (previously decorative) PaymentMethodSetting table.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Card', 'BankTransfer', 'CashOnDelivery');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'Card';

-- AlterTable
ALTER TABLE "PaymentMethodSetting" ADD COLUMN     "allowedForRestrictedOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "method" "PaymentMethod";

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodSetting_method_key" ON "PaymentMethodSetting"("method");
