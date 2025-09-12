


// ==== MASIH OPSIONAL KALO MAU DITAMBAHIN ====


import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req) {
  try {
    const { username, password, role_user } = await req.json()

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.users.create({
      data: {
        username,
        password: hashedPassword,
        role_user, // "admin" / "konsultan"
      },
    })

    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: newUser.id_user,
        username: newUser.username,
        role: newUser.role_user,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Register failed" }, { status: 500 })
  }
}
