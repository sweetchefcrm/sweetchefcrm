-- CreateTable
CREATE TABLE "avoirs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "commercialId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "dateAvoir" TIMESTAMP(3) NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avoir_import_logs" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "avoir_import_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
