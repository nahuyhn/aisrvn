/*
  Warnings:

  - A unique constraint covering the columns `[paymentCode]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "paymentCode" INTEGER,
ADD COLUMN     "paymentLinkId" TEXT,
ADD COLUMN     "paymentProvider" TEXT,
ADD COLUMN     "qrCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentCode_key" ON "Order"("paymentCode");
