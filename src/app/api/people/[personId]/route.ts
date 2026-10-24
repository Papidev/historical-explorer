import { visitorContent } from "@/server/visitorContent";
import { createVisitorHandler } from "@/server/visitorContent/handler";
import { publicCatalog } from "@/server/publicCatalog";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) => {
  const { personId } = await params;
  const query = new URL(request.url).searchParams;
  return createVisitorHandler(visitorContent, publicCatalog).getPerson(
    personId,
    query.get("city") ?? undefined,
    query.get("poiId") ?? undefined,
  );
};
