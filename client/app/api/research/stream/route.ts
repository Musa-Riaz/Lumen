import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL!;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

/**
 * POST /api/research/stream
 *
 * Authenticates the request via Clerk, then proxies the Server-Sent Events
 * stream from the FastAPI backend back to the browser.
 *
 * Body: { topic: string; session_id?: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();

  const backendRes = await fetch(`${BACKEND_URL}/research/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lumen-internal-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({ ...body, user_id: userId }),
    // @ts-expect-error – Node 18 fetch supports duplex for streaming
    duplex: "half",
  });

  if (!backendRes.ok || !backendRes.body) {
    return NextResponse.json({ error: "Backend error" }, { status: 502 });
  }

  return new NextResponse(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
