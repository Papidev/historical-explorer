import { NextResponse } from "next/server";
import { publicCatalog } from "@/server/publicCatalog";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) => {
  const { personId } = await params;
  return NextResponse.json({
    person: publicCatalog.getPerson(personId) ?? null,
  });
};
