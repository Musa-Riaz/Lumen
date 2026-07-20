import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL!;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

const HEADERS = {
  "Content-Type": "application/json",
  "x-lumen-internal-key": INTERNAL_API_KEY,
};

/**
 * GET /api/sessions
 * Returns all sessions for the authenticated user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const res = await fetch(
    `${BACKEND_URL}/sessions?user_id=${encodeURIComponent(userId)}`,
    { headers: HEADERS }
  );

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}

/**
 * POST /api/sessions
 * Creates a new session for the authenticated user.
 * Body: { title?: string; topic?: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/sessions`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ user_id: userId, ...body }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
