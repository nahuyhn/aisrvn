-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "vipDiscount" INTEGER,
ADD COLUMN     "vipNote" TEXT;
