import { NextResponse } from "next/server";
import { publicCatalog } from "@/server/publicCatalog";

type Context = {
  params: Promise<{
    city: string;
    poiId: string;
  }>;
};

export const GET = async (_request: Request, { params }: Context) => {
  const { city, poiId } = await params;

  const storyContent = publicCatalog.getStoryContent(city, poiId);

  return NextResponse.json({ storyContent: storyContent ?? null });
};
