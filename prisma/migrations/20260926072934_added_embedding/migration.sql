/*
  Warnings:

  - You are about to drop the column `embedding` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "embedding" DOUBLE PRECISION[];

-- AlterTable
ALTER TABLE "User" DROP COLUMN "embedding";
