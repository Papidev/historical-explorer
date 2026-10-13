import { generateDraftStories } from "@/server/adminAiGeneration";
import { sanitizeErrorMessage } from "@/server/generationRunLog";

export const POST = async (request: Request) => {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  try {
    return Response.json(await generateDraftStories(await request.formData()));
  } catch (error) {
    return Response.json(
      { error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)) },
      { status: 400 },
    );
  }
};
