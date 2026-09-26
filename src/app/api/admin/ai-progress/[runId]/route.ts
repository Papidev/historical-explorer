import { NextResponse } from "next/server";
import { readAiProgress } from "@/server/aiProgress";

export const dynamic = "force-dynamic";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) => {
  const { runId } = await params;
  try {
    const progress = readAiProgress(runId);
    return progress
      ? NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } })
      : new Response(null, { status: 404 });
  } catch {
    return new Response(null, { status: 404 });
  }
};
