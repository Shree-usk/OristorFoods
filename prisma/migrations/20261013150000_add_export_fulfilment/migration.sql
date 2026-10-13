-- Export fulfilment flow (post-Story-5 follow-up). Purely additive: a new
-- FulfilmentMethod enum, traveler/pickup snapshot columns on Order
-- (defaulting Delivery/null so every existing order backfills correctly),
-- a packagingInstructions snapshot on OrderItem, pickup-location fields on
-- CompanySetting, and a new BankAccountSetting list.

-- CreateEnum
CREATE TYPE "FulfilmentMethod" AS ENUM ('Delivery', 'Pickup');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfilmentMethod" "FulfilmentMethod" NOT NULL DEFAULT 'Delivery',
ADD COLUMN     "readyForPickupAt" TIMESTAMP(3),
ADD COLUMN     "travelerCountry" TEXT,
ADD COLUMN     "travelerName" TEXT,
ADD COLUMN     "travelerPhone" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "packagingInstructions" TEXT;

-- AlterTable
ALTER TABLE "CompanySetting" ADD COLUMN     "pickupLocationAddress" TEXT,
ADD COLUMN     "pickupLocationMapUrl" TEXT,
ADD COLUMN     "pickupLocationName" TEXT;

-- CreateTable
CREATE TABLE "BankAccountSetting" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branch" TEXT,
    "swiftCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccountSetting_pkey" PRIMARY KEY ("id")
);
