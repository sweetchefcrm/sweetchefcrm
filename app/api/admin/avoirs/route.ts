import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

// GET — liste des imports avoirs
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const logs = await prisma.avoirImportLog.findMany({
    orderBy: { importedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(logs);
}
