import { db } from "@/lib/db";
import { internshipSearchQuerySchema } from "@/lib/schemas/internship.schema";
import { validateQueryParams } from "@/lib/validators/validate-request";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  compareInternshipRows,
  requireInternshipAdmin,
  toAdminInternshipRow,
} from "./_shared";

export async function GET(request: NextRequest) {
  const auth = await requireInternshipAdmin(request);
  if (auth instanceof Response) return auth;

  const query = validateQueryParams(
    request.nextUrl.searchParams,
    internshipSearchQuerySchema,
  );
  if (query instanceof Response) return query;

  const search = query.q.trim();
  const page = query.page;
  const pageSize = query.pageSize;
  const skip = (page - 1) * pageSize;

  const where: Prisma.InternshipWhereInput = {};
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const internships = await db.internship.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      submissions: true,
    },
  });

  const sorted = [...internships].sort((a, b) =>
    compareInternshipRows(
      { status: a.status, createdAt: a.createdAt, name: a.user.name },
      { status: b.status, createdAt: b.createdAt, name: b.user.name },
    ),
  );

  const totalItems = sorted.length;
  const paged = sorted.slice(skip, skip + pageSize);

  return NextResponse.json(
    {
      students: paged.map((internship) => toAdminInternshipRow(internship)),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
      },
    },
    { status: 200 },
  );
}
