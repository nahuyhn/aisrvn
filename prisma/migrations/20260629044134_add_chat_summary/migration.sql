-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryMessageCount" INTEGER NOT NULL DEFAULT 0;
