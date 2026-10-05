import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminUser = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      role: true,
      accessStatus: true,
      canManageComplementar: true,
      canManageExtensao: true,
      canManageEstagio: true,
      canManageUsers: true,
    },
  });

  if (
    !adminUser ||
    adminUser.role !== "ADMIN" ||
    adminUser.accessStatus !== "APPROVED"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [complementar, extensao, estagio, usuarios] = await Promise.all([
    adminUser.canManageComplementar
      ? db.certificate.count({
          where: {
            certificatetype: "COMPLEMENTAR",
            status: "PENDING",
          },
        })
      : Promise.resolve(0),
    adminUser.canManageExtensao
      ? db.certificate.count({
          where: {
            certificatetype: "EXTENSAO",
            status: "PENDING",
          },
        })
      : Promise.resolve(0),
    adminUser.canManageEstagio
      ? Promise.all([
          db.internship.count({ where: { status: "PENDING" } }),
          db.internshipDocument.count({ where: { status: "PENDING" } }),
        ]).then(([internships, documents]) => internships + documents)
      : Promise.resolve(0),
    adminUser.canManageUsers
      ? db.user.count({
          where: {
            accessStatus: "PENDING",
          },
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json(
    {
      complementar,
      extensao,
      estagio,
      usuarios,
    },
    { status: 200 },
  );
}
