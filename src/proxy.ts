import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ancestry_session";
const PUBLIC_PAGES = ["/login", "/register"];

// Pemeriksaan optimis: hanya melihat ada/tidaknya cookie sesi.
// Validasi sesi yang sebenarnya dilakukan di setiap endpoint /api.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PAGES.includes(pathname);

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Semua halaman kecuali API, aset Next.js dan file statis.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
