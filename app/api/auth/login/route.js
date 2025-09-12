// app/api/auth/login/route.js
import { signJwt } from "@/lib/jwt"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req) {
  try {
    const { username, password } = await req.json()

    const user = await prisma.users.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    // ✅ buat token sesuai role user
    const token = signJwt({
      id_user: user.id_user,
      role_user: user.role_user,
    })

    return NextResponse.json({
      message: "Login successful",
      token,
      role: user.role_user,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
