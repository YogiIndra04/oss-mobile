import { verifyJwt } from "@/lib/jwt"
import { NextResponse } from "next/server"

export async function GET(req) {
  const token = req.headers.get("authorization")?.split(" ")[1]
  if (!token) {
    return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 })
  }

  const decoded = verifyJwt(token)
  if (!decoded) {
    return NextResponse.json({ error: "Invalid token", token }, { status: 401 })
  }

  return NextResponse.json({ user: decoded })
}
