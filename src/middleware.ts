// Remove all locale redirect logic so that / does not redirect to /fr or /en. The middleware should do nothing or be removed entirely if not needed.
// If you want to keep the file for future use, just export an empty middleware function.

export function middleware() {
  // No-op: do not redirect
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next|.*\\..*).*)',
  ],
}; 