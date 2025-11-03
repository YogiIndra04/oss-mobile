import prisma from "@/lib/prisma";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

// ✅ GET semua konsultan
export async function GET() {
  try {
    const konsultanUsers = await prisma.users.findMany({
      where: { role_user: "konsultan" },
      include: { profile_user: true },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(konsultanUsers, { status: 200 });
  } catch (error) {
    console.error("GET /users/konsultan error:", error);
    return NextResponse.json(
      { error: "Failed to fetch konsultan users" },
      { status: 500 }
    );
  }
}

// ✅ CREATE konsultan (support JSON & FormData)
export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body = {};
    let file = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        username: formData.get("username"),
        password: formData.get("password"),
        user_name: formData.get("user_name"),
        email_user: formData.get("email_user"),
        user_contact: formData.get("user_contact"),
        user_address: formData.get("user_address"),
      };
      file = formData.get("profile_image");
    } else {
      body = await req.json();
    }

    const {
      username,
      password,
      user_name,
      email_user,
      user_contact,
      user_address,
    } = body;

    if (!username || !password || !user_name) {
      return NextResponse.json(
        { error: "username, password, and user_name are required" },
        { status: 400 }
      );
    }

    // generate id_user
    const id_user = crypto.randomUUID();

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // upload foto profil
    let profileImageUrl = null;
    if (file && file.name) {
      const uploaded = await uploadToStorage(file, "profile_image");
      profileImageUrl = uploaded.publicUrl;
    }

    // buat user + profile_user
    const newUser = await prisma.users.create({
      data: {
        id_user, // PK user
        role_user: "konsultan",
        username,
        password: hashedPassword,
        profile_user: {
          create: {
            // ❌ jangan isi id_user manual, Prisma otomatis pakai FK
            user_name,
            email_user,
            user_contact,
            user_address,
            profile_image: profileImageUrl,
          },
        },
      },
      include: { profile_user: true },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("POST /users/konsultan error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create konsultan user" },
      { status: 500 }
    );
  }
}
