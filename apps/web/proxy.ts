export { auth as proxy } from "./auth"

export const config = {
    // Exclude all API routes from middleware redirect logic
    // API routes should handle 401 Unauthorized via JSON response, not HTML redirect
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
