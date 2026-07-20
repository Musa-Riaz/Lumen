import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL!;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

/**
 * POST /api/auth/sync
 * Syncs the currently signed-in Clerk user to the FastAPI backend.
 * Called client-side via SyncUserClient component on mount.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const res = await fetch(`${BACKEND_URL}/users/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lumen-internal-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      image_url: user.imageUrl ?? null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json({ status: "synced" });
}
