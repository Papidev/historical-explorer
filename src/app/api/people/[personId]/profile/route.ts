import { NextResponse } from "next/server";
import { personProfiles } from "@/server/personProfile";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) => {
  const { personId } = await params;
  return NextResponse.json({
    profile: personProfiles.getPublic(decodeURIComponent(personId)) ?? null,
  });
};
