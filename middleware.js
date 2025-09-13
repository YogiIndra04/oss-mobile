// middleware.js
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // --- Biarkan route public tanpa token ---
  const publicPaths = [
    "/api/auth/login", 
    "/api/auth/me", 
    "/api/users",
    "/api/companies",
  ];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // --- Cek token ---
  const token = req.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No token provided" },
      { status: 401 }
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // contoh: route admin khusus role admin
    if (pathname.startsWith("/api/admin") && decoded.role_user !== "admin") {
      return NextResponse.json(
        { message: "Forbidden: You are not an admin" },
        { status: 403 }
      );
    }

    return NextResponse.next();
  } catch (err) {
    return NextResponse.json(
      { message: "Unauthorized: Invalid token" },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"], //middleware hanya untuk API
};
