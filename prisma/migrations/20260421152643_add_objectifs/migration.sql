-- CreateTable
CREATE TABLE "objectifs" (
    "id" TEXT NOT NULL,
    "commercialId" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "montantCible" DECIMAL(10,2) NOT NULL,
    "tauxCroissance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectifs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "objectifs_commercialId_mois_annee_key" ON "objectifs"("commercialId", "mois", "annee");

-- AddForeignKey
ALTER TABLE "objectifs" ADD CONSTRAINT "objectifs_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
