import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      // Apply the headers to the incoming request
      headers: requestHeaders,
    },
  });

  // Add caching headers to the response
  // This is especially useful for dynamic routes that aren't covered by the static headers config
  response.headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=86400"
  );

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  // Apply to all routes except for API routes, static files, and _next internal routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
