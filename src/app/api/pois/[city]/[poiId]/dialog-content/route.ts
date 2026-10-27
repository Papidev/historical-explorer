import { visitorContent } from "@/server/visitorContent";
import { createVisitorHandler } from "@/server/visitorContent/handler";
import { publicCatalog } from "@/server/publicCatalog";

type Context = {
  params: Promise<{ city: string; poiId: string }>;
};

export const GET = async (_request: Request, { params }: Context) => {
  const { city, poiId } = await params;
  return createVisitorHandler(visitorContent, publicCatalog).getStory(city, poiId);
};
