/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Memory` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Memory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Memory" DROP COLUMN "createdAt",
DROP COLUMN "date",
ADD COLUMN     "memoryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
