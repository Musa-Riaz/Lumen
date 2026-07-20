"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * SyncUserClient
 *
 * Invisible component that calls /api/auth/sync once after the user signs in.
 * This upserts the Clerk user data into the Neon `users` table via the
 * FastAPI backend.
 *
 * Placed in the root layout so it runs on every page load while authenticated.
 * De-duplicated with a ref so it only fires once per mount even in StrictMode.
 */
export function SyncUserClient() {
  const { isSignedIn, isLoaded } = useUser();
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || synced.current) return;
    synced.current = true;

    fetch("/api/auth/sync", { method: "POST" }).catch((err) =>
      console.error("[SyncUserClient] Failed to sync user:", err)
    );
  }, [isSignedIn, isLoaded]);

  return null;
}
