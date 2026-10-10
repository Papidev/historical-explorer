import { requestAiProgressStop } from "@/server/aiProgress";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) => {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  try {
    return Response.json({ requested: requestAiProgressStop((await params).runId) });
  } catch {
    return new Response(null, { status: 400 });
  }
};
