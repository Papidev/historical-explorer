import { NextResponse } from "next/server";
import { getPoiDialogContent } from "@/utils";

type Context = {
  params: Promise<{
    city: string;
    poiId: string;
  }>;
};

export const GET = async (_request: Request, { params }: Context) => {
  const { city, poiId } = await params;

  const content = await getPoiDialogContent(
    decodeURIComponent(city),
    decodeURIComponent(poiId),
  );

  return NextResponse.json({ content: content ?? null });
};
