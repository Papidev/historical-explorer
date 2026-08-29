import { NextResponse } from "next/server";
import { getPoiStoryContent } from "@/utils";

type Context = {
  params: Promise<{
    city: string;
    poiId: string;
  }>;
};

export const GET = async (_request: Request, { params }: Context) => {
  const { city, poiId } = await params;

  const storyContent = await getPoiStoryContent(
    decodeURIComponent(city),
    decodeURIComponent(poiId),
  );

  return NextResponse.json({ storyContent: storyContent ?? null });
};
