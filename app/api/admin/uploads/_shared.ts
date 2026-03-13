import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

type UploadType = "complementar" | "extensao";

function toCertificateType(uploadType: UploadType) {
  return uploadType === "extensao" ? "EXTENSÃO" : "COMPLEMENTAR";
}

export function createAdminUploadGetHandler(uploadType: UploadType) {
  return async function GET(request: NextRequest) {
    const sessionId = request.cookies.get("session")?.value;
    if (!sessionId) {
      return NextResponse.json({ files: [] }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ files: [] }, { status: 403 });
    }

    // 1. Pegar parâmetros de busca e paginação
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get("pageSize") ?? "10"),
    );

    const skip = (page - 1) * pageSize;
    const certificateType = toCertificateType(uploadType);

    const userWhere: Prisma.UserWhereInput = {
      certificados: {
        some: {
          certificatetype: certificateType,
          status: "PENDENTE",
        },
      },
    };

    if (search) {
      userWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        {
          certificados: {
            some: {
              certificatetype: certificateType,
              status: "PENDENTE",
              title: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const [students, totalCount] = await Promise.all([
      db.user.findMany({
        where: userWhere,
        skip,
        take: pageSize,
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          certificados: {
            where: {
              certificatetype: certificateType,
              status: "PENDENTE",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              hours: true,
              status: true,
              fileUrl: true,
              createdAt: true,
            },
          },
        },
      }),
      db.user.count({ where: userWhere }),
    ]);

    return NextResponse.json(
      {
        students: students.map((student) => ({
          id: student.id,
          name: student.name,
          email: student.email,
          status: "PENDENTE",
          files: student.certificados.map((file) => ({
            id: file.id,
            title: file.title,
            hours: file.hours,
            status: file.status,
            fileUrl: file.fileUrl,
            createdAt: file.createdAt,
          })),
        })),
        meta: {
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          currentPage: page,
          pageSize: pageSize,
        },
      },
      { status: 200 },
    );
  };
}
