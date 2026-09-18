import { NextResponse } from "next/server";
import { people } from "@/server/person";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) => {
  const { personId } = await params;
  return NextResponse.json({
    person: people.getPublic(decodeURIComponent(personId)) ?? null,
  });
};
