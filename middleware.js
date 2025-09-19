// middleware.js
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    process.env.NEXT_PUBLIC_JWT_SECRET ||
    "supersecret123"
);

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // --- route public tanpa token ---
  const publicPaths = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/me",
    "/api/users",
  ];

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // --- Ambil token dari header ---
  const token = req.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized: No token" },
      { status: 401 }
    );
  }

  try {
    // ✅ pakai jose
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // --- Mapping akses ---
    const roleAccess = {
      admin: [
        "/api/company_addresses",
        "/api/companies",
        "/api/profile_user",
        "/api/tac",
        "/api/bank",
        "/api/customer",
        "/api/product",
        "/api/events",
      ],
      konsultan: ["/api/companies", "/api/profile_user"],
    };

    const allowedPaths = roleAccess[payload.role_user] || [];
    const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

    if (!isAllowed) {
      return NextResponse.json(
        { message: "Forbidden: You don't have access" },
        { status: 403 }
      );
    }

    return NextResponse.next();
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return NextResponse.json(
      { message: "Unauthorized: Invalid token" },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
