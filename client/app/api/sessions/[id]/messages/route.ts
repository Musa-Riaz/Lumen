import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL!;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

const HEADERS = {
  "x-lumen-internal-key": INTERNAL_API_KEY,
};

/**
 * GET /api/sessions/[id]/messages
 * Returns all messages for the given session.
 * The session must belong to the authenticated user.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  const res = await fetch(`${BACKEND_URL}/sessions/${id}/messages`, {
    headers: HEADERS,
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
