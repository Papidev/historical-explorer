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
  const requestUrl = new URL(_request.url);
  const contentSlug = requestUrl.searchParams.get("contentSlug");
  if (!contentSlug) {
    return NextResponse.json({ content: null });
  }

  const content = await getPoiDialogContent(
    decodeURIComponent(city),
    contentSlug,
    decodeURIComponent(poiId),
  );

  return NextResponse.json({ content: content ?? null });
};
