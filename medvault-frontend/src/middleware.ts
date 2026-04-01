import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/", "/login", "/signup", "/public"];
const STAFF_ONLY = ["/dashboard", "/admin"];
const PATIENT_ONLY = ["/patient"];

function getRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes through
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token =
    req.cookies.get("medvault_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = getRole(token);

  if (!role) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("medvault_token");
    return res;
  }

  // Role-based routing
  if (
    STAFF_ONLY.some((p) => pathname.startsWith(p)) &&
    role === "patient"
  ) {
    return NextResponse.redirect(new URL("/patient", req.url));
  }

  if (
    PATIENT_ONLY.some((p) => pathname.startsWith(p)) &&
    role !== "patient"
  ) {
    return NextResponse.redirect(new URL("/dashboard/system-health", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/patient/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};