-- AlterTable: Remove lineaire column from clients
ALTER TABLE "clients" DROP COLUMN IF EXISTS "lineaire";

-- CreateTable: facings
CREATE TABLE "facings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nbFacings" INTEGER NOT NULL,
    "mois" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facings_clientId_mois_key" ON "facings"("clientId", "mois");

-- AddForeignKey
ALTER TABLE "facings" ADD CONSTRAINT "facings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facings" ADD CONSTRAINT "facings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
