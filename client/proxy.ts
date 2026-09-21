import { clerkMiddleware } from "@clerk/nextjs/server";

const isPublicRoute = (pathname: string) => {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth")
  );
};

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

