import { db } from "@/lib/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  groupAndSortByStudent,
  requireExtensionAdmin,
  toAdminProjectPayload,
} from "./_shared";

export async function GET(request: NextRequest) {
  const auth = await requireExtensionAdmin(request);
  if (auth instanceof Response) return auth;

  const projects = await db.extensionProject.findMany({
    include: {
      user: { select: { name: true, email: true } },
      certificate: true,
    },
  });

  const students = groupAndSortByStudent(projects.map(toAdminProjectPayload));

  return NextResponse.json({ students }, { status: 200 });
}
