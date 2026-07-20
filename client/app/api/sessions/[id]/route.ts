import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL!;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

const HEADERS = {
  "Content-Type": "application/json",
  "x-lumen-internal-key": INTERNAL_API_KEY,
};

/**
 * PATCH /api/sessions/[id]
 * Rename a session's title.
 * Body: { title: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/sessions/${id}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}

/**
 * DELETE /api/sessions/[id]
 * Delete a session and all its messages (cascade handled by DB).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  const res = await fetch(`${BACKEND_URL}/sessions/${id}`, {
    method: "DELETE",
    headers: HEADERS,
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
