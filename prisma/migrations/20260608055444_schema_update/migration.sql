-- DropForeignKey
ALTER TABLE "Memory" DROP CONSTRAINT "Memory_userId_fkey";

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
