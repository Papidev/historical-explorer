import { NextResponse } from "next/server";
import { aiProgressServerInstance, readAiProgress } from "@/server/aiProgress";

export const dynamic = "force-dynamic";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) => {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  const { runId } = await params;
  try {
    const progress = readAiProgress(runId);
    return progress
      ? NextResponse.json(
          progress.status === "running" &&
            progress.serverInstance &&
            progress.serverInstance !== aiProgressServerInstance
            ? {
                ...progress,
                status: "cancelled",
                entries: [
                  ...progress.entries,
                  {
                    at: new Date().toISOString(),
                    message: "Server restarted. Resume the queue from saved checkpoints.",
                  },
                ],
              }
            : progress,
          { headers: { "Cache-Control": "no-store" } },
        )
      : new Response(null, { status: 404 });
  } catch {
    return new Response(null, { status: 404 });
  }
};
